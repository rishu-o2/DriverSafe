FROM python:3.10-slim

# Install system libraries required by OpenCV and MediaPipe on slim Debian image
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory to the backend folder inside the container
WORKDIR /code/backend

# Copy just the requirements first (better Docker caching)
COPY ./backend/requirements.txt /code/backend/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir --upgrade -r /code/backend/requirements.txt

# Copy the rest of the backend code
COPY ./backend /code/backend

# Railway injects PORT env var dynamically — use shell form so $PORT is expanded
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
