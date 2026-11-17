//! SQLite: listening history (for statistics / Music DNA) and a small key-value cache
//! (YouTube matches, AI results, audio analysis). Only metadata — no audio is ever stored.
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY, track_id TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL,
  genre TEXT, mood TEXT, ts INTEGER NOT NULL, seconds REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS plays_ts ON plays(ts);
CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL);
";

fn now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64
}

impl Db {
    pub fn open(path: &std::path::Path) -> rusqlite::Result<Self> {
        let c = Connection::open(path)?;
        c.execute_batch("PRAGMA journal_mode=WAL;")?;
        c.execute_batch(SCHEMA)?;
        Ok(Db(Mutex::new(c)))
    }
    #[cfg(test)]
    pub fn memory() -> Self {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(SCHEMA).unwrap();
        Db(Mutex::new(c))
    }

    pub fn cache_get(&self, k: &str) -> Option<String> {
        self.0.lock().unwrap().query_row("SELECT v FROM cache WHERE k=?1", [k], |r| r.get(0)).optional().ok().flatten()
    }
    pub fn cache_set(&self, k: &str, v: &str) {
        let _ = self.0.lock().unwrap().execute("INSERT OR REPLACE INTO cache(k,v,ts) VALUES(?1,?2,?3)", params![k, v, now()]);
    }
}

#[tauri::command]
pub fn cache_get(db: tauri::State<Db>, k: String) -> Option<String> {
    db.cache_get(&k)
}

#[tauri::command]
pub fn cache_set(db: tauri::State<Db>, k: String, v: String) {
    db.cache_set(&k, &v)
}

#[tauri::command]
pub fn play_log(db: tauri::State<Db>, track_id: String, title: String, artist: String, genre: Option<String>, mood: Option<String>, seconds: f64) -> Result<(), String> {
    if seconds < 1.0 {
        return Ok(());
    }
    db.0.lock().unwrap()
        .execute("INSERT INTO plays(track_id,title,artist,genre,mood,ts,seconds) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![track_id, title, artist, genre, mood, now(), seconds])
        .map(|_| ()).map_err(|e| e.to_string())
}

#[derive(Serialize, Default, Debug)]
pub struct Count { pub key: String, pub sub: String, pub plays: i64, pub minutes: f64 }

#[derive(Serialize, Default, Debug)]
pub struct Stats {
    pub minutes: f64,
    pub plays: i64,
    pub tracks: i64,
    pub artists: i64,
    pub top_tracks: Vec<Count>,
    pub top_artists: Vec<Count>,
    pub top_genres: Vec<Count>,
    pub top_moods: Vec<Count>,
    pub by_hour: Vec<f64>,       // minutes per local hour 0..23 (UTC offset applied by caller)
    pub by_day: Vec<(i64, f64)>, // (day index since epoch, minutes)
}

pub fn stats_for(db: &Db, days: i64, tz_offset_min: i64) -> rusqlite::Result<Stats> {
    let c = db.0.lock().unwrap();
    let since = if days > 0 { now() - days * 86400 } else { 0 };
    let mut s = Stats { by_hour: vec![0.0; 24], ..Default::default() };
    (s.minutes, s.plays, s.tracks, s.artists) = c.query_row(
        "SELECT COALESCE(SUM(seconds),0)/60.0, COUNT(*), COUNT(DISTINCT track_id), COUNT(DISTINCT artist) FROM plays WHERE ts>=?1",
        [since], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?;
    let top = |sql: &str| -> rusqlite::Result<Vec<Count>> {
        let mut st = c.prepare(sql)?;
        let rows = st.query_map([since], |r| Ok(Count { key: r.get(0)?, sub: r.get(1)?, plays: r.get(2)?, minutes: r.get(3)? }))?;
        rows.collect()
    };
    s.top_tracks = top("SELECT title, artist, COUNT(*), SUM(seconds)/60.0 FROM plays WHERE ts>=?1 GROUP BY track_id ORDER BY 3 DESC, 4 DESC LIMIT 25")?;
    s.top_artists = top("SELECT artist, '', COUNT(*), SUM(seconds)/60.0 FROM plays WHERE ts>=?1 GROUP BY artist ORDER BY 3 DESC LIMIT 25")?;
    s.top_genres = top("SELECT genre, '', COUNT(*), SUM(seconds)/60.0 FROM plays WHERE ts>=?1 AND genre IS NOT NULL AND genre!='' GROUP BY genre ORDER BY 3 DESC LIMIT 12")?;
    s.top_moods = top("SELECT mood, '', COUNT(*), SUM(seconds)/60.0 FROM plays WHERE ts>=?1 AND mood IS NOT NULL AND mood!='' GROUP BY mood ORDER BY 3 DESC LIMIT 12")?;
    let off = tz_offset_min * 60;
    let mut st = c.prepare("SELECT ((ts+?2)/3600)%24, SUM(seconds)/60.0 FROM plays WHERE ts>=?1 GROUP BY 1")?;
    for row in st.query_map(params![since, off], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, f64>(1)?)))? {
        let (h, m) = row?;
        s.by_hour[h.rem_euclid(24) as usize] = m;
    }
    let mut st = c.prepare("SELECT (ts+?2)/86400, SUM(seconds)/60.0 FROM plays WHERE ts>=?1 GROUP BY 1 ORDER BY 1")?;
    s.by_day = st.query_map(params![since, off], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    Ok(s)
}

#[tauri::command]
pub fn stats(db: tauri::State<Db>, days: i64, tz_offset_min: i64) -> Result<Stats, String> {
    stats_for(&db, days, tz_offset_min).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stats_aggregate_plays() {
        let db = Db::memory();
        {
            let c = db.0.lock().unwrap();
            for (id, artist, secs) in [("a", "X", 120.0), ("a", "X", 60.0), ("b", "Y", 30.0)] {
                c.execute("INSERT INTO plays(track_id,title,artist,genre,ts,seconds) VALUES(?1,?1,?2,'pop',?3,?4)", params![id, artist, now(), secs]).unwrap();
            }
        }
        let s = stats_for(&db, 7, 0).unwrap();
        assert_eq!(s.plays, 3);
        assert_eq!(s.tracks, 2);
        assert_eq!(s.artists, 2);
        assert!((s.minutes - 3.5).abs() < 1e-9);
        assert_eq!(s.top_tracks[0].key, "a");
        assert_eq!(s.top_tracks[0].plays, 2);
        assert_eq!(s.top_genres[0].key, "pop");
        assert!((s.by_hour.iter().sum::<f64>() - 3.5).abs() < 1e-9);
    }

    #[test]
    fn cache_roundtrip() {
        let db = Db::memory();
        assert_eq!(db.cache_get("k"), None);
        db.cache_set("k", "v1");
        db.cache_set("k", "v2");
        assert_eq!(db.cache_get("k").as_deref(), Some("v2"));
    }
}
