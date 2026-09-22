import torch
import torch.nn as nn
import torch.optim as optim
from typing import Union
import numpy as np

class Autoencoder(nn.Module):
    def __init__(self):
        super(Autoencoder, self).__init__()
        
        self.encoder = nn.Sequential(
            nn.Linear(20, 16),
            nn.ReLU(),
            nn.Linear(16, 12),
            nn.ReLU(),
            nn.Linear(12, 8),
            nn.ReLU()
        )
        
        self.decoder = nn.Sequential(
            nn.Linear(8, 12),
            nn.ReLU(),
            nn.Linear(12, 16),
            nn.ReLU(),
            nn.Linear(16, 20)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded
    
    def compute_loss(self, x: torch.Tensor) -> torch.Tensor:
        reconstructed = self.forward(x)
        loss = nn.MSELoss()(reconstructed, x)
        return loss

    def fit(self, X: np.ndarray, epochs: int = 100, lr: float = 0.001):
        optimizer = optim.Adam(self.parameters(), lr=lr)
        tensor_X = torch.FloatTensor(X)
        
        self.train()
        for epoch in range(epochs):
            optimizer.zero_grad()
            loss = self.compute_loss(tensor_X)
            loss.backward()
            optimizer.step()
            
    def predict(self, X: Union[np.ndarray, torch.Tensor]) -> np.ndarray:
        self.eval()
        with torch.no_grad():
            if isinstance(X, np.ndarray):
                X_tensor = torch.FloatTensor(X)
            else:
                X_tensor = X
            
            reconstructed = self.forward(X_tensor)
            mse = torch.mean((X_tensor - reconstructed) ** 2, dim=1)
            return mse.numpy()
            
    def is_anomaly(self, x: Union[np.ndarray, torch.Tensor], threshold: float) -> bool:
        error = self.predict(x.reshape(1, -1) if isinstance(x, np.ndarray) and x.ndim == 1 else x)
        return bool(error[0] > threshold)
