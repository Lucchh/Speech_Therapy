"""LLM-powered speech coach that integrates text and acoustic-prosodic analysis."""

from typing import Any, Dict, Optional
import json
from openai import OpenAI
from config.settings import get_settings

# --- Configuration ---
settings = get_settings()
client = OpenAI(api_key=settings.llm_api_key)


# --- System Instruction ---
SYSTEM_PROMPT = """
You are Ava, an empathetic AI speech therapy coach specializing in fluency and stuttering awareness.

You analyze both:
- the speech **transcript** (word-level fluency)
- the **acoustic-prosodic features** (pitch, tempo, energy, formants) extracted from the audio signal.

Your task:
1. Combine both sources to detect any signs of **disfluency or tension**:
   - Word repetitions, syllable prolongations, filler sounds ("uh", "um")
   - Irregular pacing, monotone pitch, low energy, or excessive pauses
2. Provide balanced, encouraging, and actionable feedback:
   - Highlight **fluency strengths** (clarity, pacing, expressiveness)
   - Gently point out **speech areas to improve** (e.g., monotone tone, fast tempo, high tension)
   - Suggest **practical exercises** (e.g., breathing, easy onsets, pitch variation)
3. Maintain a warm, supportive tone — never clinical or judgmental.
4. Respond strictly in **JSON** with these keys:
   - `overall_summary`: one-sentence summary of speech performance
   - `strengths`: list of fluency strengths
   - `areas_for_improvement`: list of specific issues detected
   - `practice_tips`: list of actionable exercises
   - `motivation`: one-line motivational statement

Example output format:
{
  "overall_summary": "The user spoke clearly with minor repetitions and slightly flat pitch.",
  "strengths": ["Steady tempo", "Good vocal energy"],
  "areas_for_improvement": ["Pitch variation was limited", "Repetition on 'in in in'"],
  "practice_tips": ["Use pitch glides to add melody", "Take short pauses between phrases"],
  "motivation": "You’re improving every time — keep focusing on smooth, calm pacing!"
}
""".strip()


# --- Main Feedback Generator ---
def generate_feedback(
    user_profile: Dict[str, Any],
    transcript: str,
    acoustic_features: Optional[Dict[str, float]] = None,
    session_history: Optional[list] = None,
) -> str:
    """Generate feedback JSON using GPT with both transcript + acoustic cues."""

    if not settings.llm_api_key:
        raise RuntimeError("❌ OPENAI_API_KEY not configured. Check your .env file.")

    # Format the acoustic data neatly for model context
    acoustic_summary = json.dumps(acoustic_features or {}, indent=2)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"USER_PROFILE:\n{json.dumps(user_profile, indent=2)}\n\n"
                f"TRANSCRIPT:\n{transcript}\n\n"
                f"ACOUSTIC_FEATURES:\n{acoustic_summary}\n\n"
                f"SESSION_HISTORY:\n{json.dumps(session_history or [], indent=2)}\n\n"
                "Analyze the combined data and produce your JSON feedback response."
            ),
        },
    ]

    try:
        # ✅ Correct modern OpenAI SDK call
        response = client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=0.7,
        )

        # ✅ Correct attribute access
        return response.choices[0].message.content

    except Exception as e:
        print(f"⚠️ Feedback generation failed: {e}")
        return json.dumps(
            {
                "overall_summary": "Error generating feedback.",
                "strengths": [],
                "areas_for_improvement": [],
                "practice_tips": [],
                "motivation": "Try again later!",
            },
            indent=2,
        )


# --- Local Test Example ---
if __name__ == "__main__":
    transcript = "I went to the st-store to buy some milk."
    acoustic_features = {
        "pitch_mean": 128.3,
        "rms_energy": 0.025,
        "tempo": 105.4,
        "formants": {"F1": 640.2, "F2": 1320.5},
    }
    user_profile = {"goal": "fluency improvement"}

    feedback = generate_feedback(user_profile, transcript, acoustic_features)
    print("🗣 Transcript:", transcript)
    print("\n💬 Feedback JSON:\n", feedback)
