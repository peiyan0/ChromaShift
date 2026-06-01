from mobile_sam import sam_model_registry
import torch
from onnx_export_utils import ONNXExporter

# wrapper for just the encoder
class ImageEncoderOnly(torch.nn.Module):
    def __init__(self, sam_model):
        super().__init__()
        self.image_encoder = sam_model.image_encoder
        self.img_size = sam_model.image_encoder.img_size
        # Normalization values from SAM's training
        self.pixel_mean = torch.tensor([123.675, 116.28, 103.53], dtype=torch.float)
        self.pixel_std = torch.tensor([58.395, 57.12, 57.375], dtype=torch.float)

    def forward(self, input_image: torch.Tensor):
        # input_image: [B, H, W, C] in RGB 0-255 range
        # Normalize
        x = (input_image - self.pixel_mean) / self.pixel_std
        # Convert to [B, C, H, W]
        x = x.permute(0, 3, 1, 2)
        # Pad to square (1024x1024)
        _, _, h, w = x.shape
        pad_h = self.img_size - h
        pad_w = self.img_size - w
        x = torch.nn.functional.pad(x, (0, pad_w, 0, pad_h))
        return self.image_encoder(x)

# Load and export
sam = sam_model_registry["vit_t"](checkpoint="./weights/mobile_sam.pt")
# Wrap encoder
encoder_model = ImageEncoderOnly(sam)

dummy_input = torch.randint(0, 255, (1, 1024, 1024, 3), dtype=torch.float)

ONNXExporter.export_model(
    encoder_model, dummy_input, "mobile_sam_encoder.onnx",
    input_names=["input_image"], output_names=["image_embeddings"],
    opset_version=17,
    dynamic_axes={"input_image": {1: "image_height", 2: "image_width"}}
)

