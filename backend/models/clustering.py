from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score
import numpy as np
from typing import Dict, Any, List, Tuple

class ClusteringPipeline:
    def __init__(self):
        self.kmeans = KMeans(n_clusters=3, random_state=42)
        self.dbscan = DBSCAN(eps=0.8, min_samples=10)
        self.agglomerative = AgglomerativeClustering(n_clusters=3)
        self.pca = PCA(n_components=2)
        self.scaler = StandardScaler()
        
    def fit(self, X: np.ndarray):
        X_scaled = self.scaler.fit_transform(X)
        self.kmeans.fit(X_scaled)
        self.dbscan.fit(X_scaled)
        self.agglomerative.fit(X_scaled)
        self.pca.fit(X_scaled)
        return self
        
    def get_kmeans_labels(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return self.kmeans.predict(X_scaled)
        
    def get_dbscan_labels(self, X: np.ndarray) -> Tuple[np.ndarray, int]:
        X_scaled = self.scaler.transform(X)
        labels = self.dbscan.fit_predict(X_scaled)
        noise_count = int(np.sum(labels == -1))
        return labels, noise_count
        
    def get_hierarchical_labels(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return self.agglomerative.fit_predict(X_scaled)
        
    def get_pca_components(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return self.pca.transform(X_scaled)
        
    def get_validation_metrics(self, X: np.ndarray) -> Dict[str, float]:
        X_scaled = self.scaler.transform(X)
        labels = self.kmeans.predict(X_scaled)
        
        silhouette = float(silhouette_score(X_scaled, labels))
        db_score = float(davies_bouldin_score(X_scaled, labels))
        wcss = float(self.kmeans.inertia_)
        
        return {
            "silhouette": silhouette,
            "davies_bouldin": db_score,
            "wcss": wcss
        }
        
    def get_elbow_data(self, X: np.ndarray) -> List[float]:
        X_scaled = self.scaler.transform(X)
        wcss_list = []
        for k in range(1, 8):
            km = KMeans(n_clusters=k, random_state=42)
            km.fit(X_scaled)
            wcss_list.append(float(km.inertia_))
        return wcss_list
