# ChromaShift AI/ML Workspace

This directory is dedicated to **AI/ML Model Development & Training** of the ChromaShift Platform.

## Directory Structure
- `datasets/`: Storage for raw and curated datasets (Ishihara, CVD Recoloring, etc.). *Ignored by Git.*
- `notebooks/`: Jupyter notebooks for data analysis, model prototyping, and evaluation.
- `src/models/`: Implementation of model architectures (YOLO26-seg pipelines, temporal smoothing).
- `src/training/`: Scripts for training and fine-tuning.
- `exports/`: Trained weights and exported ONNX models for integration. *Ignored by Git.*
- `scripts/`: Utility scripts for data augmentation and preprocessing.

## Getting Started

### 1. Setup Environment
It is recommended to use a dedicated virtual environment for this workspace:
```bash
cd ai
# Create a virtual environment
python -m venv .venv
# Activate it (Windows)
.venv\Scripts\activate
# Install dependencies
pip install .
```

### 2. Objectives
- [ ] **Dataset Curation**: Collect and split datasets (70/20/10).
- [ ] **Model Training**: Fine-tune YOLO26-seg for optimal inference.
- [ ] **Core Algorithm**: Implement Hybrid Adaptive Color Remapping.
- [ ] **Validation**: Benchmarking against SSIM, ΔE, and Contrast Gain targets.
- [ ] **Export**: Quantize (INT8) and export to ONNX for Phase 3 integration.

## Key Dependencies
- **PyTorch**: Primary training framework.
- **Ultralytics**: For YOLO26-seg and YOLO-based modules.
- **OpenCV**: Media processing and confusion line implementation.
- **Albumentations**: CVD-specific data augmentation.
- **ONNX**: Model serialization for cross-platform inference.
