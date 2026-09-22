from sklearn.ensemble import IsolationForest as SklearnIsolationForest
import numpy as np
import joblib

class IsolationForest:
    def __init__(self, n_estimators: int = 200, contamination: float = 0.05, random_state: int = 42):
        self.model = SklearnIsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state
        )
        
    def fit(self, X: np.ndarray):
        self.model.fit(X)
        return self
        
    def predict(self, X: np.ndarray) -> np.ndarray:
        # returns anomaly scores (lower is more anomalous, we can invert if needed, but sklearn predict gives -1 for anomaly)
        # We can also return decision_function (scores)
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
