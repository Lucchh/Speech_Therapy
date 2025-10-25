"""LLM-powered speech coach that generates feedback and practice advice."""

from typing import Any, Dict, Optional

import openai

from config.settings import get_settings

# Resolve runtime configuration (API keys, model names) from environment/.env.
settings = get_settings()

if settings.llm_api_key:
    openai.api_key = settings.llm_api_key

# TODO: Expand this prompt with the full specification for the Ava coach persona.
SYSTEM_PROMPT = """
You are Ava, an empathetic AI speech therapy coach specializing in fluency and stuttering awareness.

Your task:
1. Detect any signs of **stuttering or disfluency** in the transcript — such as word repetitions, syllable prolongations, filler sounds ("uh", "um"), or blocks (pauses in mid-word).
2. Provide balanced, encouraging, and actionable feedback:
   - Highlight **fluency strengths** (parts where the user speaks smoothly or clearly).
   - Point out **stuttering or rhythm issues** gently and precisely.
   - Suggest **practical fluency exercises** (e.g., breathing, slow speech pacing, gentle onsets).
3. Maintain a warm, supportive tone — avoid clinical or judgmental language.
4. Respond in **JSON** with the following keys:
   - `overall_summary`: One sentence summary of the user's speech.
   - `strengths`: A list of specific positive observations.
   - `areas_for_improvement`: A list describing stuttering or fluency issues detected.
   - `practice_tips`: A list of short, actionable exercises to try next.
   - `motivation`: A one-line motivational statement.

Example output format:
{
  "overall_summary": "The user spoke confidently but showed mild repetition around 'in in in'.",
  "strengths": ["Good vocal projection", "Natural rhythm on longer sentences"],
  "areas_for_improvement": ["Repetition on 'in' indicates mild block", "Slight tension at sentence starts"],
  "practice_tips": ["Practice slow breathing before phrases", "Use gentle onsets on vowel-starting words"],
  "motivation": "You're doing great — every smooth phrase is progress!"
}
""".strip()



def generate_feedback(
    user_profile: Dict[str, Any],
    transcript: str,
    confidence_scores: Optional[Dict[str, float]] = None,
    session_history: Optional[list] = None,
) -> str:
    """Generate feedback JSON using GPT.

    Args:
        user_profile: Metadata describing the user's goals and progress.
        transcript: Recognized text produced by ASR.
        confidence_scores: Optional per-phoneme or per-word confidence metrics.
        session_history: Optional list of previous coaching interactions.

    Returns:
        JSON-formatted feedback string emitted by the LLM.
    """
    if not settings.llm_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. Set it in your environment or .env file."
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "USER_PROFILE: {user_profile}\n"
                "INPUT_TRANSCRIPT: {transcript}\n"
                "CONFIDENCE_SCORES: {confidence_scores}\n"
                "SESSION_HISTORY: {session_history}\n"
            ).format(
                user_profile=user_profile,
                transcript=transcript,
                confidence_scores=confidence_scores,
                session_history=session_history,
            ),
        },
    ]
    # return response.choices[0].message.content is the correct way in new version, stick to it 
    response = openai.chat.completions.create(
    model=settings.llm_model,
    messages=messages,
    temperature=0.7,
)

    # stick to return response.choices[0].message.content

    return response.choices[0].message.content




