import os
import asyncio
import json
from fastapi import APIRouter, HTTPException, Request
from dotenv import load_dotenv
import openai

# Explicitly load the .env file from the backend directory (parent of api)
backend_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../.env'))
load_dotenv(backend_env_path)
print(f"[DEBUG] Loading .env from: {backend_env_path}")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    print(f"[DEBUG] OPENAI_API_KEY loaded: {OPENAI_API_KEY[:6]}...{OPENAI_API_KEY[-4:]}")
else:
    print("[DEBUG] OPENAI_API_KEY loaded: None")

client = openai.OpenAI(api_key=OPENAI_API_KEY)

router = APIRouter()

@router.post("/api/simulate/")
async def simulate(request: Request):
    data = await request.json()
    user_input = data.get("user_input")
    phase = data.get("phase")
    case_study = data.get("case_study")
    attempts = data.get("attempts", 0)
    if not user_input or not phase or not case_study:
        raise HTTPException(status_code=400, detail="Missing required fields.")
    prompt = f"""
You are the simulation engine for an immersive, interactive business case roleplay. The user is a participant in a college-level business simulation. Your job is to:
- Act as both the narrator and all characters in the scenario. For each response, clearly separate the chat messages by persona. Prefix each message with the character's name and role (e.g., "Alex (CFO): ..." or "Narrator: ...").
- As the narrator, set the scene, describe transitions, and guide the user through the simulation.
- As each character, respond in their unique voice, provide their perspectives, ask questions, or react to the user's input as appropriate for their role.
- Present realistic challenges, dilemmas, or new information as the phase progresses.
- If the user makes a strong, relevant business decision, have the relevant characters acknowledge it, describe the positive impact, and as the narrator, suggest moving to the next phase. If the decision is weak or incomplete, provide constructive feedback from the characters' perspectives, possible consequences, and encourage another attempt.
- Only allow progression to the next phase if the user's input demonstrates strong business reasoning or if attempts are exhausted.
- Make the experience feel like a real business scenario, with dynamic feedback, evolving context, and multi-character interaction.

Simulation Context:
Case Title: {case_study.get('title','')}
Description: {case_study.get('description','')}
Current Phase: {phase.get('title','')}
Phase Activities: {' '.join(phase.get('activities', []))}
Characters: {', '.join([f"{c.get('name','')} ({c.get('role','')})" for c in case_study.get('characters',[])])}

User Input: {user_input}

Respond as the simulation, using immersive language, roleplay, and scenario consequences. Separate each persona's message clearly. This is attempt {attempts+1} of 5. If the user is ready to move on, clearly state so in your response (e.g., "Narrator: Let's proceed to the next phase"). Otherwise, keep the user engaged in the current phase with new challenges or feedback from the characters and narrator."""
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful business simulation AI."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=256,
                temperature=0.7,
            )
        )
        ai_message = response.choices[0].message.content.strip()
        return {"ai_response": ai_message}
    except Exception as e:
        print(f"[ERROR] OpenAI simulation error: {e}")
        raise HTTPException(status_code=500, detail="OpenAI simulation error.") 