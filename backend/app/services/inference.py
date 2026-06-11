import cv2
import os
import logging
import numpy as np
import urllib.request

logger = logging.getLogger(__name__)

class InferenceService:
    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = os.path.join(os.path.dirname(__file__), "models")
        os.makedirs(models_dir, exist_ok=True)
        
        self.model_id = os.path.join(models_dir, "yolo26n-seg_int8.onnx")
        self.model_url = "https://huggingface.co/peiyan2/cvd-onnx-models/resolve/main/yolo26n-seg_int8.onnx"
        
        self.model = None

    def _load_model(self):
        if self.model is None:
            try:
                if not os.path.exists(self.model_id):
                    logger.info(f"Model not found locally. Downloading from {self.model_url}...")
                    urllib.request.urlretrieve(self.model_url, self.model_id)
                    logger.info("Model downloaded successfully.")
                from ultralytics import YOLO
                self.model = YOLO(self.model_id)
                logger.info(f"Successfully loaded YOLO model from {self.model_id}.")
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}")
                self.model = "FAILED"

    def get_semantic_mask(self, image):
        if self.model is None:
            self._load_model()
            
        # Fallback to uniform mask if model fails
        if self.model == "FAILED" or not self.model:
            return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)
            
        try:
            h_orig, w_orig = image.shape[:2]
            
            # Downscale for faster YOLO inference on CPU
            max_dim = 320
            if max(h_orig, w_orig) > max_dim:
                scale = max_dim / max(h_orig, w_orig)
                infer_img = cv2.resize(image, (int(w_orig * scale), int(h_orig * scale)))
            else:
                infer_img = image
                
            # Run inference
            results = self.model(infer_img, imgsz=320, verbose=False)
            
            final_mask = np.zeros((h_orig, w_orig), dtype=np.float32)
            
            if len(results) > 0 and results[0].masks is not None:
                # masks.data contains the tensor of shape (N, H, W)
                masks_data = results[0].masks.data.cpu().numpy()
                combined_mask = np.max(masks_data, axis=0)
                final_mask = cv2.resize(combined_mask, (w_orig, h_orig))
            else:
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
            
        # Scale intensity to modulate correction strength
        m = effective_mask * intensity
        
        # 1. Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 2. Linearize image from sRGB to Linear RGB
        img_float = rgb_image.astype(np.float32) / 255.0
        linear_img = np.where(img_float <= 0.04045, img_float / 12.92, ((img_float + 0.055) / 1.055) ** 2.4)
        
        # 3. Setup matrices
        M_rgb2lms = np.array([
            [0.3904725,  0.54990437, 0.00890159],
            [0.07092586, 0.96310739, 0.00135809],
            [0.02314268, 0.12801221, 0.93605194]
        ], dtype=np.float32)
        
        M_lms2rgb = np.array([
            [ 2.85831110, -1.62870796, -0.02481870],
            [-0.21043478,  1.15841493,  0.00032046],
            [-0.04188950, -0.11815433,  1.06888657]
        ], dtype=np.float32)
        
        if cvd_type == "protanopia":
            M_cvd = np.array([
                [0.0, 0.90822864, 0.00819200],
                [0.0, 1.0,        0.0],
                [0.0, 0.0,        1.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [0.0, 0.0, 0.0],
                [0.7, 1.0, 0.0],
                [0.7, 0.0, 1.0]
            ], dtype=np.float32)
        elif cvd_type == "deuteranopia":
            M_cvd = np.array([
                [1.0,        0.0, 0.0],
                [1.10104433, 0.0, -0.00901975],
                [0.0,        0.0, 1.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [1.0, 0.7, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.7, 1.0]
            ], dtype=np.float32)
        elif cvd_type == "tritanopia":
            M_cvd = np.array([
                [1.0,         0.0,        0.0],
                [0.0,         1.0,        0.0],
                [-0.15773032, 1.19465634, 0.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [1.0, 0.0, 0.7],
                [0.0, 1.0, 0.7],
                [0.0, 0.0, 0.0]
            ], dtype=np.float32)
        else:
            return image
            
        S_mat = M_lms2rgb @ M_cvd @ M_rgb2lms
        M_err_remap = M_err2mod @ (np.eye(3, dtype=np.float32) - S_mat)
        
        # 4. Calculate raw correction vector for all pixels
        raw_corr = linear_img @ M_err_remap.T
        
        # 5. Modulate by pixel-level mask weight
        modulated_corr = raw_corr * m[:, :, np.newaxis]
        
        # 6. Apply correction
        corrected_linear = linear_img + modulated_corr
        
        # 7. Convert back to sRGB with gamma correction
        corrected_linear = np.maximum(corrected_linear, 0.0)
        corrected_srgb = np.where(corrected_linear <= 0.0031308, corrected_linear * 12.92, 1.055 * (corrected_linear ** (1.0 / 2.4)) - 0.055)
        corrected_srgb = np.clip(corrected_srgb * 255.0, 0, 255).astype(np.uint8)
        
        # 8. Convert RGB back to BGR
        return cv2.cvtColor(corrected_srgb, cv2.COLOR_RGB2BGR)

inference_service = InferenceService()
