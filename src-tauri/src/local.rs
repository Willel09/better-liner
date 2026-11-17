//! The user's own music files: scan a folder, read tags and cover art. Files are played in place —
//! nothing is copied; only small cover thumbnails are written to the cache dir.
use lofty::prelude::*;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{Manager, Runtime};

const AUDIO: [&str; 9] = ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "aiff", "alac"];

#[derive(Serialize)]
pub struct LocalTrack {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: String,
    pub duration: u32,
    pub cover: Option<String>,
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        let hidden = p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with('.'));
        if p.is_dir() && !hidden { walk(&p, out) }
        else if p.extension().and_then(|x| x.to_str()).is_some_and(|x| AUDIO.contains(&x.to_lowercase().as_str())) { out.push(p) }
    }
}

fn read(p: &Path, covers: &Path) -> LocalTrack {
    let path = p.to_string_lossy().to_string();
    let id = format!("local:{}", &sha1_smol::Sha1::from(&path).digest().to_string()[..16]);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
    let mut t = LocalTrack { id, path, title: stem, artist: "Unknown artist".into(), album: String::new(), genre: String::new(), duration: 0, cover: None };
    let Ok(f) = lofty::read_from_path(p) else { return t };
    t.duration = f.properties().duration().as_secs() as u32;
    if let Some(tag) = f.primary_tag().or_else(|| f.first_tag()) {
        if let Some(v) = tag.title() { t.title = v.to_string() }
        if let Some(v) = tag.artist() { t.artist = v.to_string() }
        if let Some(v) = tag.album() { t.album = v.to_string() }
        if let Some(v) = tag.genre() { t.genre = v.to_string() }
        if let Some(pic) = tag.pictures().first() {
            let out = covers.join(format!("{}.img", &t.id[6..]));
            if std::fs::write(&out, pic.data()).is_ok() { t.cover = Some(out.to_string_lossy().into()) }
        }
    }
    t
}

#[tauri::command]
pub async fn local_scan<R: Runtime>(app: tauri::AppHandle<R>, paths: Vec<String>) -> Result<Vec<LocalTrack>, String> {
    let covers = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("covers");
    std::fs::create_dir_all(&covers).map_err(|e| e.to_string())?;
    let scope = app.asset_protocol_scope();
    let _ = scope.allow_directory(&covers, false);
    let mut files = vec![];
    for p in &paths {
        let p = PathBuf::from(p);
        if p.is_dir() { let _ = scope.allow_directory(&p, true); walk(&p, &mut files) } else { let _ = scope.allow_file(&p); files.push(p) }
    }
    tauri::async_runtime::spawn_blocking(move || files.iter().map(|f| read(f, &covers)).collect()).await.map_err(|e| e.to_string())
}

/// Re-grant asset access for files imported in earlier sessions (scope resets on restart).
#[tauri::command]
pub fn local_allow<R: Runtime>(app: tauri::AppHandle<R>, paths: Vec<String>) {
    let scope = app.asset_protocol_scope();
    for p in paths { let _ = scope.allow_file(Path::new(&p)); }
    if let Ok(c) = app.path().app_cache_dir() { let _ = scope.allow_directory(c.join("covers"), false); }
}
