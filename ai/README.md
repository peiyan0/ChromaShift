# ChromaShift AI/ML Workspace

This directory contains the core **AI algorithms and processing pipelines** for the ChromaShift Accessibility Platform.

## Directory Structure
- `src/algorithms/`: Core color transformation algorithms.
  - `color_remapping.py`: Hybrid Adaptive Color Remapping using CIELAB confusion lines.
  - `temporal_coherence.py`: Dense optical flow (Farneback) and weighted frame blending for video stability.
- `src/models/`: Model utilities and post-processing tools.
  - `temporal_smoothing.py`: Exponential Moving Average (EMA) smoothing for semantic masks.
- `scripts/`: Export and optimization tools.
  - `onnx_export_utils.py`: Utilities for PyTorch to ONNX export.
  - `quantize_models.py`: Dynamic INT8 quantization script for ONNX models.
- `exports/`: Storage for exported ONNX models and weights. *Ignored by Git.*

## Getting Started

### Environment Setup
You can use standard Python or Poetry to manage dependencies:

```bash
cd ai

# Option 1: Virtual environment + editable install
python -m venv .venv
.venv\Scripts\activate  # Windows (.venv/bin/activate on Unix)
pip install -e .

# Option 2: Poetry
poetry install
```

## Key Dependencies
- **PyTorch**: Deep learning framework and model exporter.
- **OpenCV**: Image/video processing, CIELAB transformations, optical flow calculations.
- **ONNX Runtime**: Model serialization and dynamic INT8 quantization.
- **NumPy**: Matrix operations and array calculations.

