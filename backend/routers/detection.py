import os
import json
from collections import deque
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import numpy as np
from typing import Dict, Any
from time import monotonic

from utils.live_session import record_frame
from utils.alert_logger import AlertLogger

router = APIRouter()

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "..", "saved_models")

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
_autoencoder = None
_ae_threshold = 1.5
_MODELS_LOADED = False
_runtime_models = None
_alert_logger = AlertLogger(os.path.join(BASE_DIR, "data", "alerts", "alerts.json"))


class LiveStreamTracker:
    """Detect sustained fatigue cues from the ordered live landmark stream."""

    def __init__(self):
        self.eye_closed_since = None
        self.eye_window = deque()
        self.yawn_since = None
        self.yawn_recorded = False
        self.yawn_times = deque()

    def update(self, features, model_consensus):
        now = monotonic()
        values = np.asarray(features, dtype=np.float32)

        # Features 14 and 15 are eye aspect ratios scaled by 2.5.
        eyes_closed = values[14] < 0.48 and values[15] < 0.48
        if eyes_closed:
            self.eye_closed_since = self.eye_closed_since or now
        else:
            self.eye_closed_since = None

        self.eye_window.append((now, eyes_closed))
        while self.eye_window and now - self.eye_window[0][0] > 10:
            self.eye_window.popleft()
        perclos = (
            len(self.eye_window) >= 16
            and sum(1 for _, closed in self.eye_window if closed) / len(self.eye_window) >= 0.8
        )
        eye_closure = bool(
            (self.eye_closed_since is not None and now - self.eye_closed_since >= 1.5)
            or perclos
        )

        # Require a sustained yawn so talking or a single noisy landmark frame
        # does not create an event; repeated yawns remain tracked for the minute.
        mouth_open = values[3] >= 0.55
        if mouth_open:
            self.yawn_since = self.yawn_since or now
        else:
            self.yawn_since = None
            self.yawn_recorded = False
        yawn = bool(self.yawn_since is not None and now - self.yawn_since >= 1.5)
        if yawn and not self.yawn_recorded:
            self.yawn_times.append(now)
            self.yawn_recorded = True
        while self.yawn_times and now - self.yawn_times[0] > 60:
            self.yawn_times.popleft()

        is_drowsy = eye_closure or yawn or len(self.yawn_times) >= 2 or model_consensus
        signals = {
            "eye_closure": eye_closure,
            "yawn": yawn,
            "model_consensus": bool(model_consensus),
        }
        return {
            "is_drowsy": bool(is_drowsy),
            "live_signals": signals,
            "models": [name for name, active in signals.items() if active],
        }

    def reset_on_missing_face(self):
        self.eye_closed_since = None
        self.eye_window.clear()
        self.yawn_since = None
        self.yawn_recorded = False


def apply_live_tracking(result, features, tracker):
    live = tracker.update(features, result["is_drowsy"])
    result.update(live)
    signal_confidence = sum(live["live_signals"].values()) / 3
    result["confidence"] = round(max(float(result.get("confidence", 0)), signal_confidence), 3)
    return result


def load_models():
    """Load all ML models once at app startup (called from main.py lifespan)."""
    global _scaler, _iso_forest, _lof, _autoencoder, _ae_threshold, _MODELS_LOADED, _runtime_models
    try:
        _runtime_models = np.load(os.path.join(MODELS_DIR, "runtime_models.npz"))
        weights = np.load(os.path.join(MODELS_DIR, "autoencoder.npz"))
        _autoencoder = Autoencoder(weights)

        with open(os.path.join(MODELS_DIR, "results.json")) as f:
            _ae_threshold = json.load(f).get("ae_threshold", 1.5)

        _MODELS_LOADED = True
        print("[detection] NumPy inference models loaded successfully.")
    except Exception as e:
        print(f"[detection] Failed to load models: {e}. Using mock detection.")
        _MODELS_LOADED = False

