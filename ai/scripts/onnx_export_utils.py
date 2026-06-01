import torch
import warnings
from typing import Optional, Dict, Any

class ONNXExporter:
    """Shared utilities for exporting PyTorch models to ONNX."""
    
    @staticmethod
    def export_model(model, dummy_input, output_path, 
                     input_names=["input"], 
                     output_names=["output"],
                     opset_version=17,
                     dynamic_axes: Optional[Dict] = None,
                     **kwargs):
        """Generic ONNX export function."""
        
        model.eval()
        
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=torch.jit.TracerWarning)
            torch.onnx.export(
                model,
                dummy_input,
                output_path,
                export_params=True,
                opset_version=opset_version,
                input_names=input_names,
                output_names=output_names,
                dynamic_axes=dynamic_axes,
                do_constant_folding=True,
                **kwargs
            )
        print(f"✅ Exported to {output_path}")