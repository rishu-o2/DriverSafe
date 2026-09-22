import numpy as np
import pandas as pd
import os
import joblib
import json
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.metrics import (
    silhouette_score,
    davies_bouldin_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
    f1_score,
    precision_score,
    recall_score
)
import torch
import torch.nn as nn

# ─── Paths ───────────────────────────────────────────────
BASE_DIR    = os.path.dirname(__file__)
DATA_DIR    = os.path.join(BASE_DIR, "landmarks")
MODELS_DIR  = os.path.join(BASE_DIR, "..", "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── Autoencoder Architecture ────────────────────────────
class Autoencoder(nn.Module):
    def __init__(self, input_dim=20):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16), nn.ReLU(),
            nn.Linear(16, 12),        nn.ReLU(),
            nn.Linear(12, 8),         nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 12),         nn.ReLU(),
            nn.Linear(12, 16),        nn.ReLU(),
            nn.Linear(16, input_dim),
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

    def reconstruction_error(self, x):
        with torch.no_grad():
            recon = self.forward(x)
            return torch.mean((x - recon) ** 2, dim=1)

# ─── Load Data ───────────────────────────────────────────
def load_data():
    full_path  = os.path.join(DATA_DIR, "full_dataset.csv")
    train_path = os.path.join(DATA_DIR, "train_alert.csv")

    if not os.path.exists(full_path):
        print("Dataset not found! Run generate_dataset.py first.")
        return None, None, None, None

    full_df  = pd.read_csv(full_path)
    train_df = pd.read_csv(train_path)

    feature_cols = [c for c in full_df.columns
                    if c not in ["label", "label_name"]]

    X_train = train_df[feature_cols].values
    X_full  = full_df[feature_cols].values
    y_full  = full_df["label"].values

    print(f"Training data shape:  {X_train.shape}")
    print(f"Full dataset shape:   {X_full.shape}")
    return X_train, X_full, y_full, feature_cols

