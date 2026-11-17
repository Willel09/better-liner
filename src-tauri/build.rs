fn main() {
    // Listing app commands makes each one a permission, so every window gets only what its
    // capability grants (the YouTube Music page may call ytm_state and nothing else).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "platform", "mini_toggle", "discord_update", "config_status", "config_set", "cache_get", "cache_set", "play_log", "stats", "yt_search", "ai_chat", "import_playlist", "local_scan", "local_allow", "analyze_file", "ytm_open", "ytm_state"
    ])))
    .expect("failed to run tauri-build");
}
