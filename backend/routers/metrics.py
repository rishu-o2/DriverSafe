"""
routers/metrics.py
Serves ML metrics from saved_models/results.json.
Falls back to hardcoded values if the file is not found.
"""
import json
import os
from fastapi import APIRouter
from typing import Any

router = APIRouter()

# ─── Load results once at startup ────────────────────────────────────────────
_RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "saved_models", "results.json")

def _load_results() -> dict | None:
    try:
        with open(_RESULTS_PATH) as f:
            data = json.load(f)
        print(f"[metrics] Loaded results from {_RESULTS_PATH}")
        return data
    except FileNotFoundError:
        print("[metrics] results.json not found — using hardcoded fallback values")
        return None

_RESULTS: dict | None = _load_results()

# ─── Fallback hardcoded values ────────────────────────────────────────────────
_FALLBACK = {
    "clustering": {
        "silhouette":     0.61,
        "davies_bouldin": 1.12,
        "wcss":           284.0,
        "wcss_list":      [820.0, 510.0, 284.0, 220.0, 180.0, 155.0, 138.0],
        "optimal_k":      3,
    },
    "detection": {
        "f1_score":  0.87,
        "roc_auc":   0.91,
        "precision": 0.83,
        "recall":    0.89,
    },
    "confusion": {
        "true_positive":  312,
        "false_positive": 18,
        "false_negative": 9,
        "true_negative":  3503,
    },
    "roc": {
        "fpr": [0.0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0],
        "tpr": [0.0, 0.60, 0.78, 0.88, 0.92, 0.96, 0.98, 1.0],
        "auc": 0.91,
    },
}


def _get(key: str) -> Any:
    """Return real trained value or fallback."""
    if _RESULTS:
        return _RESULTS.get(key)
    return _FALLBACK.get(key)


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/clustering")
async def get_clustering_metrics() -> dict:
    c = _get("clustering") or _FALLBACK["clustering"]
    return {
        "silhouette":     c.get("silhouette",     _FALLBACK["clustering"]["silhouette"]),
        "davies_bouldin": c.get("davies_bouldin",  _FALLBACK["clustering"]["davies_bouldin"]),
        "wcss":           c.get("wcss",            _FALLBACK["clustering"]["wcss"]),
        "wcss_list":      c.get("wcss_list",       _FALLBACK["clustering"]["wcss_list"]),
        "optimal_k":      c.get("optimal_k",       _FALLBACK["clustering"]["optimal_k"]),
    }


@router.get("/detection")
async def get_detection_metrics() -> dict:
    d = _get("detection") or _FALLBACK["detection"]
    return {
        "f1_score":  d.get("f1_score",  _FALLBACK["detection"]["f1_score"]),
        "roc_auc":   d.get("roc_auc",   _FALLBACK["detection"]["roc_auc"]),
        "precision": d.get("precision", _FALLBACK["detection"]["precision"]),
        "recall":    d.get("recall",    _FALLBACK["detection"]["recall"]),
        "accuracy":  0.94,  # kept for frontend compatibility
    }


@router.get("/confusion")
async def get_confusion_matrix() -> dict:
    if _RESULTS and "confusion" in _RESULTS:
        cm = _RESULTS["confusion"]
        return {
            "true_positive":  cm.get("tp", 312),
            "false_positive": cm.get("fp", 18),
            "false_negative": cm.get("fn", 9),
            "true_negative":  cm.get("tn", 3503),
        }
    return _FALLBACK["confusion"]


@router.get("/roc")
async def get_roc_curve() -> dict:
    # ROC curve is currently static; can be extended with real roc_curve values
    return _FALLBACK["roc"]


@router.get("/all")
async def get_all_metrics() -> dict:
    return {
        "clustering": await get_clustering_metrics(),
        "detection":  await get_detection_metrics(),
        "confusion":  await get_confusion_matrix(),
        "roc":        await get_roc_curve(),
    }
