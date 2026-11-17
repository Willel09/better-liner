//! Chat with any AI provider the user picks. Two wire formats cover practically all of them:
//!  - "openai":    OpenAI-compatible /chat/completions (OpenAI, Mistral, DeepSeek, Gemini, Groq,
//!                 OpenRouter, xAI, Together, Ollama, LM Studio, …)
//!  - "anthropic": Anthropic's native Messages API (Claude)
//! The key stays here; the UI only sends prompts.
use crate::{config::{Config, Store}, db::Db};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize, Serialize, Clone)]
pub struct Msg {
    role: String,
    content: String,
}

/// Local model servers (Ollama, LM Studio) don't need a key.
pub fn is_local(base: &str) -> bool {
    let host = base.split("://").nth(1).unwrap_or(base).split(['/', ':']).next().unwrap_or("");
    matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "0.0.0.0")
}

fn is_anthropic(c: &Config) -> bool {
    c.ai_protocol == "anthropic" || c.ai_base.contains("api.anthropic.com")
}

/// Claude models that support server-side refusal fallbacks (re-run on another model instead of stopping).
fn supports_fallbacks(model: &str) -> bool {
    ["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"].contains(&model)
}

/// Messages API body: system turns go to the top-level `system` field; no prefill, no sampling params.
pub fn anthropic_body(model: &str, messages: &[Msg]) -> Value {
    let system = messages.iter().filter(|m| m.role == "system").map(|m| m.content.as_str()).collect::<Vec<_>>().join("\n\n");
    let turns: Vec<Value> = messages.iter().filter(|m| m.role != "system").map(|m| json!({ "role": m.role, "content": m.content })).collect();
    let mut body = json!({ "model": model, "max_tokens": 16000, "messages": turns });
    if !system.is_empty() { body["system"] = json!(system); }
    if supports_fallbacks(model) { body["fallbacks"] = json!("default"); }
    body
}

fn err_msg(status: u16, v: &Value) -> String {
    let m = v["error"]["message"].as_str().or(v["message"].as_str()).or(v["detail"].as_str()).unwrap_or("request failed");
    format!("ai:{status} {m}")
}

async fn send(req: reqwest::RequestBuilder) -> Result<(u16, Value), String> {
    let res = req.timeout(std::time::Duration::from_secs(120)).send().await.map_err(|e| format!("ai:{e}"))?;
    let status = res.status().as_u16();
    let v: Value = res.json().await.map_err(|e| format!("ai:{e}"))?;
    Ok((status, v))
}

async fn chat_anthropic(c: &Config, messages: &[Msg]) -> Result<String, String> {
    let base = if c.ai_base.is_empty() { "https://api.anthropic.com/v1" } else { c.ai_base.trim_end_matches('/') };
    let body = anthropic_body(&c.ai_model, messages);
    let mut req = reqwest::Client::new().post(format!("{base}/messages"))
        .header("x-api-key", &c.ai_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body);
    if body.get("fallbacks").is_some() { req = req.header("anthropic-beta", "server-side-fallback-2026-07-01"); }
    let (status, v) = send(req).await?;
    if status >= 400 { return Err(err_msg(status, &v)); }
    if v["stop_reason"] == "refusal" { return Err("ai:refusal".into()); }
    // Content is a list of blocks (thinking, text, …); only text blocks are the answer.
    let text: String = v["content"].as_array().into_iter().flatten()
        .filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect::<Vec<_>>().join("");
    if text.is_empty() { Err("ai:empty response".into()) } else { Ok(text) }
}

