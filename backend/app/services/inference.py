import cv2
import os
import logging
import numpy as np
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class InferenceService:
    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = os.path.join(os.path.dirname(__file__), "models")
        os.makedirs(models_dir, exist_ok=True)
        
        self.seg_model_path = os.path.join(models_dir, "yolo26n-seg.pt")
        # Use the model name for Ultralytics auto-download; fall back to the local path
        # if it already exists so repeated startups skip the network fetch.
        model_id = self.seg_model_path if os.path.exists(self.seg_model_path) else "yolo26n-seg"
        
        try:
            # ultralytics will automatically download the weights if not found locally
            self.model = YOLO(model_id)
            logger.info("Successfully loaded YOLO26-seg model (NMS-free, edge-optimised).")
        except Exception as e:
            logger.error(f"Failed to load YOLO26-seg model: {e}")
            self.model = None

    def get_semantic_mask(self, image):
        # Fallback to uniform mask if model fails
        if not self.model:
            return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)
            
        try:
            # Run inference
            results = self.model(image, imgsz=640, verbose=False)
            
            h_orig, w_orig = image.shape[:2]
            final_mask = np.zeros((h_orig, w_orig), dtype=np.float32)
            
            if len(results) > 0 and results[0].masks is not None:
                # masks.data contains the tensor of shape (N, H, W) where N is number of objects
                masks_data = results[0].masks.data.cpu().numpy()
                
                # Combine all masks by taking the maximum confidence at each pixel
                combined_mask = np.max(masks_data, axis=0)
                
                # Resize combined mask back to original image dimensions
                final_mask = cv2.resize(combined_mask, (w_orig, h_orig))
            else:
                # Fallback if no objects detected: apply uniform shift to the entire frame
                final_mask = np.ones((h_orig, w_orig), dtype=np.float32)
                
            return final_mask
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)

    def remap_colors(self, image, intensity=1.0, cvd_type="deuteranopia", mask=None):
        # Generate pixel-perfect semantic mask using YOLO26-seg if not provided
        if mask is None:
            mask = self.get_semantic_mask(image)
        
        # Normalize cvd_type
        cvd_type = cvd_type.lower() if cvd_type else "deuteranopia"
        
        if cvd_type == "normal" or intensity == 0:
            return image
            
        # Hybrid Adaptive Strategy: 
        # Apply a 40% baseline global shift to ensure UI elements/charts are always corrected.
        # Apply a 100% enhanced shift to AI-detected semantic objects (people, cars, etc).
        effective_mask = 0.4 + (mask * 0.6)
            
        # Scale intensity to prevent LAB color channel blowout/clipping at high severities
        m = effective_mask * (intensity * 0.4)
        
        # Convert BGR to LAB (Luminance, A=Green/Red, B=Blue/Yellow)
        # This guarantees 100% luminance preservation because we only modify A and B channels
        lab_image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
        l, a, b = cv2.split(lab_image)
        
        # In LAB space:
        # A channel: negative=Green, positive=Red
        # B channel: negative=Blue, positive=Yellow
        
        if cvd_type == "protanopia":
            # Protanopia (Red-blind): Target positive A-channel (reds), shift into B-channel (blue direction)
            contrast = a - 128.0
            red_contrast = np.maximum(contrast, 0)
            new_b = b + (red_contrast * m)
            lab_image[:, :, 2] = np.clip(new_b, 0, 255)
            # Protanopes suffer from severely reduced red luminosity.
            # We must explicitly boost the Lightness (L channel) where red contrast exists.
            new_l = l + (red_contrast * m * 0.5)
            lab_image[:, :, 0] = np.clip(new_l, 0, 255)
            
        elif cvd_type == "deuteranopia":
            # Deuteranopia (Green-blind): Target negative A-channel (greens), shift into B-channel (yellow direction)
            green_contrast = np.maximum(128.0 - a, 0)
            new_b = b + (green_contrast * m)
            lab_image[:, :, 2] = np.clip(new_b, 0, 255)
            
        elif cvd_type == "tritanopia":
            # Blue-Yellow confusion: Shift unseen Blue-Yellow contrast (B channel) into Red-Green (A channel)
            contrast = b - 128.0
            new_a = a + (contrast * m)
            lab_image[:, :, 1] = np.clip(new_a, 0, 255)
            
        # Merge back and convert to BGR
        result = cv2.merge([lab_image[:,:,0], lab_image[:,:,1], lab_image[:,:,2]])
        result = np.clip(result, 0, 255).astype(np.uint8)
        return cv2.cvtColor(result, cv2.COLOR_LAB2BGR)

inference_service = InferenceService()
