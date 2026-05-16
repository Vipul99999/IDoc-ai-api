from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import base64
import io
import os

app = FastAPI(title="IntelliDoc AI Services", version="1.0.0")


class AnalyzeRequest(BaseModel):
    document_id: str
    filename: str
    text: str = ""


class QualitySignal(BaseModel):
    code: str
    severity: str
    message: str


class AnalyzeResponse(BaseModel):
    document_id: str
    document_type: str
    quality_score: int
    language: str
    summary: str
    signals: List[QualitySignal]


class OcrRequest(BaseModel):
    filename: str
    content_base64: str
    engine: str = "auto"


class OcrResponse(BaseModel):
    text: str
    engine: str
    confidence: float


class TranslateRequest(BaseModel):
    text: str
    source_language: str = "auto"
    target_language: str = "en"
    glossary: dict[str, str] = {}


class TranslateResponse(BaseModel):
    translated_text: str
    engine: str
    quality_score: int


@app.get("/health")
def health():
    return {"service": "ai-services", "status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest):
    text = payload.text.lower()
    document_type = "general"
    if "invoice" in text:
        document_type = "invoice"
    elif "resume" in text or "experience" in text:
        document_type = "resume"
    elif "contract" in text or "agreement" in text:
        document_type = "contract"

    signals: List[QualitySignal] = []
    if len(payload.text.strip()) < 40:
        signals.append(QualitySignal(code="LOW_TEXT_DENSITY", severity="medium", message="OCR text density is low."))

    return AnalyzeResponse(
        document_id=payload.document_id,
        document_type=document_type,
        quality_score=max(55, 96 - len(signals) * 15),
        language="en",
        summary=(payload.text[:220] or f"{payload.filename} is ready for OCR and quality processing."),
        signals=signals,
    )


@app.post("/ocr", response_model=OcrResponse)
def ocr(payload: OcrRequest):
    data = base64.b64decode(payload.content_base64)
    images = render_input_to_images(data, payload.filename)

    try:
        if payload.engine in ("auto", "paddleocr"):
            from paddleocr import PaddleOCR
            import numpy as np

            ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            lines = []
            confidences = []
            for image in images:
                result = ocr_engine.ocr(np.array(image), cls=True)
                for page in result or []:
                    for item in page or []:
                        if len(item) >= 2:
                            lines.append(item[1][0])
                            confidences.append(float(item[1][1]))
            if lines:
                return OcrResponse(text="\n".join(lines), engine="paddleocr-rendered", confidence=sum(confidences) / max(1, len(confidences)))
    except Exception:
        pass

    try:
        import pytesseract

        texts = []
        confidences = []
        for image in images:
            enhanced = enhance_for_ocr(image)
            texts.append(pytesseract.image_to_string(enhanced))
            data_frame = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
            for value in data_frame.get("conf", []):
                try:
                    score = float(value)
                    if score >= 0:
                        confidences.append(score / 100)
                except Exception:
                    continue
        confidence = sum(confidences) / max(1, len(confidences)) if confidences else 0.65
        return OcrResponse(text="\n\n".join(texts).strip(), engine="pytesseract-rendered", confidence=confidence)
    except Exception:
        return OcrResponse(text="", engine="unavailable", confidence=0.0)


@app.post("/translate", response_model=TranslateResponse)
def translate(payload: TranslateRequest):
    translated = None
    engine = "rule-glossary-fallback"

    try:
        from transformers import pipeline

        model_name = os.getenv("TRANSLATION_MODEL", "")
        if model_name:
            translator = pipeline("translation", model=model_name)
            result = translator(payload.text[:4000])
            translated = result[0].get("translation_text") if result else None
            engine = f"transformers:{model_name}"
    except Exception:
        translated = None

    if not translated:
        translated = payload.text
        for source, target in payload.glossary.items():
            translated = translated.replace(source, target)

    quality = 92 if engine.startswith("transformers") else 68 + min(20, len(payload.glossary) * 3)
    return TranslateResponse(translated_text=translated, engine=engine, quality_score=quality)


def render_input_to_images(data: bytes, filename: str):
    extension = os.path.splitext(filename.lower())[1]
    if extension == ".pdf":
        try:
            import fitz
            from PIL import Image

            doc = fitz.open(stream=data, filetype="pdf")
            images = []
            for page_index in range(min(len(doc), 25)):
                page = doc.load_page(page_index)
                pix = page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                images.append(image)
            doc.close()
            if images:
                return images
        except Exception:
            pass

    from PIL import Image, ImageSequence

    image = Image.open(io.BytesIO(data))
    frames = []
    for frame in ImageSequence.Iterator(image):
        frames.append(frame.convert("RGB"))
        if len(frames) >= 25:
            break
    return frames or [image.convert("RGB")]


def enhance_for_ocr(image):
    try:
        import cv2
        import numpy as np
        from PIL import Image

        array = np.array(image)
        gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
        gray = cv2.fastNlMeansDenoising(gray, None, 12, 7, 21)
        gray = cv2.equalizeHist(gray)
        threshold = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 9)
        return Image.fromarray(threshold)
    except Exception:
        return image
