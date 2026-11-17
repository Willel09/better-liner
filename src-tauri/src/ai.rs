//! Chat completions against any OpenAI-compatible API (Mistral, DeepSeek, OpenAI, local servers).
//! The key stays here; the UI only sends prompts.
use crate::{config::Store, db::Db};
use serde::Deserialize;

#[derive(Deserialize, serde::Serialize)]
pub struct Msg {
    role: String,
    content: String,
}

#[tauri::command]
pub async fn ai_chat(store: tauri::State<'_, Store>, db: tauri::State<'_, Db>, messages: Vec<Msg>, json: bool, cache_key: Option<String>) -> Result<String, String> {
    if let Some(hit) = cache_key.as_deref().and_then(|k| db.cache_get(&format!("ai:{k}"))) {
        return Ok(hit);
    }
    let c = store.get();
    if c.ai_key.is_empty() || c.ai_base.is_empty() {
        return Err("ai:nokey".into());
    }
    let mut body = serde_json::json!({ "model": c.ai_model, "messages": messages, "temperature": if json { 0.3 } else { 0.7 } });
    if json {
        body["response_format"] = serde_json::json!({ "type": "json_object" });
    }
    let res = reqwest::Client::new()
        .post(format!("{}/chat/completions", c.ai_base.trim_end_matches('/')))
        .bearer_auth(&c.ai_key)
        .json(&body)
        .timeout(std::time::Duration::from_secs(90))
        .send().await.map_err(|e| format!("ai:{e}"))?;
    let status = res.status();
    let v: serde_json::Value = res.json().await.map_err(|e| format!("ai:{e}"))?;
    if !status.is_success() {
        let msg = v["error"]["message"].as_str().or(v["message"].as_str()).or(v["detail"].as_str()).unwrap_or("request failed");
        return Err(format!("ai:{} {}", status.as_u16(), msg));
    }
    let text = v["choices"][0]["message"]["content"].as_str().ok_or("ai:empty response")?.to_string();
    if let Some(k) = cache_key {
        db.cache_set(&format!("ai:{k}"), &text);
    }
    Ok(text)
}
