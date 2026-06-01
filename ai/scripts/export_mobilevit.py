from transformers import MobileViTForImageClassification
import torch

# Load model
model = MobileViTForImageClassification.from_pretrained("apple/mobilevit-small")

# Dummy input (batch_size=1, channels=3, height=224, width=224)
dummy_input = torch.randn(1, 3, 224, 224)

# Export with opset_version=18 (supports modern operators)
torch.onnx.export(
    model,
    dummy_input,
    "mobilevit-small.onnx",
    input_names=["pixel_values"],
    output_names=["logits"],
    opset_version=18,  # Changed from 14 to 18
    do_constant_folding=True,
    export_params=True
)

print("Export successful!")