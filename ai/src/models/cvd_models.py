from ultralytics import RTDETR
from transformers import AutoModelForObjectDetection, AutoImageProcessor
import torch

class ObjectDetectorWrapper:
    """
    Wrapper for RT-DETR for real-time object detection.
    Used to assign semantic priority scores to objects for CVD remapping.
    """
    def __init__(self, model_version="rtdetr-l.pt"):
        # Load pre-trained RT-DETR model from ultralytics
        self.model = RTDETR(model_version)
        
    def predict(self, image_bgr):
        """
        Returns bounding boxes, labels, and confidence scores.
        """
        results = self.model(image_bgr)
        # Parse results...
        return results

class DocumentAnalyzerWrapper:
    """
    Wrapper for Document Image Transformer (DiT).
    Used for Document Layout Analysis (FR-3.3).
    """
    def __init__(self, model_name="microsoft/dit-base-finetuned-publaynet"):
        self.processor = AutoImageProcessor.from_pretrained(model_name)
        self.model = AutoModelForObjectDetection.from_pretrained(model_name)
        
    def analyze(self, image):
        inputs = self.processor(images=image, return_tensors="pt")
        outputs = self.model(**inputs)
        # Post-process to extract layout elements (text, tables, figures)
        return outputs
