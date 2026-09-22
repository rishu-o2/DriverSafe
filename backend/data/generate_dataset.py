import numpy as np
import pandas as pd
import os

# ─── Config ──────────────────────────────────────────────
np.random.seed(42)
SAVE_PATH = os.path.dirname(__file__)
os.makedirs(os.path.join(SAVE_PATH, "landmarks"), exist_ok=True)

# ─── Feature names (20 key facial features) ──────────────
FEATURE_NAMES = [
    "left_eye_ear",        # Eye Aspect Ratio - Left
    "right_eye_ear",       # Eye Aspect Ratio - Right
    "avg_ear",             # Average EAR
    "mar",                 # Mouth Aspect Ratio
    "left_brow_height",    # Left eyebrow height
    "right_brow_height",   # Right eyebrow height
    "head_tilt_x",         # Head tilt horizontal
    "head_tilt_y",         # Head tilt vertical
    "nose_tip_y",          # Nose tip position
    "left_pupil_x",        # Left pupil x
    "left_pupil_y",        # Left pupil y
    "right_pupil_x",       # Right pupil x
    "right_pupil_y",       # Right pupil y
    "jaw_open",            # Jaw openness
    "left_eye_open",       # Left eye openness
    "right_eye_open",      # Right eye openness
    "mouth_corner_left",   # Mouth corner left
    "mouth_corner_right",  # Mouth corner right
    "forehead_crease",     # Forehead tension
    "chin_position",       # Chin drop indicator
]

def generate_alert_data(n_samples=1000):
    """
    Alert driver:
    - Eyes wide open (high EAR ~0.30-0.35)
    - Mouth closed (low MAR ~0.10-0.20)
    - Head upright (low tilt)
    - Stable pupil positions
    """
    data = np.zeros((n_samples, 20))

    # Eye features (high values = open eyes)
    data[:, 0] = np.random.normal(0.32, 0.03, n_samples)   # left EAR
    data[:, 1] = np.random.normal(0.31, 0.03, n_samples)   # right EAR
    data[:, 2] = np.random.normal(0.315, 0.02, n_samples)  # avg EAR
    data[:, 3] = np.random.normal(0.12, 0.04, n_samples)   # MAR (closed)
    data[:, 4] = np.random.normal(0.75, 0.05, n_samples)   # left brow high
    data[:, 5] = np.random.normal(0.74, 0.05, n_samples)   # right brow high
    data[:, 6] = np.random.normal(0.02, 0.02, n_samples)   # head tilt x (stable)
    data[:, 7] = np.random.normal(0.01, 0.02, n_samples)   # head tilt y (stable)
    data[:, 8] = np.random.normal(0.50, 0.03, n_samples)   # nose tip centered
    data[:, 9] = np.random.normal(0.35, 0.02, n_samples)   # left pupil x
    data[:, 10] = np.random.normal(0.48, 0.02, n_samples)  # left pupil y
    data[:, 11] = np.random.normal(0.65, 0.02, n_samples)  # right pupil x
    data[:, 12] = np.random.normal(0.48, 0.02, n_samples)  # right pupil y
    data[:, 13] = np.random.normal(0.10, 0.03, n_samples)  # jaw closed
    data[:, 14] = np.random.normal(0.80, 0.04, n_samples)  # left eye open
    data[:, 15] = np.random.normal(0.79, 0.04, n_samples)  # right eye open
    data[:, 16] = np.random.normal(0.30, 0.02, n_samples)  # mouth corner L
    data[:, 17] = np.random.normal(0.70, 0.02, n_samples)  # mouth corner R
    data[:, 18] = np.random.normal(0.20, 0.03, n_samples)  # forehead relaxed
    data[:, 19] = np.random.normal(0.50, 0.02, n_samples)  # chin stable

    return np.clip(data, 0, 1)

def generate_transition_data(n_samples=300):
    """
    Transitioning driver:
    - Eyes partially closed (medium EAR ~0.20-0.25)
    - Occasional yawns
    - Slight head movement
    """
    data = np.zeros((n_samples, 20))

    data[:, 0] = np.random.normal(0.22, 0.04, n_samples)   # left EAR dropping
    data[:, 1] = np.random.normal(0.21, 0.04, n_samples)   # right EAR dropping
    data[:, 2] = np.random.normal(0.215, 0.03, n_samples)  # avg EAR
    data[:, 3] = np.random.normal(0.35, 0.10, n_samples)   # MAR varies (yawning)
    data[:, 4] = np.random.normal(0.60, 0.08, n_samples)   # brow lowering
    data[:, 5] = np.random.normal(0.59, 0.08, n_samples)   # brow lowering
    data[:, 6] = np.random.normal(0.08, 0.05, n_samples)   # head tilting
    data[:, 7] = np.random.normal(0.10, 0.06, n_samples)   # head drooping
    data[:, 8] = np.random.normal(0.50, 0.06, n_samples)   # nose position
    data[:, 9] = np.random.normal(0.35, 0.04, n_samples)   # pupil x
    data[:, 10] = np.random.normal(0.52, 0.05, n_samples)  # pupil y drooping
    data[:, 11] = np.random.normal(0.65, 0.04, n_samples)  # pupil x
    data[:, 12] = np.random.normal(0.52, 0.05, n_samples)  # pupil y drooping
    data[:, 13] = np.random.normal(0.25, 0.08, n_samples)  # jaw slightly open
    data[:, 14] = np.random.normal(0.55, 0.08, n_samples)  # left eye half open
    data[:, 15] = np.random.normal(0.54, 0.08, n_samples)  # right eye half open
    data[:, 16] = np.random.normal(0.30, 0.03, n_samples)  # mouth corner L
    data[:, 17] = np.random.normal(0.70, 0.03, n_samples)  # mouth corner R
    data[:, 18] = np.random.normal(0.30, 0.05, n_samples)  # forehead slight
    data[:, 19] = np.random.normal(0.55, 0.05, n_samples)  # chin dropping

    return np.clip(data, 0, 1)

