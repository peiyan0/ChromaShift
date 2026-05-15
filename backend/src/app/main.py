from fastapi import FastAPI, File, UploadFile
from fastapi.responses import Response
import cv2
import numpy as np
import io
from src.services.inference import InferenceService

app = FastAPI(title='CVD Accessibility Platform API')

# Initialize service with the linked model path
MODEL_PATH = 'src/services/models/transunet_v1.onnx'
inference_service = InferenceService(MODEL_PATH)

@app.post('/process-frame')
async def process_frame(file: UploadFile = File(...)):
    # Read image from upload
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Apply remapping
    processed_img = inference_service.remap_colors(img)

    # Encode back to JPEG
    _, buffer = cv2.imencode('.jpg', processed_img)
    return Response(content=buffer.tobytes(), media_type='image/jpeg')

@app.get('/health')
def health_check():
    return {'status': 'healthy'}