def process_features(frame_number: int, frame_features: np.ndarray, tracker: LiveStreamTracker) -> Dict[str, Any]:
    """Process exactly 20 features through the models."""
    if not _MODELS_LOADED:
        result = process_frame_mock(frame_number)
        return apply_live_tracking(result, frame_features, tracker)
        
    frame_scaled = (frame_features.reshape(1, -1) - _runtime_models["scaler_mean"]) / _runtime_models["scaler_scale"]
    
    # Autoencoder prediction
    ae_error = float(_autoencoder.reconstruction_error(frame_scaled)[0])
    ae_alert = ae_error > _ae_threshold
    
    # Isolation Forest prediction
    if_score_raw = _isolation_forest_decision(frame_scaled[0], _runtime_models)
    if_alert = if_score_raw < 0
    
    # LOF prediction
    lof_score_raw = _lof_decision(frame_scaled[0], _runtime_models)
    lof_alert = lof_score_raw < 0
    
    # Ensemble voting: 2 of 3 = drowsy
    votes = sum([ae_alert, if_alert, lof_alert])
    is_drowsy = votes >= 2
    
    result = {
        "frame": frame_number,
        "ae_error": round(ae_error, 3),
        "ae_threshold": round(_ae_threshold, 3),
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
    return apply_live_tracking(result, frame_features, tracker)


def _average_path_length(size: int) -> float:
    if size <= 1:
        return 0.0
    if size == 2:
        return 1.0
    return 2.0 * (np.log(size - 1) + 0.5772156649015329) - 2.0 * (size - 1) / size


def _isolation_forest_decision(values: np.ndarray, model) -> float:
    total_depth = 0.0
    for tree_index in range(len(model["forest_node_counts"])):
        node = 0
        depth = 0
        while model["forest_left"][tree_index, node] >= 0:
            feature = model["forest_features"][tree_index, node]
            if values[feature] <= model["forest_thresholds"][tree_index, node]:
                node = int(model["forest_left"][tree_index, node])
            else:
                node = int(model["forest_right"][tree_index, node])
            depth += 1
        total_depth += depth + _average_path_length(int(model["forest_samples"][tree_index, node]))
    average_path = total_depth / len(model["forest_node_counts"])
    normalizer = _average_path_length(int(model["forest_max_samples"]))
    score_samples = -(2.0 ** (-average_path / normalizer)) if normalizer else -1.0
    return float(score_samples - float(model["forest_offset"]))


def _lof_decision(values: np.ndarray, model) -> float:
    training = model["lof_fit_X"]
    distances = np.sqrt(np.sum((training - values) ** 2, axis=1))
    count = min(int(model["lof_n_neighbors"]), len(training))
    nearest = np.argpartition(distances, count - 1)[:count]
    reachability = np.maximum(distances[nearest], model["lof_training_kdist"][nearest])
    local_density = 1.0 / (float(np.mean(reachability)) + 1e-10)
    lof = float(np.mean(model["lof_training_lrd"][nearest]) / local_density)
    return -lof - float(model["lof_offset"])

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
        "ae_threshold": round(0.75, 3),
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
        "status": "Detection API is running (browser landmarks + real models)" if _MODELS_LOADED else "Detection API is running (Mock)",
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
    tracker = LiveStreamTracker()
    try:
        while True:
            data = await websocket.receive_text()
            frame_count += 1
            
            try:
                payload = json.loads(data)
                raw_features = payload.get("features") if isinstance(payload, dict) else None
                if isinstance(payload, dict) and payload.get("face_detected") and isinstance(raw_features, list) and len(raw_features) == 20:
                    features = np.asarray(raw_features, dtype=np.float32)
                    result = process_features(frame_count, features, tracker)
                    record_frame(features, result["is_drowsy"])
                    if result["is_drowsy"] and not was_alerting:
                        _alert_logger.log_alert(frame_count, "DROWSY", result)
                    was_alerting = result["is_drowsy"]
                else:
                    tracker.reset_on_missing_face()
                    result = {
                        "frame": frame_count,
                        "ae_error": 0.0,
                        "ae_threshold": round(_ae_threshold, 3),
                        "if_score": 0.0,
                        "lof_score": 0.0,
                        "is_drowsy": False,
                        "votes": 0,
                        "face_detected": False,
                        "confidence": 0.0,
                        "model_alerts": {"autoencoder": False, "isolation_forest": False, "lof": False},
                        "live_signals": {"eye_closure": False, "yawn": False, "model_consensus": False},
                    }
                    record_frame()
                    was_alerting = False
                
                await websocket.send_json(result)
            except Exception as e:
                print(f"Error processing frame {frame_count}: {e}")
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