def generate_drowsy_data(n_samples=200):
    """
    Drowsy driver:
    - Eyes nearly closed (low EAR ~0.10-0.15)
    - Mouth open (high MAR ~0.50-0.70)
    - Head drooping (high tilt)
    - Unstable pupil positions
    """
    data = np.zeros((n_samples, 20))

    data[:, 0] = np.random.normal(0.12, 0.04, n_samples)   # left EAR very low
    data[:, 1] = np.random.normal(0.11, 0.04, n_samples)   # right EAR very low
    data[:, 2] = np.random.normal(0.115, 0.03, n_samples)  # avg EAR very low
    data[:, 3] = np.random.normal(0.60, 0.12, n_samples)   # MAR high (yawning)
    data[:, 4] = np.random.normal(0.40, 0.10, n_samples)   # brow very low
    data[:, 5] = np.random.normal(0.39, 0.10, n_samples)   # brow very low
    data[:, 6] = np.random.normal(0.15, 0.08, n_samples)   # head tilted
    data[:, 7] = np.random.normal(0.25, 0.10, n_samples)   # head drooping
    data[:, 8] = np.random.normal(0.55, 0.08, n_samples)   # nose dropping
    data[:, 9] = np.random.normal(0.35, 0.06, n_samples)   # pupil x
    data[:, 10] = np.random.normal(0.60, 0.08, n_samples)  # pupil y very low
    data[:, 11] = np.random.normal(0.65, 0.06, n_samples)  # pupil x
    data[:, 12] = np.random.normal(0.60, 0.08, n_samples)  # pupil y very low
    data[:, 13] = np.random.normal(0.50, 0.12, n_samples)  # jaw open
    data[:, 14] = np.random.normal(0.20, 0.08, n_samples)  # left eye nearly closed
    data[:, 15] = np.random.normal(0.19, 0.08, n_samples)  # right eye nearly closed
    data[:, 16] = np.random.normal(0.28, 0.04, n_samples)  # mouth corner L
    data[:, 17] = np.random.normal(0.72, 0.04, n_samples)  # mouth corner R
    data[:, 18] = np.random.normal(0.45, 0.08, n_samples)  # forehead tense
    data[:, 19] = np.random.normal(0.65, 0.08, n_samples)  # chin dropped

    return np.clip(data, 0, 1)

def generate_and_save():
    print("Generating synthetic facial landmark dataset...")

    # Generate data
    alert_data      = generate_alert_data(1000)
    transition_data = generate_transition_data(300)
    drowsy_data     = generate_drowsy_data(200)

    # Create labels
    alert_labels      = np.zeros(1000)       # 0 = alert
    transition_labels = np.ones(300)          # 1 = transition
    drowsy_labels     = np.full(200, 2)       # 2 = drowsy

    # Combine all data
    X = np.vstack([alert_data, transition_data, drowsy_data])
    y = np.concatenate([alert_labels, transition_labels, drowsy_labels])

    # Create DataFrame
    df = pd.DataFrame(X, columns=FEATURE_NAMES)
    df["label"] = y.astype(int)
    df["label_name"] = df["label"].map({
        0: "alert",
        1: "transition",
        2: "drowsy"
    })

    # Save full dataset
    full_path = os.path.join(SAVE_PATH, "landmarks", "full_dataset.csv")
    df.to_csv(full_path, index=False)
    print(f"Full dataset saved: {full_path}")
    print(f"Shape: {df.shape}")
    print(f"Label distribution:\n{df['label_name'].value_counts()}")

    # Save training data (alert only — for autoencoder)
    train_df = df[df["label"] == 0][FEATURE_NAMES]
    train_path = os.path.join(SAVE_PATH, "landmarks", "train_alert.csv")
    train_df.to_csv(train_path, index=False)
    print(f"\nTraining data (alert only) saved: {train_path}")
    print(f"Training shape: {train_df.shape}")

    # Save test data (all classes — for evaluation)
    test_path = os.path.join(SAVE_PATH, "landmarks", "test_dataset.csv")
    df.to_csv(test_path, index=False)
    print(f"Test dataset saved: {test_path}")

    return df

if __name__ == "__main__":
    df = generate_and_save()
    print("\nDataset generation complete!")
    print(f"Total samples: {len(df)}")
    print(f"Features: {len(FEATURE_NAMES)}")
    print("\nSample data (first 5 rows):")
    print(df.head())
    print("\nStatistics:")
    print(df[FEATURE_NAMES].describe().round(3))
