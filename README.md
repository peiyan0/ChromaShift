# CVD Accessibility Platform

> **Empowering the perceptual digital divide.** An AI-powered suite designed to make digital media accessible to the 300 million individuals living with Color Vision Deficiency (CVD).

---

## ✨ Key Features

- **🎯 Personalized Vision Calibration**: An interactive Bayesian optimization wizard that fine-tunes a unique transformation matrix for your specific color perception.
- **🧠 Semantic Media Remapping**: 
  - **Images**: Real-time client-side preview (TensorFlow.js) and high-fidelity server-side processing (TransUNet).
  - **Videos**: Flicker-free temporal coherence processing using Optical Flow.
  - **Documents**: Structural PDF parsing and chart-aware recoloring.
- **🛡️ WCAG 2.1 Audit**: Automated accessibility checks (SC 1.4.1, 1.4.3, 1.4.11) with actionable remediation feedback.
- **🔐 Privacy & Security**: JWT-based authentication and 7-day auto-expiry policies for all processed media.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Chakra UI + Tailwind CSS + Framer Motion
- **AI Runtime**: TensorFlow.js + WebGPU acceleration

### Backend
- **Framework**: Python FastAPI (Async)
- **Database**: PostgreSQL (SQLAlchemy) + Redis (Caching)
- **Storage**: S3-compatible (MinIO)
- **Media Processing**: OpenCV + FFmpeg + ONNX Runtime

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Security**: Trivy + OWASP ZAP scanning

---

## 🚦 Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
- [Node.js v20+](https://nodejs.org/)
- [Python 3.11+ & Poetry](https://python-poetry.org/)

### Quick Start (Full Stack)
1. **Clone the repository**:
   ```bash
   git clone https://github.com/peiyan0/cvd-accessibility-platform.git
   cd cvd-accessibility-platform
   ```

2. **Start infrastructure**:
   ```bash
   docker-compose up -d
   ```

3. **Launch Backend**:
   ```bash
   cd backend
   poetry install
   poetry run uvicorn app.main:app --reload
   ```

4. **Launch Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Visit `http://localhost:5173` to access the platform.

---

## 🏗️ Architecture

The platform uses a **three-tier hybrid architecture**:
1.  **Frontend**: Handles real-time previews using lightweight ONNX models via TensorFlow.js to provide instant feedback (< 3s).
2.  **Backend API**: Orchestrates heavy-duty AI processing, compliance audits, and storage management.
3.  **Storage Layer**: Maintains user profiles and media with strict lifecycle policies.

---

## 📖 API Documentation

Once the backend is running, you can access the interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 📄 License

This project is licensed under the MIT License.