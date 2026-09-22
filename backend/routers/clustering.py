import os
import joblib
import pandas as pd
from fastapi import APIRouter
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score, davies_bouldin_score
from typing import Dict, Any, List

router = APIRouter()

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "..", "saved_models")
DATA_DIR = os.path.join(BASE_DIR, "..", "data", "landmarks")

# Load real models and data on startup
try:
    _scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
    _pca = joblib.load(os.path.join(MODELS_DIR, "pca.pkl"))
    _kmeans = joblib.load(os.path.join(MODELS_DIR, "kmeans.pkl"))
    
    _full_df = pd.read_csv(os.path.join(DATA_DIR, "full_dataset.csv"))
    feature_cols = [c for c in _full_df.columns if c not in ["label", "label_name"]]
    _X_real = _full_df[feature_cols].values
    _true_labels_real = _full_df["label"].values
    
    _MODELS_LOADED = True
    print("[clustering] Loaded real models and data.")
except Exception as e:
    print(f"[clustering] Failed to load models or data: {e}. Falling back to synthetic mock data.")
    _MODELS_LOADED = False
    _scaler = None
    _pca = None
    _kmeans = None
    _X_real = None
    _true_labels_real = None

# Fallback synthetic data
np.random.seed(42)
alert_frames = np.random.normal(loc=0.3, scale=0.05, size=(350, 20))
transition_frames = np.random.normal(loc=0.2, scale=0.08, size=(100, 20))
drowsy_frames = np.random.normal(loc=0.1, scale=0.06, size=(50, 20))

X_mock = np.vstack([alert_frames, transition_frames, drowsy_frames])
true_labels_mock = np.array([0]*350 + [1]*100 + [2]*50)

def get_data():
    if _MODELS_LOADED:
        return _X_real, _true_labels_real
    return X_mock, true_labels_mock

@router.get("/pca")
async def get_pca() -> Dict[str, Any]:
    X, y = get_data()
    
    if _MODELS_LOADED:
        scaler = _scaler
        pca = _pca
    else:
        scaler = StandardScaler()
        pca = PCA(n_components=2)
        pca.fit(scaler.fit_transform(X))
        
    X_scaled = scaler.transform(X) if _MODELS_LOADED else scaler.fit_transform(X)
    X_pca = pca.transform(X_scaled) if _MODELS_LOADED else pca.fit_transform(X_scaled)
    
    # Take first two components for 2D plot
    points = [
        {"x": float(X_pca[i, 0]), "y": float(X_pca[i, 1]), "label": int(y[i])}
        for i in range(len(X_pca))
    ]
    
    return {
        "points": points,
        "variance_explained": [float(v) for v in pca.explained_variance_ratio_]
    }

@router.get("/kmeans")
async def get_kmeans() -> Dict[str, Any]:
    X, _ = get_data()
    
    if _MODELS_LOADED:
        scaler = _scaler
        X_scaled = scaler.transform(X)
        final_km = _kmeans
        optimal_k = final_km.n_clusters
        labels = final_km.predict(X_scaled)
        
        # Calculate elbow on real data to keep interface identical
        wcss_list = []
        for k in range(1, 8):
            km = KMeans(n_clusters=k, init='k-means++', random_state=42, n_init=10)
            km.fit(X_scaled)
            wcss_list.append(float(km.inertia_))
    else:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        wcss_list = []
        for k in range(1, 8):
            km = KMeans(n_clusters=k, init='k-means++', random_state=42, n_init=10)
            km.fit(X_scaled)
            wcss_list.append(float(km.inertia_))
            
        optimal_k = 3
        final_km = KMeans(n_clusters=optimal_k, init='k-means++', random_state=42, n_init=10)
        labels = final_km.fit_predict(X_scaled)
        
    silhouette = float(silhouette_score(X_scaled, labels))
    db_score = float(davies_bouldin_score(X_scaled, labels))
    wcss = float(final_km.inertia_)
    
    return {
        "elbow": wcss_list,
        "optimal_k": optimal_k,
        "silhouette_score": silhouette,
        "davies_bouldin_score": db_score,
        "wcss": wcss,
        "labels": labels.tolist()
    }

@router.get("/dbscan")
async def get_dbscan() -> Dict[str, Any]:
    X, _ = get_data()
    scaler = _scaler if _MODELS_LOADED else StandardScaler()
    X_scaled = scaler.transform(X) if _MODELS_LOADED else scaler.fit_transform(X)
    
    dbscan = DBSCAN(eps=0.8, min_samples=10)
    labels = dbscan.fit_predict(X_scaled)
    
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    noise_count = int(np.sum(labels == -1))
    core_count = int(len(labels) - noise_count)
    
    return {
        "labels": labels.tolist(),
        "noise_count": noise_count,
        "core_count": core_count,
        "n_clusters": n_clusters
    }

@router.get("/hierarchical")
async def get_hierarchical() -> Dict[str, Any]:
    X, _ = get_data()
    scaler = _scaler if _MODELS_LOADED else StandardScaler()
    X_scaled = scaler.transform(X) if _MODELS_LOADED else scaler.fit_transform(X)
    
    hc = AgglomerativeClustering(n_clusters=3, linkage='ward')
    labels = hc.fit_predict(X_scaled)
    
    silhouette = float(silhouette_score(X_scaled, labels))
    db_score = float(davies_bouldin_score(X_scaled, labels))
    
    return {
        "labels": labels.tolist(),
        "silhouette_score": silhouette,
        "davies_bouldin_score": db_score
    }

@router.get("/validation")
async def get_validation() -> Dict[str, Any]:
    # the frontend expects 'wcss_list' for /validation
    res = await get_kmeans()
    res["wcss_list"] = res.get("elbow", [])
    return res

