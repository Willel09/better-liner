//! YouTube Music inside Echo: the official music.youtube.com site in its own window, where the user
//! signs in with their Google account. No API key. A small bridge script reports what's playing so
//! Echo's player bar, lyrics, statistics and mini player follow along. Echo controls it by sending
//! "ytm:command" events that the bridge listens for.
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const BRIDGE: &str = include_str!("ytm_bridge.js");
const HOME: &str = "https://music.youtube.com/";

#[derive(Deserialize, Serialize, Clone)]
pub struct YtmState {
    id: String,
    title: String,
    artist: String,
    album: String,
    artwork: String,
    playing: bool,
    position: f64,
    duration: f64,
}

fn clip(s: &mut String, n: usize) {
    if let Some((i, _)) = s.char_indices().nth(n) { s.truncate(i) }
}

/// Google refuses sign-in from browsers it doesn't recognise; present a normal desktop browser.
fn user_agent() -> Option<&'static str> {
    if cfg!(target_os = "windows") {
        None // WebView2 already identifies as Edge
    } else {
        Some("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15")
    }
}

/// Open (or focus) the YouTube Music window, optionally at a music.youtube.com URL such as a search.
#[tauri::command]
pub fn ytm_open(app: AppHandle, url: Option<String>) -> Result<(), String> {
    let target = url.filter(|u| u.starts_with(HOME)).unwrap_or_else(|| HOME.into());
    let parsed: tauri::Url = target.parse().map_err(|_| "bad url".to_string())?;
    if let Some(w) = app.get_webview_window("ytm") {
        if target != HOME { w.navigate(parsed).map_err(|e| e.to_string())?; }
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    let mut b = WebviewWindowBuilder::new(&app, "ytm", WebviewUrl::External(parsed))
        .title("YouTube Music — Echo")
        .inner_size(1180.0, 800.0)
        .min_inner_size(720.0, 520.0)
        .initialization_script(BRIDGE);
    if let Some(ua) = user_agent() { b = b.user_agent(ua); }
    let w = b.build().map_err(|e| e.to_string())?;
    let a = app.clone();
    w.on_window_event(move |e| if let tauri::WindowEvent::Destroyed = e { let _ = a.emit_to("main", "ytm:open", false); });
    let _ = app.emit_to("main", "ytm:open", true);
    Ok(())
}

/// Called by the bridge script inside the YouTube Music window only.
#[tauri::command]
pub fn ytm_state(app: AppHandle, window: tauri::Window, mut state: YtmState) {
    if window.label() != "ytm" { return; }
    for (s, n) in [(&mut state.title, 300), (&mut state.artist, 300), (&mut state.album, 300), (&mut state.id, 20)] { clip(s, n) }
    if !state.artwork.starts_with("https://") { state.artwork.clear() } else { clip(&mut state.artwork, 1000) }
    let _ = app.emit_to("main", "ytm:state", state);
}
