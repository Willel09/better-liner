//! Playlist import: reads track names (title + artist) from other services' public APIs.
//! Matching to playable YouTube videos happens lazily in the UI when a track is about to play.
use crate::config::Store;
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub struct Item {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u32,
}

#[derive(Serialize)]
pub struct Imported {
    pub name: String,
    pub source: String,
    pub tracks: Vec<Item>,
}

/// Extract (service, id) from a share URL.
pub fn parse_url(url: &str) -> Option<(&'static str, String)> {
    let u = url.trim();
    let after = |marker: &str| u.split(marker).nth(1).map(|s| s.split(['?', '/', '#']).next().unwrap_or("").to_string()).filter(|s| !s.is_empty());
    if u.contains("spotify.com") { return after("/playlist/").map(|id| ("spotify", id)); }
    if u.contains("deezer.com") { return after("/playlist/").map(|id| ("deezer", id)); }
    if u.starts_with("spotify:playlist:") { return Some(("spotify", u[17..].to_string())); }
    None
}

async fn get_json(req: reqwest::RequestBuilder) -> Result<serde_json::Value, String> {
    let r = req.send().await.map_err(|e| e.to_string())?;
    let ok = r.status().is_success();
    let v: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
    if !ok || v.get("error").is_some() {
        return Err(format!("import:{}", v["error"]["message"].as_str().or(v["error"]["type"].as_str()).unwrap_or("not found")));
    }
    Ok(v)
}

async fn deezer(id: &str) -> Result<Imported, String> {
    let http = reqwest::Client::new();
    let meta = get_json(http.get(format!("https://api.deezer.com/playlist/{id}"))).await?;
    let mut tracks = vec![];
    let mut next = Some(format!("https://api.deezer.com/playlist/{id}/tracks?limit=100"));
    while let Some(url) = next.take() {
        let page = get_json(http.get(&url)).await?;
        for t in page["data"].as_array().into_iter().flatten() {
            tracks.push(Item {
                title: t["title"].as_str().unwrap_or_default().into(),
                artist: t["artist"]["name"].as_str().unwrap_or_default().into(),
                album: t["album"]["title"].as_str().unwrap_or_default().into(),
                duration: t["duration"].as_u64().unwrap_or(0) as u32,
            });
        }
        next = page["next"].as_str().map(String::from);
        if tracks.len() > 2000 { break; }
    }
    Ok(Imported { name: meta["title"].as_str().unwrap_or("Deezer").into(), source: "deezer".into(), tracks })
}

async fn spotify(store: &Store, id: &str) -> Result<Imported, String> {
    let c = store.get();
    if c.spotify_id.is_empty() || c.spotify_secret.is_empty() {
        return Err("import:spotify-nokey".into());
    }
    let http = reqwest::Client::new();
    let tok = get_json(http.post("https://accounts.spotify.com/api/token")
        .basic_auth(&c.spotify_id, Some(&c.spotify_secret))
        .form(&[("grant_type", "client_credentials")])).await?;
    let token = tok["access_token"].as_str().ok_or("import:spotify-auth")?.to_string();
    let meta = get_json(http.get(format!("https://api.spotify.com/v1/playlists/{id}?fields=name")).bearer_auth(&token)).await?;
    let mut tracks = vec![];
    let mut next = Some(format!("https://api.spotify.com/v1/playlists/{id}/tracks?limit=100&fields=next,items(track(name,duration_ms,artists(name),album(name)))"));
    while let Some(url) = next.take() {
        let page = get_json(http.get(&url).bearer_auth(&token)).await?;
        for it in page["items"].as_array().into_iter().flatten() {
            let t = &it["track"];
            if t.is_null() { continue; }
            tracks.push(Item {
                title: t["name"].as_str().unwrap_or_default().into(),
                artist: t["artists"].as_array().into_iter().flatten().filter_map(|a| a["name"].as_str()).collect::<Vec<_>>().join(", "),
                album: t["album"]["name"].as_str().unwrap_or_default().into(),
                duration: (t["duration_ms"].as_u64().unwrap_or(0) / 1000) as u32,
            });
        }
        next = page["next"].as_str().map(String::from);
        if tracks.len() > 5000 { break; }
    }
    Ok(Imported { name: meta["name"].as_str().unwrap_or("Spotify").into(), source: "spotify".into(), tracks })
}

#[tauri::command]
pub async fn import_playlist(store: tauri::State<'_, Store>, url: String) -> Result<Imported, String> {
    match parse_url(&url) {
        Some(("deezer", id)) => deezer(&id).await,
        Some(("spotify", id)) => spotify(&store, &id).await,
        _ => Err("import:unsupported".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_share_urls() {
        assert_eq!(parse_url("https://open.spotify.com/playlist/37i9dQ?si=abc"), Some(("spotify", "37i9dQ".into())));
        assert_eq!(parse_url("spotify:playlist:XYZ"), Some(("spotify", "XYZ".into())));
        assert_eq!(parse_url("https://www.deezer.com/se/playlist/908622995"), Some(("deezer", "908622995".into())));
        assert_eq!(parse_url("https://music.apple.com/se/playlist/x/pl.123"), None);
    }
}