# ─── Train Preprocessing ─────────────────────────────────
def train_preprocessor(X_train):
    print("\nTraining preprocessor (Scaler + PCA)...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)

    pca = PCA(n_components=10)
    X_pca = pca.fit_transform(X_scaled)

    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(pca,    os.path.join(MODELS_DIR, "pca.pkl"))

    print(f"Scaler saved")
    print(f"PCA saved — variance explained: "
          f"{pca.explained_variance_ratio_.sum():.3f}")
    return scaler, pca, X_scaled, X_pca

# ─── Train Autoencoder ───────────────────────────────────
def train_autoencoder(X_train_scaled):
    print("\nTraining Autoencoder...")
    X_tensor = torch.FloatTensor(X_train_scaled)
    model    = Autoencoder(input_dim=X_train_scaled.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    model.train()
    losses = []
    for epoch in range(100):
        optimizer.zero_grad()
        output = model(X_tensor)
        loss   = criterion(output, X_tensor)
        loss.backward()
        optimizer.step()
        losses.append(loss.item())
        if (epoch + 1) % 20 == 0:
            print(f"  Epoch {epoch+1}/100 — Loss: {loss.item():.6f}")

    torch.save(model.state_dict(),
               os.path.join(MODELS_DIR, "autoencoder.pt"))

    # Compute threshold (95th percentile of training errors)
    model.eval()
    errors    = model.reconstruction_error(X_tensor).numpy()
    threshold = float(np.percentile(errors, 95))

    print(f"Autoencoder saved")
    print(f"Reconstruction error threshold: {threshold:.6f}")
    return model, threshold, losses

# ─── Train Isolation Forest ──────────────────────────────
def train_isolation_forest(X_train_scaled):
    print("\nTraining Isolation Forest...")
    iso_forest = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42
    )
    iso_forest.fit(X_train_scaled)
    joblib.dump(iso_forest,
                os.path.join(MODELS_DIR, "isolation_forest.pkl"))
    print("Isolation Forest saved")
    return iso_forest

# ─── Train LOF ───────────────────────────────────────────
def train_lof(X_train_scaled):
    print("\nTraining Local Outlier Factor...")
    lof = LocalOutlierFactor(
        n_neighbors=20,
        contamination=0.05,
        novelty=True
    )
    lof.fit(X_train_scaled)
    joblib.dump(lof, os.path.join(MODELS_DIR, "lof.pkl"))
    print("LOF saved")
    return lof

# ─── Train Clustering Models ─────────────────────────────
def train_clustering(X_train_scaled, X_full_scaled, y_full):
    print("\nTraining Clustering models...")

    # KMeans
    kmeans = KMeans(n_clusters=3, init="k-means++",
                    random_state=42, n_init=10)
    kmeans.fit(X_train_scaled)
    joblib.dump(kmeans, os.path.join(MODELS_DIR, "kmeans.pkl"))

    # DBSCAN (no save needed — fit on full data)
    dbscan = DBSCAN(eps=0.8, min_samples=10)
    dbscan_labels = dbscan.fit_predict(X_full_scaled)

    # Hierarchical
    hier = AgglomerativeClustering(n_clusters=3, linkage="ward")
    hier_labels = hier.fit_predict(X_full_scaled)

    # Elbow method
    wcss_list = []
    for k in range(1, 8):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        km.fit(X_train_scaled)
        wcss_list.append(float(km.inertia_))

    # Validation metrics
    km_labels = kmeans.predict(X_full_scaled)
    sil       = float(silhouette_score(X_full_scaled, km_labels))
    db        = float(davies_bouldin_score(X_full_scaled, km_labels))
    wcss      = float(kmeans.inertia_)

    print(f"KMeans saved")
    print(f"Silhouette Score:    {sil:.3f}")
    print(f"Davies-Bouldin:      {db:.3f}")
    print(f"WCSS (Inertia):      {wcss:.2f}")
    print(f"DBSCAN noise points: {np.sum(dbscan_labels == -1)}")

    return {
        "kmeans":          kmeans,
        "dbscan_labels":   dbscan_labels.tolist(),
        "hier_labels":     hier_labels.tolist(),
        "silhouette":      round(sil, 3),
        "davies_bouldin":  round(db, 3),
        "wcss":            round(wcss, 2),
        "wcss_list":       [round(w, 2) for w in wcss_list],
        "optimal_k":       3
    }

# ─── Evaluate Models ─────────────────────────────────────
def evaluate_models(model_ae, iso_forest, lof,
                    threshold, X_full_scaled, y_full):
    print("\nEvaluating all models...")

    # Autoencoder predictions
    X_tensor  = torch.FloatTensor(X_full_scaled)
    ae_errors = model_ae.reconstruction_error(X_tensor).numpy()
    ae_preds  = (ae_errors > threshold).astype(int)

    # Isolation Forest predictions
    if_preds_raw = iso_forest.predict(X_full_scaled)
    if_preds     = (if_preds_raw == -1).astype(int)

    # LOF predictions
    lof_preds_raw = lof.predict(X_full_scaled)
    lof_preds     = (lof_preds_raw == -1).astype(int)

    # Ground truth: drowsy (label=2) = anomaly
    y_binary = (y_full == 2).astype(int)

    # Ensemble: 2 of 3 = anomaly
    ensemble = ((ae_preds + if_preds + lof_preds) >= 2).astype(int)

    def safe_metrics(y_true, y_pred):
        try:
            return {
                "f1":        round(float(f1_score(y_true, y_pred, zero_division=0)), 3),
                "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 3),
                "recall":    round(float(recall_score(y_true, y_pred, zero_division=0)), 3),
                "roc_auc":   round(float(roc_auc_score(y_true, y_pred)), 3),
            }
        except Exception:
            return {"f1": 0, "precision": 0, "recall": 0, "roc_auc": 0}

    ae_metrics  = safe_metrics(y_binary, ae_preds)
    if_metrics  = safe_metrics(y_binary, if_preds)
    lof_metrics = safe_metrics(y_binary, lof_preds)
    ens_metrics = safe_metrics(y_binary, ensemble)

    cm = confusion_matrix(y_binary, ensemble)
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)

    print(f"Autoencoder  — F1: {ae_metrics['f1']:.3f} "
          f"AUC: {ae_metrics['roc_auc']:.3f}")
    print(f"Iso. Forest  — F1: {if_metrics['f1']:.3f} "
          f"AUC: {if_metrics['roc_auc']:.3f}")
    print(f"LOF          — F1: {lof_metrics['f1']:.3f} "
          f"AUC: {lof_metrics['roc_auc']:.3f}")
    print(f"Ensemble     — F1: {ens_metrics['f1']:.3f} "
          f"AUC: {ens_metrics['roc_auc']:.3f}")
    print(f"Confusion Matrix: TP={tp} FP={fp} FN={fn} TN={tn}")

    return {
        "autoencoder":     ae_metrics,
        "isolation_forest": if_metrics,
        "lof":             lof_metrics,
        "ensemble":        ens_metrics,
        "confusion": {
            "tp": int(tp), "fp": int(fp),
            "fn": int(fn), "tn": int(tn)
        },
        "ae_threshold": round(float(threshold), 6)
    }

