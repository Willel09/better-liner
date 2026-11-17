//! YouTube Data API v3 search (official API, user's own key). Playback happens in the
//! official embedded player on the UI side; this module never touches media streams.
use crate::{config::Store, db::Db};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Video {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub thumb: String,
    pub duration: u32,
}

/// ISO-8601 duration ("PT1H2M3S") to seconds.
pub fn iso_dur(s: &str) -> u32 {
    let (mut total, mut n) = (0u32, 0u32);
    for ch in s.chars() {
        match ch {
            '0'..='9' => n = n * 10 + ch.to_digit(10).unwrap(),
            'H' => { total += n * 3600; n = 0 }
            'M' => { total += n * 60; n = 0 }
            'S' => { total += n; n = 0 }
            'D' => { total += n * 86400; n = 0 }
            _ => n = 0,
        }
    }
    total
}

fn clean_channel(c: &str) -> String {
    c.trim_end_matches(" - Topic").trim_end_matches("VEVO").trim().to_string()
}

fn unescape(s: &str) -> String {
    s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
}

async fn api(key: &str, path: &str, query: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    let res = reqwest::Client::new()
        .get(format!("https://www.googleapis.com/youtube/v3/{path}"))
        .query(query)
        .query(&[("key", key)])
        .send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let reason = body["error"]["errors"][0]["reason"].as_str().unwrap_or("");
        return Err(match reason {
            "quotaExceeded" => "youtube:quota".into(),
            "keyInvalid" | "badRequest" => "youtube:key".into(),
            _ => format!("youtube:{}", body["error"]["message"].as_str().unwrap_or("error")),
        });
    }
    Ok(body)
}

/// Search music videos. Results are cached per query, so repeat lookups cost no quota.
#[tauri::command]
pub async fn yt_search(store: tauri::State<'_, Store>, db: tauri::State<'_, Db>, q: String, max: Option<u32>) -> Result<Vec<Video>, String> {
    let key = store.get().youtube_key;
    if key.is_empty() {
        return Err("youtube:nokey".into());
    }
    let max = max.unwrap_or(15).min(25).to_string();
    let ck = format!("yt:{}:{}", max, q.trim().to_lowercase());
    if let Some(hit) = db.cache_get(&ck).and_then(|v| serde_json::from_str(&v).ok()) {
        return Ok(hit);
    }
    let s = api(&key, "search", &[("part", "snippet"), ("type", "video"), ("videoCategoryId", "10"), ("videoEmbeddable", "true"), ("maxResults", &max), ("q", &q)]).await?;
    let ids: Vec<String> = s["items"].as_array().into_iter().flatten().filter_map(|i| i["id"]["videoId"].as_str().map(String::from)).collect();
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let v = api(&key, "videos", &[("part", "snippet,contentDetails,status"), ("id", &ids.join(","))]).await?;
    let out: Vec<Video> = v["items"].as_array().into_iter().flatten()
        .filter(|i| i["status"]["embeddable"].as_bool().unwrap_or(true))
        .map(|i| {
            let sn = &i["snippet"];
            let th = &sn["thumbnails"];
            Video {
                id: i["id"].as_str().unwrap_or_default().into(),
                title: unescape(sn["title"].as_str().unwrap_or_default()),
                channel: clean_channel(sn["channelTitle"].as_str().unwrap_or_default()),
                thumb: ["maxres", "standard", "high", "medium", "default"].iter()
                    .find_map(|k| th[*k]["url"].as_str()).unwrap_or_default().into(),
                duration: iso_dur(i["contentDetails"]["duration"].as_str().unwrap_or("")),
            }
        })
        .collect();
    db.cache_set(&ck, &serde_json::to_string(&out).unwrap());
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_iso_durations() {
        assert_eq!(iso_dur("PT3M27S"), 207);
        assert_eq!(iso_dur("PT1H0M5S"), 3605);
        assert_eq!(iso_dur("PT45S"), 45);
        assert_eq!(iso_dur("P0D"), 0);
    }
    #[test]
    fn cleans_channel_names() {
        assert_eq!(clean_channel("Some Band - Topic"), "Some Band");
        assert_eq!(clean_channel("SingerVEVO"), "Singer");
    }
}
