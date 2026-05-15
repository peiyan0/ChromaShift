import os
import cv2
import numpy as np
from app.services.inference import inference_service

class MediaProcessor:
    """
    Service for integrating AI models into the server-side processing pipeline.
    Handles Images, Videos, and PDFs.
    """
    def __init__(self):
        # We use the shared inference_service instance
        self.inference = inference_service

    def process_image(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        1. Read image (OpenCV)
        2. Run ONNX TransUNet for semantic mask
        3. Apply Hybrid Adaptive Color Remapping
        4. Save and return path
        """
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not read image at {input_path}")
            
        # Process using our verified AI service
        # intensity could be derived from severity
        processed_img = self.inference.remap_colors(image, intensity=severity * 1.5)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save processed image
        cv2.imwrite(output_path, processed_img)
        return output_path

    def process_video(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Placeholder for video processing.
        """
        # For now, just copy if it's a video, as full video processing is heavy
        import shutil
        shutil.copy2(input_path, output_path)
        return output_path

    def process_pdf(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Placeholder for PDF processing.
        """
        import shutil
        shutil.copy2(input_path, output_path)
        return output_path
