from __future__ import annotations

import base64
import io
import os
import time
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

APP_VERSION = "1.0.0"
MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MODEL_NAME = os.getenv("VISIONLAB_MODEL", "yolov8n.pt")

app = FastAPI(
    title="VisionLab API",
    description="Image object detection API powered by Ultralytics YOLO.",
    version=APP_VERSION,
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "VISIONLAB_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_model: YOLO | None = None


def get_model() -> YOLO:
    """Load the model once per backend process."""
    global _model
    if _model is None:
        _model = YOLO(MODEL_NAME)
    return _model


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "VisionLab API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": APP_VERSION,
        "model": MODEL_NAME,
        "model_loaded": _model is not None,
    }


@app.post("/api/detect")
async def detect(
    file: UploadFile = File(...),
    confidence: float = Form(0.35),
) -> dict[str, Any]:
    if not 0.05 <= confidence <= 0.95:
        raise HTTPException(status_code=422, detail="Confidence must be between 0.05 and 0.95.")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Upload a JPG, PNG, or WEBP image.",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than the 10 MB limit.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    width, height = image.size
    if width < 2 or height < 2:
        raise HTTPException(status_code=400, detail="The image dimensions are too small.")
    if width * height > 25_000_000:
        raise HTTPException(status_code=413, detail="Image dimensions are too large to process.")

    started = time.perf_counter()
    try:
        model = get_model()
        results = model.predict(
            source=np.asarray(image),
            conf=confidence,
            verbose=False,
        )
    except Exception as exc:
        # Avoid returning internals/stack traces to the browser.
        raise HTTPException(
            status_code=503,
            detail=(
                "The detection model could not run. Check that dependencies installed correctly "
                "and that the model weights can be downloaded. Details: "
                + str(exc)[:240]
            ),
        )

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    result = results[0]
    annotated = result.plot()  # BGR numpy array
    annotated_rgb = annotated[:, :, ::-1]
    output = io.BytesIO()
    Image.fromarray(annotated_rgb).save(output, format="PNG", optimize=True)
    annotated_url = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")

    detections: list[dict[str, Any]] = []
    if result.boxes is not None:
        names = result.names
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            score = float(box.conf[0].item())
            x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0].tolist()]
            detections.append(
                {
                    "label": str(names.get(cls_id, cls_id) if isinstance(names, dict) else names[cls_id]),
                    "confidence": round(score, 4),
                    "confidence_percent": round(score * 100, 1),
                    "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                }
            )
    detections.sort(key=lambda item: item["confidence"], reverse=True)

    return {
        "filename": file.filename or "uploaded-image",
        "image_width": width,
        "image_height": height,
        "processing_ms": elapsed_ms,
        "model": MODEL_NAME,
        "confidence_threshold": confidence,
        "detection_count": len(detections),
        "detections": detections,
        "annotated_image": annotated_url,
    }
