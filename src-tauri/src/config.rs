//! User settings that hold secrets (API keys). Stored in the app config dir and never sent to the UI.
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub youtube_key: String,
    pub ai_base: String,  // OpenAI-compatible base URL, e.g. https://api.mistral.ai/v1
    pub ai_key: String,
    pub ai_model: String,
    pub spotify_id: String,
    pub spotify_secret: String,
}

/// What the UI is allowed to see: whether keys exist, never their values.
#[derive(Serialize)]
pub struct Status {
    youtube: bool,
    ai: bool,
    ai_base: String,
    ai_model: String,
    spotify: bool,
}

pub struct Store {
    path: PathBuf,
    pub cfg: Mutex<Config>,
}

impl Store {
    pub fn load(dir: PathBuf) -> Self {
        let path = dir.join("config.json");
        let cfg = fs::read_to_string(&path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        Store { path, cfg: Mutex::new(cfg) }
    }

    fn save(&self, cfg: &Config) -> Result<(), String> {
        if let Some(d) = self.path.parent() {
            fs::create_dir_all(d).map_err(|e| e.to_string())?;
        }
        fs::write(&self.path, serde_json::to_vec_pretty(cfg).unwrap()).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&self.path, fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }

    pub fn get(&self) -> Config {
        self.cfg.lock().unwrap().clone()
    }
}

#[tauri::command]
pub fn config_status(store: tauri::State<Store>) -> Status {
    let c = store.get();
    Status {
        youtube: !c.youtube_key.is_empty(),
        ai: !c.ai_key.is_empty() && !c.ai_base.is_empty(),
        ai_base: c.ai_base,
        ai_model: c.ai_model,
        spotify: !c.spotify_id.is_empty() && !c.spotify_secret.is_empty(),
    }
}

/// Patch config; keys present in `patch` overwrite, absent keys are kept.
#[tauri::command]
pub fn config_set(store: tauri::State<Store>, patch: serde_json::Value) -> Result<(), String> {
    let mut cur = serde_json::to_value(store.get()).unwrap();
    if let (Some(obj), Some(p)) = (cur.as_object_mut(), patch.as_object()) {
        for (k, v) in p {
            if obj.contains_key(k) {
                if let Some(s) = v.as_str() {
                    obj.insert(k.clone(), serde_json::Value::String(s.trim().to_string()));
                }
            }
        }
    }
    let cfg: Config = serde_json::from_value(cur).map_err(|e| e.to_string())?;
    store.save(&cfg)?;
    *store.cfg.lock().unwrap() = cfg;
    Ok(())
}
