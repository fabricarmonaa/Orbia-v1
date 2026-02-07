"""
ORBIA AI Service - FastAPI microservice for STT and intent parsing.
Uses faster-whisper for speech-to-text and regex-based intent extraction.
No external LLM dependency required.
"""

import base64
import io
import re
import tempfile
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ORBIA AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model = None


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.environ.get("WHISPER_MODEL", "base")
            whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            print(f"Loaded faster-whisper model: {model_size}")
        except ImportError:
            print("WARNING: faster-whisper not installed. STT will return mock transcriptions.")
            whisper_model = "mock"
    return whisper_model


class STTRequest(BaseModel):
    audio: str
    context: str


class STTResponse(BaseModel):
    transcription: str
    intent: dict


class HealthResponse(BaseModel):
    status: str
    whisper_available: bool


def extract_number(text: str) -> Optional[float]:
    """Extract numeric value from Spanish text, handling common patterns."""
    text = text.lower().strip()
    text = text.replace("mil", "000").replace("cien", "100").replace("doscientos", "200")
    text = text.replace("trescientos", "300").replace("quinientos", "500")
    numbers = re.findall(r'\d+(?:[.,]\d+)?', text)
    if numbers:
        return float(numbers[-1].replace(",", "."))
    word_map = {
        "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
        "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
        "once": 11, "doce": 12, "quince": 15, "veinte": 20, "treinta": 30,
        "cuarenta": 40, "cincuenta": 50, "ciento": 100,
    }
    for word, val in word_map.items():
        if word in text:
            return float(val)
    return None


def parse_order_intent(text: str) -> dict:
    """Parse order creation intent from transcription using regex."""
    intent: dict = {"action": "create_order"}
    lower = text.lower()

    type_map = {
        "encargo": "ENCARGO",
        "turno": "TURNO",
        "servicio": "SERVICIO",
        "pedido": "PEDIDO",
    }
    for keyword, order_type in type_map.items():
        if keyword in lower:
            intent["type"] = order_type
            break
    if "type" not in intent:
        intent["type"] = "PEDIDO"

    name_patterns = [
        r'(?:para|cliente|nombre)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)*)',
        r'(?:de|a nombre de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)*)',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            stop_words = {"pesos", "por", "total", "de", "con", "el", "la", "un", "una"}
            words = name.split()
            cleaned = []
            for w in words:
                if w.lower() in stop_words:
                    break
                cleaned.append(w)
            if cleaned:
                intent["customerName"] = " ".join(cleaned)
            break

    phone_match = re.search(r'(?:teléfono|tel|celular|número)\s*[:\s]*(\d[\d\s\-]{6,})', text, re.IGNORECASE)
    if phone_match:
        intent["customerPhone"] = re.sub(r'[\s\-]', '', phone_match.group(1))

    amount_match = re.search(r'(?:total|monto|precio|por|son|vale)\s*(?:de\s*)?(?:\$?\s*)(\d+(?:[.,]\d+)?)', lower)
    if amount_match:
        intent["totalAmount"] = float(amount_match.group(1).replace(",", "."))

    desc_patterns = [
        r'(?:descripción|detalle|nota|quiere|necesita|pide)\s*[:\s]*(.+?)(?:\.|$)',
    ]
    for pattern in desc_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            desc = match.group(1).strip()
            if len(desc) > 5:
                intent["description"] = desc[:200]
            break

    return intent


def parse_cash_intent(text: str) -> dict:
    """Parse cash movement intent from transcription using regex."""
    intent: dict = {"action": "create_movement"}
    lower = text.lower()

    if any(w in lower for w in ["ingreso", "entrada", "cobro", "cobré", "recibí", "venta"]):
        intent["type"] = "ingreso"
    elif any(w in lower for w in ["egreso", "gasto", "pagué", "compré", "salida"]):
        intent["type"] = "egreso"
    else:
        intent["type"] = "ingreso"

    method_map = {
        "efectivo": "efectivo",
        "cash": "efectivo",
        "transferencia": "transferencia",
        "transf": "transferencia",
        "tarjeta": "tarjeta",
        "débito": "tarjeta",
        "crédito": "tarjeta",
        "mercadopago": "mercadopago",
        "mercado pago": "mercadopago",
        "mp": "mercadopago",
    }
    for keyword, method in method_map.items():
        if keyword in lower:
            intent["method"] = method
            break
    if "method" not in intent:
        intent["method"] = "efectivo"

    amount_match = re.search(r'(?:de|por|son|monto|total)?\s*\$?\s*(\d+(?:[.,]\d+)?)', lower)
    if amount_match:
        intent["amount"] = float(amount_match.group(1).replace(",", "."))

    desc_match = re.search(r'(?:por|concepto|descripción|motivo|razón)\s+(.+?)(?:\s+(?:de|por|en)\s+\d|\.|$)', text, re.IGNORECASE)
    if desc_match:
        desc = desc_match.group(1).strip()
        if len(desc) > 3:
            intent["description"] = desc[:200]

    return intent


def parse_product_intent(text: str) -> dict:
    """Parse product creation intent from transcription using regex."""
    intent: dict = {"action": "create_product"}
    lower = text.lower()

    name_patterns = [
        r'(?:producto|artículo|item)\s+(?:llamado|nombre)?\s*[:\s]*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+)*)',
        r'(?:agregar|crear|nuevo)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+)*)',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            stop_words = {"precio", "costo", "stock", "a", "de", "por", "con"}
            words = name.split()
            cleaned = []
            for w in words:
                if w.lower() in stop_words:
                    break
                cleaned.append(w)
            if cleaned:
                intent["name"] = " ".join(cleaned)
            break

    price_match = re.search(r'(?:precio|vale|cuesta)\s*(?:de\s*)?(?:\$?\s*)(\d+(?:[.,]\d+)?)', lower)
    if price_match:
        intent["price"] = float(price_match.group(1).replace(",", "."))

    cost_match = re.search(r'(?:costo|me sale|me cuesta)\s*(?:de\s*)?(?:\$?\s*)(\d+(?:[.,]\d+)?)', lower)
    if cost_match:
        intent["cost"] = float(cost_match.group(1).replace(",", "."))

    stock_match = re.search(r'(?:stock|cantidad|unidades|hay)\s*(?:de\s*)?(\d+)', lower)
    if stock_match:
        intent["stock"] = int(stock_match.group(1))

    sku_match = re.search(r'(?:sku|código)\s*[:\s]*([A-Za-z0-9\-]+)', text, re.IGNORECASE)
    if sku_match:
        intent["sku"] = sku_match.group(1)

    return intent


INTENT_PARSERS = {
    "orders": parse_order_intent,
    "cash": parse_cash_intent,
    "products": parse_product_intent,
}


def transcribe_audio(audio_base64: str) -> str:
    """Transcribe base64-encoded audio using faster-whisper."""
    model = get_whisper_model()

    audio_bytes = base64.b64decode(audio_base64)

    if model == "mock":
        return "[STT no disponible - faster-whisper no instalado]"

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(tmp_path, language="es", beam_size=5)
        text = " ".join(segment.text for segment in segments).strip()
        return text
    finally:
        os.unlink(tmp_path)


@app.get("/health", response_model=HealthResponse)
async def health():
    model = get_whisper_model()
    return HealthResponse(
        status="ok",
        whisper_available=model != "mock",
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
