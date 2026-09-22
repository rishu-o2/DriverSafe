from sklearn.neighbors import LocalOutlierFactor as SklearnLOF
import numpy as np
import joblib

class LocalOutlierFactor:
    def __init__(self, n_neighbors: int = 20, contamination: float = 0.05, novelty: bool = True):
        self.model = SklearnLOF(
            n_neighbors=n_neighbors,
            contamination=contamination,
            novelty=novelty
        )
        
    def fit(self, X: np.ndarray):
        self.model.fit(X)
        return self
        
    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.decision_function(X)
        
    def is_anomaly(self, x: np.ndarray) -> bool:
        x_reshaped = x.reshape(1, -1) if x.ndim == 1 else x
        prediction = self.model.predict(x_reshaped)
        return bool(prediction[0] == -1)
        
    def save(self, path: str):
        joblib.dump(self.model, path)
        
    def load(self, path: str):
        self.model = joblib.load(path)
        return self
