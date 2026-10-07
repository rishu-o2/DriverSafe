import json
import os
from fastapi import APIRouter
from utils.live_session import get_session, reset_session

router = APIRouter()
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "saved_models", "results.json")

def _load_results():
    try:
        with open(RESULTS_PATH, "r", encoding="utf-8") as results_file:
            return json.load(results_file)
    except (OSError, json.JSONDecodeError):
        return {}


def _roc_data(results):
    detection = results.get("detection", {})
    auc = detection.get("roc_auc")
    saved_curve = results.get("roc_curve")
    if isinstance(saved_curve, dict) and "fpr" in saved_curve and "tpr" in saved_curve:
        return {"fpr": saved_curve["fpr"], "tpr": saved_curve["tpr"], "auc": auc}
    return {"fpr": [], "tpr": [], "auc": auc}


def _detection_data(results):
    detection = results.get("detection", {})
    confusion = results.get("confusion", {})
    total = sum(confusion.get(key, 0) for key in ("tp", "fp", "fn", "tn"))
    accuracy = detection.get("accuracy")
    if accuracy is None and total:
        accuracy = (confusion.get("tp", 0) + confusion.get("tn", 0)) / total
    return {
        "f1_score": detection.get("f1_score"),
        "roc_auc": detection.get("roc_auc"),
        "precision": detection.get("precision"),
        "recall": detection.get("recall"),
        "accuracy": accuracy,
    }


def _confusion_data(results):
    confusion = results.get("confusion", {})
    return {
        "true_positive": confusion.get("tp"),
        "false_positive": confusion.get("fp"),
        "false_negative": confusion.get("fn"),
        "true_negative": confusion.get("tn"),
    }


@router.get("/clustering")
def get_clustering_metrics():
    return _load_results().get("clustering", {"silhouette": None, "davies_bouldin": None, "wcss": None, "optimal_k": None, "wcss_list": []})


@router.get("/detection")
async def get_detection_metrics() -> dict:
    d = _load_results().get("detection", {})
    if not d:
        return {"f1_score": None, "roc_auc": None, "precision": None, "recall": None, "accuracy": None}
    return {
        "f1_score": d.get("f1_score"),
        "roc_auc": d.get("roc_auc"),
        "precision": d.get("precision"),
        "recall": d.get("recall"),
        "accuracy": d.get("accuracy"),
    }


@router.get("/confusion")
def get_confusion_matrix():
    return _confusion_data(_load_results())


@router.get("/roc")
async def get_roc_curve() -> dict:
    return _roc_data(_load_results())


@router.get("/all")
def get_all_metrics():
    results = _load_results()
    return {
        "clustering": results.get("clustering", {"silhouette": None, "davies_bouldin": None, "wcss": None, "optimal_k": None, "wcss_list": []}),
        "detection": _detection_data(results),
        "confusion": results.get("confusion", {"tp": None, "fp": None, "fn": None, "tn": None}),
        "roc": _roc_data(results),
        "live": get_live_metrics(),
    }


@router.get("/live")
def get_live_metrics():
    session = get_session()
    live = session.compute_live_metrics()
    live_frames = len(session.recent_results)
    if live is not None:
        return {**live, "source": "live", "metric_kind": "live_stream_summary", "frames_needed": 0, "live_frames": live_frames}
    return {
        "f1_score": None,
        "roc_auc": None,
        "precision": None,
        "recall": None,
        "accuracy": None,
        "confusion": None,
        "source": "live",
        "metric_kind": "live_stream_summary",
        "frames_needed": 0,
        "live_frames": live_frames,
        "total_frames": live_frames,
        "drowsy_frames": 0,
        "alert_frames": 0,
    }


@router.get("/live/roc")
def get_live_roc():
    session = get_session()
    roc = session.compute_live_roc()
    if roc is not None:
        return {**roc, "source": "live", "metric_kind": "live_stream_summary"}
    return {"fpr": [], "tpr": [], "auc": None, "source": "live", "metric_kind": "live_stream_summary"}


@router.get("/live/timeline")
def get_live_timeline():
    timeline = get_session().get_live_ae_timeline()
    threshold = timeline[-1]["threshold"] if timeline else None
    return {"timeline": timeline, "threshold": threshold}


@router.post("/reset")
def reset_live_metrics():
    reset_session()
    return {"status": "session reset", "message": "Live metrics cleared"}
