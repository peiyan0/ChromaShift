import torch
import onnx
import onnxruntime
from onnxruntime.quantization import quantize_dynamic, QuantType
import os
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from src.models.transunet import TransUNet

def export_and_quantize(model_path=None, output_dir="ai/exports", img_size=224):
    """
    Exports a PyTorch model to ONNX (FP32) and then quantizes it to INT8.
    This fulfills the NFR and Phase 2 requirements for deployment optimization.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    device = torch.device("cpu") # Export is usually done on CPU
    print("1. Initializing TransUNet Model...")
    model = TransUNet(img_size=img_size, num_classes=1).to(device)
    
    if model_path and os.path.exists(model_path):
        print(f"Loading weights from {model_path}...")
        checkpoint = torch.load(model_path, map_location=device)
        model.load_state_dict(checkpoint.get('model_state_dict', checkpoint))
    else:
        print("WARNING: No checkpoint provided or found. Exporting model with random initialized weights.")
        
    model.eval()

    # 2. Export to ONNX (FP32)
    fp32_onnx_path = os.path.join(output_dir, "transunet_fp32.onnx")
    print(f"2. Tracing and exporting to FP32 ONNX: {fp32_onnx_path}")
    
    # Dummy input representing a batch of 1 image (3 channels)
    dummy_input = torch.randn(1, 3, img_size, img_size, device=device)
    
    torch.onnx.export(
        model, 
        dummy_input, 
        fp32_onnx_path, 
        export_params=True, 
        opset_version=14, 
        do_constant_folding=True, 
        input_names=['input'], 
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    print("FP32 Export complete. Verifying model...")
    onnx_model = onnx.load(fp32_onnx_path)
    onnx.checker.check_model(onnx_model)
    
    # 3. Dynamic Quantization to INT8
    int8_onnx_path = os.path.join(output_dir, "transunet_int8.onnx")
    print(f"3. Quantizing model to INT8: {int8_onnx_path}")
    
    # Dynamic quantization is generally the easiest/safest for NLP/ViT hybrids.
    # It quantizes weights ahead of time but computes activations dynamically.
    quantize_dynamic(
        model_input=fp32_onnx_path,
        model_output=int8_onnx_path,
        weight_type=QuantType.QUInt8,
        # Optimize performance for CPU inference which is typical for standard backend processing
        optimize_model=True 
    )
    
    print("Quantization complete!")
    
    # Print size difference
    fp32_size = os.path.getsize(fp32_onnx_path) / (1024 * 1024)
    int8_size = os.path.getsize(int8_onnx_path) / (1024 * 1024)
    
    print(f"\n--- Export Summary ---")
    print(f"Original FP32 Size: {fp32_size:.2f} MB")
    print(f"Quantized INT8 Size: {int8_size:.2f} MB")
    print(f"Reduction: {(1 - int8_size/fp32_size)*100:.1f}%")
    print(f"Deployment Ready: {int8_onnx_path}")

if __name__ == "__main__":
    # Check for best checkpoint
    best_checkpoint = "ai/checkpoints/transunet_best.pth"
    export_and_quantize(model_path=best_checkpoint)
