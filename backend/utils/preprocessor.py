from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import numpy as np
import joblib

class DataPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95) # keep 95% variance
        
    def fit(self, X: np.ndarray):
        X_scaled = self.scaler.fit_transform(X)
        self.pca.fit(X_scaled)
        return self
        
    def transform(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return self.pca.transform(X_scaled)
        
    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.fit_transform(X)
        return self.pca.fit_transform(X_scaled)
        
    def inverse_transform(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.pca.inverse_transform(X)
        return self.scaler.inverse_transform(X_scaled)
        
    def save(self, path: str):
        joblib.dump({"scaler": self.scaler, "pca": self.pca}, path)
        
    def load(self, path: str):
        data = joblib.load(path)
        self.scaler = data["scaler"]
        self.pca = data["pca"]
        return self
