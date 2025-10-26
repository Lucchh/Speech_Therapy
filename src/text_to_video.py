"""Utilities to synthesize speech from text and render a simple video.

This module:
- Turns feedback JSON/text into a readable script
- Uses OpenAI TTS to synthesize an MP3
- Uses moviepy to attach the audio to a static background and export MP4
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import openai

from config.settings import get_settings


settings = get_settings()
if settings.llm_api_key:
    openai.api_key = settings.llm_api_key


def feedback_json_to_script(feedback: str) -> str:
    """Convert the LLM feedback JSON (string) into a friendly narration script.

    Falls back to returning the original text if parsing fails.
    """
    try:
        data = json.loads(feedback)
        parts = []
        if s := data.get("overall_summary"):
            parts.append(f"Overall summary: {s}.")
        if strengths := data.get("strengths"):
            parts.append("Strengths:")
            parts.extend(f"- {item}." for item in strengths)
        if areas := data.get("areas_for_improvement"):
            parts.append("Areas for improvement:")
            parts.extend(f"- {item}." for item in areas)
        if tips := data.get("practice_tips"):
            parts.append("Practice tips:")
            parts.extend(f"- {item}." for item in tips)
        if mot := data.get("motivation"):
            parts.append(mot)
        text = "\n".join(parts).strip()
        return text or feedback
    except Exception:
        return feedback


def tts_to_audio(text: str, out_path: Path, *, voice: Optional[str] = None, response_format: str = "mp3") -> Path:
    """Synthesize speech from text using OpenAI TTS models.

    Args:
        text: The input text to speak.
        out_path: Destination audio file path (extension should match format).
        voice: Optional voice name; defaults to configured voice.
        format: Audio format for output (e.g., "mp3", "wav").
    Returns:
        Path to the written audio file.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Use the streaming helper to write directly to disk.
    # Requires openai>=1.0.0
    with openai.audio.speech.with_streaming_response.create(
        model=settings.tts_model,
        voice=voice or settings.tts_voice,
        input=text,
        response_format=response_format,
    ) as response:
        response.stream_to_file(str(out_path))

    return out_path


def build_video_from_audio(
    audio_path: Path,
    out_path: Path,
    *,
    background_image: Optional[Path] = None,
    size: tuple[int, int] = (1280, 720),
    bg_color: tuple[int, int, int] = (18, 18, 18),
) -> Path:
    """Create a simple MP4 with static background and the given audio.

    If no background image is provided, a solid color background is used.
    """
    try:
        from moviepy.editor import AudioFileClip, ImageClip, ColorClip
    except ImportError as e:
        raise ImportError(
            "moviepy is required to build videos. Install with: pip install moviepy imageio-ffmpeg"
        ) from e

    out_path.parent.mkdir(parents=True, exist_ok=True)

    audio_clip = AudioFileClip(str(audio_path))

    if background_image and Path(background_image).exists():
        video_clip = ImageClip(str(background_image)).set_duration(audio_clip.duration)
        if video_clip.size != list(size):
            video_clip = video_clip.resize(newsize=size)
    else:
        video_clip = ColorClip(size=size, color=bg_color).set_duration(audio_clip.duration)

    final = video_clip.set_audio(audio_clip)
    # Reasonable defaults; tweak bitrate/fps if needed.
    try:
        final.write_videofile(
            str(out_path),
            fps=24,
            audio_codec="aac",
            codec="libx264",
            preset="medium",
            threads=2,
            verbose=False,
            logger=None,
        )
    except Exception:
        # Fallback for environments without libx264
        final.write_videofile(
            str(out_path),
            fps=24,
            audio_codec="aac",
            codec="mpeg4",
            preset="medium",
            threads=2,
            verbose=False,
            logger=None,
        )

    # Close clips to free resources in long-running sessions.
    audio_clip.close()
    video_clip.close()
    final.close()

    return out_path
