//! Local audio analysis for the user's own files: tempo (BPM) and loudness for auto-gain.
use serde::Serialize;
use std::fs::File;
use symphonia::core::{audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream, meta::MetadataOptions, probe::{Hint, Probe}};

#[derive(Serialize, Debug)]
pub struct Analysis {
    pub bpm: f32,
    pub loudness_db: f32, // RMS level in dBFS; UI derives a gain toward a common target
    pub energy: f32,      // 0..1
}

/// Tempo from a mono signal: onset-strength envelope + autocorrelation, with a mild prior around 120 BPM
/// to settle octave ambiguity (60 vs 120 vs 240).
pub fn detect_bpm(samples: &[f32], sr: u32) -> f32 {
    let hop = 256usize;
    let frame_rate = sr as f32 / hop as f32;
    let env: Vec<f32> = samples.chunks(hop).map(|c| (c.iter().map(|x| x * x).sum::<f32>() / c.len() as f32 + 1e-10).ln()).collect();
    let mut onset: Vec<f32> = env.windows(2).map(|w| (w[1] - w[0]).max(0.0)).collect();
    let mean = onset.iter().sum::<f32>() / onset.len().max(1) as f32;
    onset.iter_mut().for_each(|x| *x -= mean);
    let ac_at = |l: usize| onset.iter().zip(&onset[l..]).map(|(a, b)| a * b).sum::<f32>() / (onset.len() - l) as f32;
    let (min_lag, max_lag) = ((frame_rate * 60.0 / 200.0) as usize, (frame_rate * 60.0 / 55.0) as usize);
    let mut best = (0.0f32, 0usize);
    for lag in min_lag.max(2)..=max_lag.min(onset.len().saturating_sub(2)) {
        let bpm = 60.0 * frame_rate / lag as f32;
        let prior = (-0.5 * ((bpm / 120.0).log2() / 0.9).powi(2)).exp();
        let score = ac_at(lag) * prior;
        if score > best.0 { best = (score, lag); }
    }
    if best.1 == 0 { return 0.0; }
    // Octave check: a pulse at lag L also correlates at 2L. If half the lag is nearly as strong, the true beat is faster.
    let half = best.1 / 2;
    if half >= min_lag.max(2) {
        let h = (half - 1..=half + 1).map(|l| (ac_at(l), l)).fold((f32::MIN, half), |a, b| if b.0 > a.0 { b } else { a });
        if h.0 > 0.55 * ac_at(best.1) { best = (h.0, h.1); }
    }
    // Parabolic interpolation around the peak for sub-frame precision.
    let (y0, y1, y2) = (ac_at(best.1 - 1), ac_at(best.1), ac_at(best.1 + 1));
    let d = y0 - 2.0 * y1 + y2;
    let peak = if d.abs() > 1e-12 { best.1 as f32 + 0.5 * (y0 - y2) / d } else { best.1 as f32 };
    (60.0 * frame_rate / peak * 10.0).round() / 10.0
}

pub fn loudness(samples: &[f32]) -> (f32, f32) {
    let rms = (samples.iter().map(|x| x * x).sum::<f32>() / samples.len().max(1) as f32).sqrt();
    let db = 20.0 * (rms + 1e-9).log10();
    (db, ((db + 40.0) / 34.0).clamp(0.0, 1.0)) // -40 dBFS quiet .. -6 dBFS loud
}

/// Decode up to `max_secs` of a file, mixed to mono.
fn decode(path: &str, max_secs: u32) -> Result<(Vec<f32>, u32), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) { hint.with_extension(ext); }
    let probed = Probe::format(symphonia::default::get_probe(), &hint, mss, &FormatOptions::default(), &MetadataOptions::default()).map_err(|e| e.to_string())?;
    let mut reader = probed.format;
    let track = reader.default_track().ok_or("no audio track")?;
    let tid = track.id;
    let sr = track.codec_params.sample_rate.ok_or("unknown sample rate")?;
    let ch = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);
    let mut dec = symphonia::default::get_codecs().make(&track.codec_params, &DecoderOptions::default()).map_err(|e| e.to_string())?;
    let limit = (sr * max_secs) as usize;
    let mut mono = Vec::with_capacity(limit);
    while mono.len() < limit {
        let pkt = match reader.next_packet() { Ok(p) => p, Err(_) => break };
        if pkt.track_id() != tid { continue; }
        let Ok(buf) = dec.decode(&pkt) else { continue };
        let mut sb = SampleBuffer::<f32>::new(buf.capacity() as u64, *buf.spec());
        sb.copy_interleaved_ref(buf);
        mono.extend(sb.samples().chunks(ch).map(|f| f.iter().sum::<f32>() / ch as f32));
    }
    Ok((mono, sr))
}

#[tauri::command]
pub async fn analyze_file(path: String) -> Result<Analysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (s, sr) = decode(&path, 90)?;
        // Skip the intro (often beatless) when the file is long enough.
        let body = if s.len() > sr as usize * 40 { &s[sr as usize * 15..] } else { &s[..] };
        let (db, energy) = loudness(body);
        Ok(Analysis { bpm: detect_bpm(body, sr), loudness_db: db, energy })
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clicks(bpm: f32, secs: f32, sr: u32) -> Vec<f32> {
        let n = (secs * sr as f32) as usize;
        let period = 60.0 / bpm * sr as f32;
        let mut s = vec![0.0f32; n];
        let (mut t, mut seed) = (0.0f32, 1u32);
        while (t as usize) < n {
            // Short decaying noise burst = drum hit.
            for i in 0..800.min(n - t as usize) {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let noise = (seed >> 9) as f32 / (1u32 << 23) as f32 * 2.0 - 1.0;
                s[t as usize + i] += noise * (-(i as f32) / 150.0).exp();
            }
            t += period;
        }
        s
    }

    #[test]
    fn detects_tempo_of_click_tracks() {
        for bpm in [90.0, 120.0, 128.0, 140.0] {
            let got = detect_bpm(&clicks(bpm, 30.0, 22050), 22050);
            assert!((got - bpm).abs() <= 1.5, "expected {bpm}, got {got}");
        }
    }

    #[test]
    fn loudness_of_full_scale_sine_is_about_minus_3db() {
        let s: Vec<f32> = (0..44100).map(|i| (i as f32 * 0.05).sin()).collect();
        let (db, _) = loudness(&s);
        assert!((db + 3.01).abs() < 0.1, "{db}");
    }
}
