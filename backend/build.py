from pathlib import Path


def main() -> None:
    model_dir = Path(__file__).parent / "saved_models"
    required = ("runtime_models.npz", "autoencoder.npz", "results.json")
    missing = [name for name in required if not (model_dir / name).is_file()]
    if missing:
        raise SystemExit(f"Missing production model artifacts: {', '.join(missing)}")
    print("Verified compact NumPy inference artifacts.")


if __name__ == "__main__":
    main()
