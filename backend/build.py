import subprocess
import sys


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=check)


def main() -> None:
    # MediaPipe installs desktop OpenCV alongside the headless wheel. Remove
    # those conflicting packages, then restore the headless wheel explicitly.
    run(
        sys.executable,
        "-m",
        "pip",
        "uninstall",
        "-y",
        "opencv-python",
        "opencv-contrib-python",
        "opencv-python-headless",
        "opencv-contrib-python-headless",
        check=False,
    )
    run(
        sys.executable,
        "-m",
        "pip",
        "install",
        "--no-deps",
        "opencv-python-headless>=4.9.0",
    )


if __name__ == "__main__":
    main()
