"""Audio pre- and post-processing helpers shared by ASR components."""

from pathlib import Path


def normalize_audio(input_path: Path, output_path: Path) -> Path:
    """Normalize audio levels and export to the desired format.

    Args:
        input_path: Source audio file recorded from the user.
        output_path: Destination path to store the normalized audio.

    Returns:
        Path to the normalized audio file ready for transcription.
    """
    # speech_recognition.transcribe_audio may call this before sending data
    # to the Whisper API to ensure consistent input quality.
    raise NotImplementedError("Audio normalization is not implemented yet.")

