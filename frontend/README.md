# ChromaShift Frontend

This is the frontend for the ChromaShift platform, built with React, TypeScript, and Vite.

## Tech Stack
- **Framework**: React 18 + TypeScript
- **Styling**: Chakra UI + Tailwind CSS + Framer Motion
- **AI Runtime**: TensorFlow.js + WebGPU acceleration

## Development

To run the frontend locally with hot-reloading:

1. Ensure you have installed dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Environment Variables
The frontend relies on the `.env` file in the root directory.
- `VITE_API_URL`: The URL of the backend API (default: `http://localhost:8000/api/v1`).

See the root `README.md` for full project setup and infrastructure details.
