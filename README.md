# ChromaShift

> **Empowering the chromatic digital divide.** An AI-powered suite designed to make digital media accessible to the 300 million individuals living with Color Vision Deficiency (CVD).

---

## ✨ Key Features

- **🎯 Personalized Vision Calibration**: An interactive Bayesian optimization wizard that fine-tunes a unique transformation matrix for your specific color perception.
- **🧠 Semantic Media Remapping**: 
  - **Images**: Real-time client-side preview (TensorFlow.js) and high-fidelity server-side processing (TransUNet).
  - **Videos**: Flicker-free temporal coherence processing using Optical Flow.
  - **Documents**: Structural PDF parsing and chart-aware recoloring.
- **🛡️ WCAG 2.1 Audit & Accessibility Report**: Automated accessibility checks (SC 1.4.1, 1.4.3, 1.4.11) with actionable remediation feedback. Generate and export a detailed **Accessibility Report (JSON)** containing specific failing color pairs and calculated WCAG-compliant alternatives.
- **🔐 Privacy & Security**: Strict data minimization and a 7-day auto-expiry policy. For full details on our security practices, please read [SECURITY.md](SECURITY.md).

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

### Run the platform in Docker

1. **Clone the repository**:
   ```bash
   git clone https://github.com/peiyan0/chromashift.git
   cd chromashift
   ```

2. **Start the containers**:
   ```bash
   docker compose up -d
   ```

3. **Access the platform**:
   - **Frontend**: `http://localhost` (Port 80)
   - **Backend API**: `http://localhost:8000`
   - **Swagger UI**: `http://localhost:8000/docs`
   ```
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