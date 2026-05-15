import onnxruntime as ort
import numpy as np
import cv2
import os

class InferenceService:
    def __init__(self, model_path: str = None):
        if model_path is None:
            # Default path relative to this file
            model_path = os.path.join(os.path.dirname(__file__), "models", "transunet_v1.onnx")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
            
        self.session = ort.InferenceSession(model_path)
        self.input_name = self.session.get_inputs()[0].name

    def preprocess(self, image):
        # Resize and normalize for TransUNet (224x224)
        img = cv2.resize(image, (224, 224))
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))  # HWC to CHW
        return np.expand_dims(img, axis=0)

    def remap_colors(self, image, intensity=1.5):
        input_tensor = self.preprocess(image)
        outputs = self.session.run(None, {self.input_name: input_tensor})
        mask = outputs[0].squeeze()
        
        # Resize mask back to original image size
        mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
        
        # Hybrid Adaptive Remapping Logic
        result = image.copy().astype(np.float32)
        # Example: Deuteranopia shift
        m = mask * intensity
        result[:,:,1] = image[:,:,1] * (1 - 0.5 * m) + image[:,:,2] * (0.5 * m)
        return np.clip(result, 0, 255).astype(np.uint8)

inference_service = InferenceService()
