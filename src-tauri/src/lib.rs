mod ai;
mod analysis;
mod config;
mod db;
mod import;
mod local;
mod youtube;
mod ytm;

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Default)]
struct Discord(Mutex<Option<(String, DiscordIpcClient)>>);

/// Discord Rich Presence. Silently does nothing when Discord isn't running.
#[tauri::command]
fn discord_update(state: tauri::State<Discord>, client_id: String, title: Option<String>, artist: Option<String>, start: Option<i64>, end: Option<i64>) {
    let mut g = state.0.lock().unwrap();
    if client_id.is_empty() {
        if let Some((_, mut c)) = g.take() { let _ = c.close(); }
        return;
    }
    if g.as_ref().map(|(id, _)| id != &client_id).unwrap_or(true) {
        if let Some((_, mut c)) = g.take() { let _ = c.close(); }
        let mut c = DiscordIpcClient::new(&client_id);
        if c.connect().is_err() { return; }
        *g = Some((client_id, c));
    }
    let Some((_, c)) = g.as_mut() else { return };
    let ok = match (&title, &artist) {
        (Some(t), Some(a)) => {
            let mut ts = activity::Timestamps::new();
            if let Some(s) = start { ts = ts.start(s) }
            if let Some(e) = end { ts = ts.end(e) }
            c.set_activity(activity::Activity::new().details(t).state(a).timestamps(ts)).is_ok()
        }
        _ => c.clear_activity().is_ok(),
    };
    if !ok { *g = None } // connection dropped; reconnect next time
}

#[tauri::command]
fn mini_toggle(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(w) = app.get_webview_window("mini") {
        w.close().map_err(|e| e.to_string())?;
        let _ = app.emit("mini:open", false);
        return Ok(false);
    }
    let w = WebviewWindowBuilder::new(&app, "mini", app_url("index.html#mini"))
        .title("Echo Mini")
        .inner_size(400.0, 132.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .build()
        .map_err(|e| e.to_string())?;
    glass(&w, true);
    let a = app.clone();
    w.on_window_event(move |e| if let tauri::WindowEvent::Destroyed = e { let _ = a.emit("mini:open", false); });
    let _ = app.emit("mini:open", true);
    Ok(true)
}

/// Native translucency behind the web content (macOS vibrancy, Windows 11 Mica).
fn glass(w: &tauri::WebviewWindow, hud: bool) {
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        let m = if hud { NSVisualEffectMaterial::HudWindow } else { NSVisualEffectMaterial::UnderWindowBackground };
        let _ = apply_vibrancy(w, m, None, Some(if hud { 22.0 } else { 0.0 }));
    }
    #[cfg(target_os = "windows")]
    {
        let _ = hud;
        let _ = window_vibrancy::apply_mica(w, None).or_else(|_| window_vibrancy::apply_acrylic(w, Some((18, 18, 24, 160))));
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = (w, hud);
}

#[tauri::command]
fn platform() -> &'static str {
    std::env::consts::OS
}

/// The release build serves the UI from http://localhost instead of tauri://. YouTube's embedded
/// player refuses to play without a normal http(s) origin/referrer. Fixed port: localStorage is per-origin.
const UI_PORT: u16 = 47823;

fn app_url(path: &str) -> WebviewUrl {
    if cfg!(debug_assertions) {
        WebviewUrl::App(path.into())
    } else {
        WebviewUrl::External(format!("http://localhost:{UI_PORT}/{path}").parse().unwrap())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    if !cfg!(debug_assertions) {
        builder = builder.plugin(tauri_plugin_localhost::Builder::new(UI_PORT).build());
    }
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Discord::default())
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            app.manage(db::Db::open(&data.join("echo.db"))?);
            app.manage(config::Store::load(app.path().app_config_dir()?));
            #[allow(unused_mut)]
            let mut wb = WebviewWindowBuilder::new(app, "main", app_url("index.html"))
                .title("Echo")
                .inner_size(1360.0, 860.0)
                .min_inner_size(1000.0, 660.0)
                .transparent(true);
            #[cfg(target_os = "macos")]
            {
                wb = wb.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true)
                    .traffic_light_position(tauri::LogicalPosition::new(20.0, 22.0));
            }
            let w = wb.build()?;
            glass(&w, false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform, mini_toggle, discord_update,
            config::config_status, config::config_set,
            db::cache_get, db::cache_set, db::play_log, db::stats,
            youtube::yt_search, ai::ai_chat, ai::ai_models, import::import_playlist,
            local::local_scan, local::local_allow, analysis::analyze_file,
            ytm::ytm_open, ytm::ytm_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Echo");
}
