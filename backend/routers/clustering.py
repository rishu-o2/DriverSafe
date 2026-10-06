import csv
import os
from typing import Any, Dict

import numpy as np
from fastapi import APIRouter

from utils.live_session import get_features
from utils.numpy_ml import (
    agglomerative_ward,
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
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "landmarks", "full_dataset.csv")

try:
    _models = np.load(os.path.join(MODELS_DIR, "runtime_models.npz"))
    _MODELS_LOADED = True
except Exception as exc:
    print(f"[clustering] Runtime models unavailable: {exc}; clustering will fit from session data.")
    _models = None
    _MODELS_LOADED = False

try:
    with open(DATA_PATH, newline="", encoding="utf-8") as data_file:
        rows = list(csv.DictReader(data_file))
    _feature_columns = [name for name in rows[0] if name not in ("label", "label_name")]
    _X_real = np.asarray([[float(row[name]) for name in _feature_columns] for row in rows], dtype=np.float64)
    _true_labels_real = np.asarray([int(row["label"]) for row in rows], dtype=int)
    _DATA_LOADED = True
except Exception as exc:
    print(f"[clustering] Dataset unavailable: {exc}; using generated demonstration points.")
    _DATA_LOADED = False
    rng = np.random.default_rng(42)
    _X_real = np.vstack((
        rng.normal(0.3, 0.05, (350, 20)),
        rng.normal(0.2, 0.08, (100, 20)),
        rng.normal(0.1, 0.06, (50, 20)),
    ))
    _true_labels_real = np.array([0] * 350 + [1] * 100 + [2] * 50)


def _scaled(values: np.ndarray) -> np.ndarray:
    if _MODELS_LOADED:
        return standardize(values, _models["scaler_mean"], _models["scaler_scale"])
    mean = values.mean(axis=0)
    scale = values.std(axis=0)
    scale[scale == 0] = 1.0
    return standardize(values, mean, scale)


def _project(values: np.ndarray) -> tuple[np.ndarray, list[float]]:
    scaled = _scaled(values)
    if _MODELS_LOADED:
        points = pca_transform(scaled, _models["pca_mean"], _models["pca_components"])
        variance = _models["pca_variance"].tolist()
    else:
        centered = scaled - scaled.mean(axis=0)
        _, singular_values, right = np.linalg.svd(centered, full_matrices=False)
        points = centered @ right[:2].T
        variance = (singular_values[:2] ** 2 / max(float(np.sum(singular_values ** 2)), 1e-12)).tolist()
    return points, [float(value) for value in variance]


@router.get("/pca")
async def get_pca() -> Dict[str, Any]:
    points_2d, variance = _project(_X_real)
    points = [
        {"x": float(point[0]), "y": float(point[1]), "label": int(_true_labels_real[index])}
        for index, point in enumerate(points_2d)
    ]
    return {"points": points, "variance_explained": variance}


@router.get("/live")
async def get_live_points() -> Dict[str, Any]:
    features = get_features()
    if not features:
        return {"points": [], "count": 0}
    values = np.asarray(features, dtype=np.float64)
    if len(values) < 3:
        return {"points": [], "count": 0}
    scaled = _scaled(values)
    if _MODELS_LOADED:
        projection = pca_transform(scaled, _models["pca_mean"], _models["pca_components"])
        labels = kmeans_predict(scaled, _models["kmeans_centers"])
    else:
        centered = scaled - scaled.mean(axis=0)
        _, _, right = np.linalg.svd(centered, full_matrices=False)
        projection = centered @ right[:2].T
        _, labels, _ = kmeans_fit(scaled, 3)
    density_labels = dbscan(scaled, eps=0.8, min_samples=10)
    points = [
        {"x": float(projection[i, 0]), "y": float(projection[i, 1]), "label": int(labels[i]), "density_label": int(density_labels[i])}
        for i in range(len(projection))
    ]
    return {"points": points, "count": len(points)}


@router.get("/kmeans")
async def get_kmeans() -> Dict[str, Any]:
    scaled = _scaled(_X_real)
    if _MODELS_LOADED:
        centers = _models["kmeans_centers"]
        labels = kmeans_predict(scaled, centers)
        optimal_k = len(centers)
        wcss = float(_models["kmeans_inertia"])
    else:
        centers, labels, wcss = kmeans_fit(scaled, 3)
        optimal_k = len(centers)
    wcss_list = [kmeans_fit(scaled, k, n_init=2, max_iter=60)[2] for k in range(1, 8)]
    return {
        "elbow": [float(value) for value in wcss_list],
        "optimal_k": int(optimal_k),
        "silhouette_score": silhouette_score(scaled, labels),
        "davies_bouldin_score": davies_bouldin_score(scaled, labels),
        "wcss": wcss,
        "labels": labels.tolist(),
    }


@router.get("/dbscan")
async def get_dbscan() -> Dict[str, Any]:
    labels = dbscan(_scaled(_X_real), eps=0.8, min_samples=10)
    n_clusters = len(set(labels.tolist()) - {-1})
    noise_count = int(np.sum(labels == -1))
    return {"labels": labels.tolist(), "noise_count": noise_count, "core_count": int(len(labels) - noise_count), "n_clusters": n_clusters}


@router.get("/hierarchical")
async def get_hierarchical() -> Dict[str, Any]:
    scaled = _scaled(_X_real)
    labels = agglomerative_ward(scaled, n_clusters=3)
    return {
        "labels": labels.tolist(),
        "silhouette_score": silhouette_score(scaled, labels),
        "davies_bouldin_score": davies_bouldin_score(scaled, labels),
    }


@router.get("/validation")
async def get_validation() -> Dict[str, Any]:
    result = await get_kmeans()
    result["wcss_list"] = result["elbow"]
    return result
