import os
from typing import Any

import numpy as np
from fastapi import APIRouter

from utils.live_session import get_session
from utils.numpy_ml import (
    davies_bouldin_score,
    dbscan,
    kmeans_fit,
    kmeans_predict,
    pca_transform,
    silhouette_score,
    standardize,
)

router = APIRouter()
BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "..", "saved_models")
try:
    _models = np.load(os.path.join(MODELS_DIR, "runtime_models.npz"))
except (OSError, ValueError):
    _models = None


def _scale(values: np.ndarray) -> np.ndarray:
    if _models is not None:
        return standardize(values, _models["scaler_mean"], _models["scaler_scale"])
    mean = values.mean(axis=0)
    scale = values.std(axis=0)
    scale[scale == 0] = 1.0
    return standardize(values, mean, scale)


@router.get("/live")
def get_live_clusters() -> dict[str, Any]:
    features = get_session().get_features()
    if len(features) < 3:
        return {"points": [], "count": len(features), "source": "live"}
    values = np.asarray(features, dtype=np.float64)
    scaled = _scale(values)
    if _models is not None:
        projected = pca_transform(scaled, _models["pca_mean"], _models["pca_components"])
        labels = kmeans_predict(scaled, _models["kmeans_centers"])
    else:
        centered = scaled - scaled.mean(axis=0)
        _, _, right = np.linalg.svd(centered, full_matrices=False)
        projected = centered @ right[:2].T
        _, labels, _ = kmeans_fit(scaled, 3)
    density_labels = dbscan(scaled, eps=0.8, min_samples=10)
    points = [
        {"x": float(projected[index, 0]), "y": float(projected[index, 1]), "label": int(labels[index]), "density_label": int(density_labels[index])}
        for index in range(len(values))
    ]
    return {"points": points, "count": len(points), "source": "live"}


@router.get("/live/validation")
def get_live_cluster_validation() -> dict[str, Any]:
    features = get_session().get_features()
    if len(features) < 10:
        return {"silhouette_score": None, "davies_bouldin_score": None, "source": "live", "count": len(features)}
    scaled = _scale(np.asarray(features, dtype=np.float64))
    if _models is not None:
        labels = kmeans_predict(scaled, _models["kmeans_centers"])
    else:
        _, labels, _ = kmeans_fit(scaled, 3)
    distinct = np.unique(labels)
    if len(distinct) < 2 or len(distinct) >= len(labels):
        return {"silhouette_score": None, "davies_bouldin_score": None, "source": "live", "count": len(features)}
    return {
        "silhouette_score": round(silhouette_score(scaled, labels), 3),
        "davies_bouldin_score": round(davies_bouldin_score(scaled, labels), 3),
        "source": "live",
        "count": len(features),
    }