async fn chat_openai(c: &Config, messages: &[Msg], json_mode: bool) -> Result<String, String> {
    let url = format!("{}/chat/completions", c.ai_base.trim_end_matches('/'));
    let mut body = json!({ "model": c.ai_model, "messages": messages });
    if json_mode { body["response_format"] = json!({ "type": "json_object" }); }
    let post = |b: &Value| {
        let r = reqwest::Client::new().post(&url).json(b);
        if c.ai_key.is_empty() { r } else { r.bearer_auth(&c.ai_key) }
    };
    let (mut status, mut v) = send(post(&body)).await?;
    // Not every compatible server knows response_format; the prompt already asks for JSON, so retry without it.
    if status == 400 && json_mode {
        body.as_object_mut().unwrap().remove("response_format");
        (status, v) = send(post(&body)).await?;
    }
    if status >= 400 { return Err(err_msg(status, &v)); }
    v["choices"][0]["message"]["content"].as_str().map(String::from).ok_or_else(|| "ai:empty response".into())
}

#[tauri::command]
pub async fn ai_chat(store: tauri::State<'_, Store>, db: tauri::State<'_, Db>, messages: Vec<Msg>, json: bool, cache_key: Option<String>) -> Result<String, String> {
    if let Some(hit) = cache_key.as_deref().and_then(|k| db.cache_get(&format!("ai:{k}"))) {
        return Ok(hit);
    }
    let c = store.get();
    let anthropic = is_anthropic(&c);
    if (c.ai_base.is_empty() && !anthropic) || (c.ai_key.is_empty() && !is_local(&c.ai_base)) {
        return Err("ai:nokey".into());
    }
    if c.ai_model.is_empty() { return Err("ai:nomodel".into()); }
    let text = if anthropic { chat_anthropic(&c, &messages).await? } else { chat_openai(&c, &messages, json).await? };
    if let Some(k) = cache_key { db.cache_set(&format!("ai:{k}"), &text); }
    Ok(text)
}

/// Model ids the provider offers (both formats expose GET {base}/models).
#[tauri::command]
pub async fn ai_models(store: tauri::State<'_, Store>) -> Result<Vec<String>, String> {
    let c = store.get();
    let anthropic = is_anthropic(&c);
    let base = if anthropic && c.ai_base.is_empty() { "https://api.anthropic.com/v1".to_string() } else { c.ai_base.trim_end_matches('/').to_string() };
    if base.is_empty() { return Err("ai:nokey".into()); }
    let mut req = reqwest::Client::new().get(format!("{base}/models?limit=1000"));
    req = if anthropic { req.header("x-api-key", &c.ai_key).header("anthropic-version", "2023-06-01") }
          else if c.ai_key.is_empty() { req } else { req.bearer_auth(&c.ai_key) };
    let (status, v) = send(req).await?;
    if status >= 400 { return Err(err_msg(status, &v)); }
    let mut ids: Vec<String> = v["data"].as_array().or(v["models"].as_array()).into_iter().flatten()
        .filter_map(|m| m["id"].as_str().or(m["name"].as_str()).map(String::from)).collect();
    ids.sort();
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn m(role: &str, content: &str) -> Msg { Msg { role: role.into(), content: content.into() } }

    #[test]
    fn anthropic_body_moves_system_to_top_level() {
        let b = anthropic_body("claude-opus-5-5", &[m("system", "be brief"), m("user", "hi"), m("assistant", "hey"), m("user", "more")]);
        assert_eq!(b["system"], "be brief");
        assert_eq!(b["messages"].as_array().unwrap().len(), 3);
        assert_eq!(b["messages"][0]["role"], "user");
        assert_eq!(b["fallbacks"], "default");
        assert!(b.get("temperature").is_none());
        let old = anthropic_body("claude-haiku-4-5", &[m("user", "hi")]);
        assert!(old.get("fallbacks").is_none() && old.get("system").is_none());
    }

    #[test]
    fn detects_local_servers() {
        assert!(is_local("http://localhost:11434/v1"));
        assert!(is_local("http://127.0.0.1:1234/v1"));
        assert!(!is_local("https://api.openai.com/v1"));
        assert!(!is_local("https://localhost.example.com/v1"));
    }
}
