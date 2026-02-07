"""
ORBIA AI Service - FastAPI microservice for STT and intent parsing.
Uses faster-whisper for speech-to-text and regex-based intent extraction.
No external LLM dependency required.
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from parsers.orders import parse_order_intent
from parsers.cash import parse_cash_intent
from parsers.products import parse_product_intent
from transcriber import transcribe_audio, get_whisper_model

app = FastAPI(title="ORBIA AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class STTRequest(BaseModel):
    audio: str
    context: str


class STTResponse(BaseModel):
    transcription: str
    intent: dict


class HealthResponse(BaseModel):
    status: str
    whisper_available: bool


INTENT_PARSERS = {
    "orders": parse_order_intent,
    "cash": parse_cash_intent,
    "products": parse_product_intent,
}


@app.get("/health", response_model=HealthResponse)
async def health():
    try:
        get_whisper_model()
        whisper_available = True
    except Exception:
        whisper_available = False
    return HealthResponse(
        status="ok",
        whisper_available=whisper_available,
    )


@app.post("/api/stt", response_model=STTResponse)
async def stt(request: STTRequest):
    if request.context not in INTENT_PARSERS:
        raise HTTPException(status_code=400, detail="Contexto inválido")

    try:
        transcription = transcribe_audio(request.audio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en transcripción: {str(e)}")

    if not transcription or transcription.strip() == "":
        raise HTTPException(status_code=400, detail="No se pudo transcribir el audio")

    parser = INTENT_PARSERS[request.context]
    intent = parser(transcription)

    return STTResponse(transcription=transcription, intent=intent)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AI_SERVICE_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
