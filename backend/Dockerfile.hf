FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for OpenCV, ONNX Runtime, and FFMPEG video processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry

# Copy project files
COPY pyproject.toml poetry.lock* ./

# Configure poetry to not create a virtual environment inside the container
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-interaction --no-ansi

# Set up a new user named "user" with UID 1000 (required for Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

# Set working directory
WORKDIR $HOME/app

# Copy the rest of the application and set ownership
COPY --chown=user . $HOME/app

# Expose the port used by HF Spaces
EXPOSE 7860

# Run migrations and start the server
CMD ["sh", "-c", "alembic upgrade head || echo 'Database migrations failed, starting server anyway...'; uvicorn app.main:app --host 0.0.0.0 --port 7860"]
