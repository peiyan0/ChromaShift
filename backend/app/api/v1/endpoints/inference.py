from fastapi import APIRouter, File, UploadFile, Response
import cv2
import numpy as np
from app.services.inference import inference_service

router = APIRouter()

@router.post("/process-frame")
async def process_frame(file: UploadFile = File(...)):
    """
    Process a frame for color vision deficiency accessibility.
    """
    try:
        # Read image from upload
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return Response(content="Invalid image format", status_code=400)

        # Apply remapping
        # The inference_service will raise an error if the model isn't loaded
        processed_img = inference_service.remap_colors(img)

        # Encode back to JPEG
        _, buffer = cv2.imencode('.jpg', processed_img)
        
        # Add custom header to indicate the image was processed by the AI model
        return Response(
            content=buffer.tobytes(), 
            media_type='image/jpeg',
            headers={"X-AI-Processed": "true"}
        )
    except Exception as e:
        return Response(content=f"Inference error: {str(e)}", status_code=500)

@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "inference"}
