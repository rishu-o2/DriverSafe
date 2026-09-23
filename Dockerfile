FROM python:3.10-slim

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
