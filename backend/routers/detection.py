import os
import joblib
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import numpy as np
import asyncio
from typing import Dict, Any
import base64
import cv2
import sys

# Import LandmarkExtractor from utils
# Add parent directory to path to allow importing from utils if running from different cwd
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.landmark_extractor import LandmarkExtractor
from utils.live_session import record_frame
from utils.alert_logger import AlertLogger

router = APIRouter()

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "..", "saved_models")

# Global Landmark Extractor
_extractor = None

class Autoencoder:
    """NumPy inference for the trained network; avoids bundling PyTorch."""
    def __init__(self, weights):
        self.layers = [
            (weights["encoder.0.weight"], weights["encoder.0.bias"], True),
            (weights["encoder.2.weight"], weights["encoder.2.bias"], True),
            (weights["encoder.4.weight"], weights["encoder.4.bias"], True),
            (weights["decoder.0.weight"], weights["decoder.0.bias"], True),
            (weights["decoder.2.weight"], weights["decoder.2.bias"], True),
            (weights["decoder.4.weight"], weights["decoder.4.bias"], False),
        ]

    def reconstruction_error(self, values):
        output = np.asarray(values, dtype=np.float32)
        for weight, bias, use_relu in self.layers:
            output = output @ weight.T + bias
            if use_relu:
                np.maximum(output, 0, out=output)
        return np.mean(np.square(np.asarray(values, dtype=np.float32) - output), axis=1)

# Models are lazy-loaded via load_models() called from FastAPI lifespan
# to avoid OOM crashes on startup in memory-constrained environments
_scaler = None
_iso_forest = None
_lof = None
_autoencoder = None
_extractor = None
_ae_threshold = 1.5
_MODELS_LOADED = False
_alert_logger = AlertLogger(os.path.join(BASE_DIR, "data", "alerts", "alerts.json"))


def load_models():
    """Load all ML models once at app startup (called from main.py lifespan)."""
    global _scaler, _iso_forest, _lof, _autoencoder, _extractor, _ae_threshold, _MODELS_LOADED
    try:
        _extractor = LandmarkExtractor()
        _scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
        _iso_forest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.pkl"))
        _lof = joblib.load(os.path.join(MODELS_DIR, "lof.pkl"))

        weights = np.load(os.path.join(MODELS_DIR, "autoencoder.npz"))
        _autoencoder = Autoencoder(weights)

        with open(os.path.join(MODELS_DIR, "results.json")) as f:
            _ae_threshold = json.load(f).get("ae_threshold", 1.5)

        _MODELS_LOADED = True
        print("[detection] Models and LandmarkExtractor loaded successfully.")
    except Exception as e:
        print(f"[detection] Failed to load models: {e}. Using mock detection.")
        _MODELS_LOADED = False

def process_features(frame_number: int, frame_features: np.ndarray) -> Dict[str, Any]:
    """Process exactly 20 features through the models."""
    if not _MODELS_LOADED:
        return process_frame_mock(frame_number)
        
    frame_scaled = _scaler.transform(frame_features.reshape(1, -1))
    
    # Autoencoder prediction
    ae_error = float(_autoencoder.reconstruction_error(frame_scaled)[0])
    ae_alert = ae_error > _ae_threshold
    
    # Isolation Forest prediction
    if_score_raw = _iso_forest.decision_function(frame_scaled)[0]
    if_alert = _iso_forest.predict(frame_scaled)[0] == -1
    
    # LOF prediction
    lof_score_raw = _lof.decision_function(frame_scaled)[0]
    lof_alert = _lof.predict(frame_scaled)[0] == -1
    
    # Ensemble voting: 2 of 3 = drowsy
    votes = sum([ae_alert, if_alert, lof_alert])
    is_drowsy = votes >= 2
    
    return {
        "frame": frame_number,
        "ae_error": round(ae_error, 3),
        "if_score": round(float(if_score_raw), 3),
        "lof_score": round(float(lof_score_raw), 3),
        "is_drowsy": bool(is_drowsy),
        "votes": int(votes),
        "confidence": round(votes / 3, 3),
        "model_alerts": {
            "autoencoder": bool(ae_alert),
            "isolation_forest": bool(if_alert),
            "lof": bool(lof_alert),
        },
        "face_detected": True
    }

def process_frame_mock(frame_number: int) -> Dict[str, Any]:
    np.random.seed(frame_number % 100)
    
    ae_error = float(np.random.normal(0.5, 0.2))
    if_score = float(np.random.normal(0.4, 0.15))
    lof_score = float(np.random.normal(1.0, 0.4))
    
    ae_alert = ae_error > 0.75
    if_alert = if_score > 0.6
    lof_alert = lof_score > 1.5
    
    votes = sum([ae_alert, if_alert, lof_alert])
    is_drowsy = votes >= 2
    
    return {
        "frame": frame_number,
        "ae_error": round(ae_error, 3),
        "if_score": round(if_score, 3),
        "lof_score": round(lof_score, 3),
        "is_drowsy": bool(is_drowsy),
        "votes": int(votes),
        "confidence": round(votes / 3, 3),
        "model_alerts": {
            "autoencoder": bool(ae_alert),
            "isolation_forest": bool(if_alert),
            "lof": bool(lof_alert),
        },
        "face_detected": True
    }

@router.get("/status")
async def get_status() -> Dict[str, str]:
    return {
        "status": "Detection API is running (Real Models + MediaPipe)" if _MODELS_LOADED else "Detection API is running (Mock)",
        "websocket_url": "ws://localhost:8000/api/detection/ws"
    }

@router.get("/mock/{frame}")
async def get_mock_detection(frame: int) -> Dict[str, Any]:
    return process_frame_mock(frame)

@router.websocket("/ws")
async def detection_websocket(websocket: WebSocket):
    await websocket.accept()
    frame_count = 0
    was_alerting = False
    try:
        while True:
            # Receive base64 string from frontend
            # The format is typically: data:image/jpeg;base64,...
            data = await websocket.receive_text()
            frame_count += 1
            
            try:
                # Decode base64 image
                header, encoded = data.split(",", 1) if "," in data else ("", data)
                image_bytes = base64.b64decode(encoded)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                # Extract landmarks
                features = _extractor.extract(img) if img is not None and _extractor else None
                
                if features is not None and len(features) == 20:
                    # Face detected, process features
                    result = process_features(frame_count, features)
                    record_frame(features, result["is_drowsy"])
                    if result["is_drowsy"] and not was_alerting:
                        _alert_logger.log_alert(frame_count, "DROWSY", result)
                    was_alerting = result["is_drowsy"]
                else:
                    # No face detected
                    result = {
                        "frame": frame_count,
                        "ae_error": 0.0,
                        "if_score": 0.0,
                        "lof_score": 0.0,
                        "is_drowsy": False,
                        "votes": 0,
                        "face_detected": False
                    }
                    record_frame()
                    was_alerting = False
                
                await websocket.send_json(result)
            except Exception as e:
                print(f"Error processing frame {frame_count}: {e}")
                # Return empty frame on error so frontend doesn't hang
                await websocket.send_json({
                    "frame": frame_count,
                    "ae_error": 0.0,
                    "if_score": 0.0,
                    "lof_score": 0.0,
                    "is_drowsy": False,
                    "votes": 0,
                    "face_detected": False
                })
                
    except WebSocketDisconnect:
        print("Client disconnected from detection websocket")
