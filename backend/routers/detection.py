import os
import joblib
import json
import torch
import torch.nn as nn
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

router = APIRouter()

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "..", "saved_models")

# Global Landmark Extractor
_extractor = None

# Autoencoder Architecture matching train_models.py
class Autoencoder(nn.Module):
    def __init__(self, input_dim=20):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16), nn.ReLU(),
            nn.Linear(16, 12),        nn.ReLU(),
            nn.Linear(12, 8),         nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 12),         nn.ReLU(),
            nn.Linear(12, 16),        nn.ReLU(),
            nn.Linear(16, input_dim),
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

    def reconstruction_error(self, x):
        with torch.no_grad():
            recon = self.forward(x)
            return torch.mean((x - recon) ** 2, dim=1)

# Models are lazy-loaded via load_models() called from FastAPI lifespan
# to avoid OOM crashes on startup in memory-constrained environments (Render free = 512MB)
_scaler = None
_iso_forest = None
_lof = None
_autoencoder = None
_extractor = None
_ae_threshold = 1.5
_MODELS_LOADED = False


def load_models():
    """Load all ML models once at app startup (called from main.py lifespan)."""
    global _scaler, _iso_forest, _lof, _autoencoder, _extractor, _ae_threshold, _MODELS_LOADED
    try:
        _scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
        _iso_forest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.pkl"))
        _lof = joblib.load(os.path.join(MODELS_DIR, "lof.pkl"))

        ae = Autoencoder(input_dim=20)
        ae.load_state_dict(torch.load(os.path.join(MODELS_DIR, "autoencoder.pt"), map_location=torch.device('cpu'), weights_only=True))
        ae.eval()
        _autoencoder = ae

        with open(os.path.join(MODELS_DIR, "results.json")) as f:
            _ae_threshold = json.load(f).get("ae_threshold", 1.5)

        _extractor = LandmarkExtractor()
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
    X_tensor = torch.FloatTensor(frame_scaled)
    ae_error = float(_autoencoder.reconstruction_error(X_tensor).numpy()[0])
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
    try:
        while True:
            # Receive base64 string from frontend
            # The format is typically: data:image/jpeg;base64,...
            data = await websocket.receive_text()
            frame_count += 1
            
            if not _MODELS_LOADED:
                # Fallback to simulated if ML isn't working
                result = process_frame_mock(frame_count)
                await websocket.send_json(result)
                continue
                
            try:
                # Decode base64 image
                header, encoded = data.split(",", 1) if "," in data else ("", data)
                image_bytes = base64.b64decode(encoded)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                # Extract landmarks
                features = _extractor.extract(img)
                
                if features is not None and len(features) == 20:
                    # Face detected, process features
                    result = process_features(frame_count, features)
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

