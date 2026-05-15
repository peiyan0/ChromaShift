import torch
import torch.nn as nn
from transformers import AutoModel, AutoProcessor

class DocumentProcessor(nn.Module):
    def __init__(self, model_name='microsoft/dit-base'):
        super().__init__()
        # Load pre-trained DiT for layout analysis
        self.dit = AutoModel.from_pretrained(model_name)
        self.processor = AutoProcessor.from_pretrained(model_name)

    def extract_layout(self, image):
        """
        Analyzes document image to identify text blocks vs graphical elements.
        Ensures text regions are not adversely affected by color remapping.
        """
        inputs = self.processor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = self.dit(**inputs)
        return outputs.last_hidden_state # Features representing document structure