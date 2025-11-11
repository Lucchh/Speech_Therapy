from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import feedback, realtime
from app.routes import analyze

app = FastAPI(title="Ava (Speech Therapy Coach)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feedback.router)
app.include_router(realtime.router)
app.include_router(analyze.router)

@app.get("/healthz")
def healthz():
    return {"ok": True}
