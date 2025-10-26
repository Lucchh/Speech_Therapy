"""Acoustic-prosodic analysis utilities for speech therapy."""

from __future__ import annotations
import numpy as np
import librosa
import parselmouth
from pathlib import Path


def analyze_acoustics(audio_path: Path) -> dict:
    """Extract acoustic-prosodic features from a speech signal."""
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # --- Load audio ---
    y, sr = librosa.load(audio_path, sr=None)

    if len(y) < sr * 0.5 or np.allclose(y, 0, atol=1e-6):
        return {"error": "Silent or too short audio"}

    duration_s = librosa.get_duration(y=y, sr=sr)

    # --- Pitch ---
    pitch, _ = librosa.piptrack(y=y, sr=sr)
    voiced = pitch[pitch > 0]
    pitch_mean = float(np.mean(voiced)) if voiced.size else 0.0
    pitch_std = float(np.std(voiced)) if voiced.size else 0.0

    # --- Energy ---
    rms = float(np.sqrt(np.mean(y ** 2)))

    # --- Tempo / speech rate proxy ---
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    speech_rate = float(tempo)  # use tempo as rough proxy for syllable rate

    # --- Pause ratio ---
    intervals = librosa.effects.split(y, top_db=30)
    non_silent_duration = np.sum(intervals[:, 1] - intervals[:, 0]) / sr
    pause_ratio = 1 - (non_silent_duration / duration_s)

    # --- Spectral features ---
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))

    # --- Formants ---
    snd = parselmouth.Sound(str(audio_path))
    formant = snd.to_formant_burg()
    dur = snd.get_total_duration()
    times = np.linspace(0.1, dur - 0.1, num=5)

    f1_vals = [formant.get_value_at_time(1, t) for t in times]
    f2_vals = [formant.get_value_at_time(2, t) for t in times]
    f1 = float(np.nanmean([v for v in f1_vals if not np.isnan(v)])) if np.any(~np.isnan(f1_vals)) else 0.0
    f2 = float(np.nanmean([v for v in f2_vals if not np.isnan(v)])) if np.any(~np.isnan(f2_vals)) else 0.0

    return {
        "file": audio_path.name,
        "duration_s": duration_s,
        "pitch_mean": pitch_mean,
        "pitch_std": pitch_std,
        "rms_energy": rms,
        "speech_rate": speech_rate,
        "pause_ratio": pause_ratio,
        "spectral_centroid": spectral_centroid,
        "spectral_rolloff": spectral_rolloff,
        "formants": {"F1": f1, "F2": f2},
    }


def format_acoustic_summary(features: dict) -> str:
    """Return a readable, human-friendly summary string."""
    if "error" in features:
        return f"⚠️ {features['error']}"

    f = features
    formants = f.get("formants", {})
    return "\n".join([
        f"🎵 Mean pitch (Hz): {f.get('pitch_mean', 0):.2f}",
        f"🎶 Pitch variability (std Hz): {f.get('pitch_std', 0):.2f}",
        f"🔊 RMS energy: {f.get('rms_energy', 0):.4f}",
        f"⏱ Speech rate (proxy BPM): {f.get('speech_rate', 0):.2f}",
        f"🤫 Pause ratio: {f.get('pause_ratio', 0):.2f}",
        f"🎚 Spectral centroid (Hz): {f.get('spectral_centroid', 0):.2f}",
        f"🎛 Spectral rolloff (Hz): {f.get('spectral_rolloff', 0):.2f}",
        f"🗣 Formant F1 (Hz): {formants.get('F1', 0):.2f}",
        f"🗣 Formant F2 (Hz): {formants.get('F2', 0):.2f}",
        f"🕒 Duration (s): {f.get('duration_s', 0):.2f}",
    ])


if __name__ == "__main__":
    sample = Path("data/users/stutter_sampe1.mp3")
    print(f"🎧 Running acoustic analysis on: {sample}")
    res = analyze_acoustics(sample)
    print("📊 Acoustic Features:")
    print(format_acoustic_summary(res))
