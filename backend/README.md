# ChromaShift Backend

This is the backend API for the ChromaShift platform, built with FastAPI and Python.

## Tech Stack
- **Framework**: Python FastAPI (Async)
- **Database**: PostgreSQL (SQLAlchemy) + Redis (Caching)
- **Storage**: S3-compatible (MinIO)
- **Media Processing**: OpenCV + FFmpeg + ONNX Runtime

## Development

To run the backend locally with hot-reloading:

1. **Install dependencies**:
   Ensure you have [Poetry](https://python-poetry.org/) installed.
   ```bash
   poetry install
   ```

2. **Run the server**:
   ```bash
   poetry run uvicorn app.main:app --reload
   ```

The backend will be available at `http://localhost:8000`.

## API Documentation
Once the server is running, you can access the interactive documentation:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Environment Variables
The backend reads configuration from the `.env` file in the root directory. Key variables include:
- `POSTGRES_SERVER`: Database host
- `REDIS_HOST`: Redis host
- `MINIO_SERVER`: MinIO host and port
- `SECRET_KEY`: Used for JWT token generation

## Testing
To run the tests:
```bash
poetry run pytest
```