# ─── Save Results ─────────────────────────────────────────
def save_results(clustering_results, eval_results):
    results = {
        "clustering": {
            "silhouette":     clustering_results["silhouette"],
            "davies_bouldin": clustering_results["davies_bouldin"],
            "wcss":           clustering_results["wcss"],
            "wcss_list":      clustering_results["wcss_list"],
            "optimal_k":      3
        },
        "detection": {
            "f1_score":   eval_results["ensemble"]["f1"],
            "roc_auc":    eval_results["ensemble"]["roc_auc"],
            "precision":  eval_results["ensemble"]["precision"],
            "recall":     eval_results["ensemble"]["recall"],
        },
        "confusion":  eval_results["confusion"],
        "ae_threshold": eval_results["ae_threshold"],
        "model_comparison": {
            "autoencoder":      eval_results["autoencoder"],
            "isolation_forest": eval_results["isolation_forest"],
            "lof":              eval_results["lof"],
            "ensemble":         eval_results["ensemble"]
        }
    }

    results_path = os.path.join(MODELS_DIR, "results.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to: {results_path}")
    return results

# ─── Main ────────────────────────────────────────────────
def main():
    print("=" * 50)
    print("DriverSafe — Model Training Pipeline")
    print("=" * 50)

    # Load data
    X_train, X_full, y_full, features = load_data()
    if X_train is None:
        return

    # Preprocess
    scaler, pca, X_train_scaled, _ = train_preprocessor(X_train)
    X_full_scaled = scaler.transform(X_full)

    # Train all models
    model_ae, threshold, losses = train_autoencoder(X_train_scaled)
    iso_forest = train_isolation_forest(X_train_scaled)
    lof        = train_lof(X_train_scaled)
    clustering = train_clustering(
        X_train_scaled, X_full_scaled, y_full
    )

    # Evaluate
    eval_results = evaluate_models(
        model_ae, iso_forest, lof,
        threshold, X_full_scaled, y_full
    )

    # Save results
    results = save_results(clustering, eval_results)

    print("\n" + "=" * 50)
    print("Training Complete!")
    print("=" * 50)
    print(f"Models saved in: {MODELS_DIR}")
    print("\nFinal Results:")
    print(f"  Silhouette Score:  {results['clustering']['silhouette']}")
    print(f"  Davies-Bouldin:    {results['clustering']['davies_bouldin']}")
    print(f"  F1-Score:          {results['detection']['f1_score']}")
    print(f"  ROC-AUC:           {results['detection']['roc_auc']}")

if __name__ == "__main__":
    main()
