from typing import Any, Dict, Optional, List
import json
from openai import OpenAI
from config.settings import get_settings

# --- Configuration ---
settings = get_settings()
client = OpenAI(api_key=settings.openai_api_key)

# --- System Instruction ---
SYSTEM_PROMPT = """You are Ava, an empathetic AI speech therapy coach specializing in fluency and stuttering awareness.

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
""".strip()

# JSON Schema for structured outputs
FEEDBACK_SCHEMA = {
    "name": "FeedbackPayload",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "overall_summary",
            "strengths",
            "areas_for_improvement",
            "practice_tips",
            "motivation"
        ],
        "properties": {
            "overall_summary": {"type": "string"},
            "strengths": {"type": "array", "items": {"type": "string"}},
            "areas_for_improvement": {"type": "array", "items": {"type": "string"}},
            "practice_tips": {"type": "array", "items": {"type": "string"}},
            "motivation": {"type": "string"}
        }
    },
    "strict": True
}

def generate_feedback(
    user_profile: Dict[str, Any],
    transcript: str,
    acoustic_features: Optional[Dict[str, float]] = None,
    session_history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Generate feedback JSON using GPT with both transcript + acoustic cues.
    Uses the Responses API with JSON schema structured outputs.
    """

    if not settings.openai_api_key:
        raise RuntimeError("❌ OPENAI_API_KEY not configured. Check your .env file.")

    acoustic_summary = json.dumps(acoustic_features or {}, indent=2)

    input_messages = [
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
        # Prefer the Responses API with a JSON schema response_format
        response = client.responses.create(
            model=settings.llm_model,
            messages=input_messages,
            temperature=0.7,
            response_format={
                "type": "json_schema",
                "json_schema": FEEDBACK_SCHEMA
            },
        )

        # Depending on SDK version, parse output in a stable way
        # Try extracting the parsed JSON from the output
        if hasattr(response, "output") and response.output and hasattr(response.output[0], "content"):
            # new SDK objects with output content
            for block in response.output[0].content:
                if getattr(block, "type", "") == "output_text":
                    return json.loads(block.text)
        # Fallbacks
        text = getattr(response, "output_text", None) or getattr(response, "text", None)
        if text:
            return json.loads(text)

        # Last resort: access choices-like path if present
        if hasattr(response, "choices"):
            txt = response.choices[0].message.get("content")  # type: ignore
            if txt:
                return json.loads(txt)

        raise RuntimeError("Unexpected response structure; could not find JSON payload.")

    except Exception as e:
        # Return a well-formed error JSON that matches the schema
        return {
            "overall_summary": f"Error generating feedback: {e}",
            "strengths": [],
            "areas_for_improvement": [],
            "practice_tips": [],
            "motivation": "Let's try another take when you're ready."
        }
