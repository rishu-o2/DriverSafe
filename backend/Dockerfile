FROM python:3.10-slim

WORKDIR /code

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# MediaPipe pulls in opencv-python as a dependency which requires libGL.
# Replace with opencv-python-headless to ensure it runs cleanly without display/X11 libraries.
RUN pip uninstall -y opencv-python opencv-contrib-python 2>/dev/null || true && \
    pip install --no-cache-dir opencv-python-headless

# Copy the backend code
COPY . /code

# Dynamic PORT support for Railway, Render, Hugging Face, or local Docker
ENV PORT=8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
