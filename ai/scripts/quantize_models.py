# usage: python quantize_models.py mobile_sam_encoder.onnx mobilevit-small.onnx transunet_v1.onnx yolov8n.onnx

import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import argparse
from pathlib import Path

def quantize_model(input_path, output_path=None, weight_type=QuantType.QInt8):
    """Quantize an ONNX model to INT8."""
    input_path = Path(input_path)
    if output_path is None:
        output_path = input_path.stem + "_int8.onnx"
    
    print(f"Quantizing {input_path} -> {output_path}")
    quantize_dynamic(str(input_path), str(output_path), weight_type=weight_type)
    print(f"✅ Saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Quantize ONNX models")
    parser.add_argument("models", nargs="+", help="Model files to quantize")
    parser.add_argument("--weight-type", default="QInt8", choices=["QInt8", "QUInt8"])
    
    args = parser.parse_args()
    
    weight_type = QuantType.QInt8 if args.weight_type == "QInt8" else QuantType.QUInt8
    
    for model_path in args.models:
        quantize_model(model_path, weight_type=weight_type)