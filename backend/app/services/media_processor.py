import os
import cv2
import numpy as np
from app.services.inference import inference_service

class MediaProcessor:
    """
    Service for integrating AI models into the server-side processing pipeline.
    Handles Images, Videos, and PDFs.
    """
    def __init__(self):
        # We use the shared inference_service instance
        self.inference = inference_service

    def process_image(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        1. Read image (OpenCV)
        2. Run ONNX TransUNet for semantic mask
        3. Apply Hybrid Adaptive Color Remapping
        4. Save and return path
        """
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not read image at {input_path}")
            
        # Process using our dynamic CVD-specific AI service
        processed_img = self.inference.remap_colors(image, intensity=severity * 1.5, cvd_type=cvd_type)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save processed image
        cv2.imwrite(output_path, processed_img)
        return output_path

    def process_video(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Process video frame-by-frame, applying an Exponential Moving Average (EMA)
        temporal smoothing mask filter to prevent flicker artifacts during playback.
        Subsequently post-processes output with ffmpeg to ensure H.264/AAC browser compatibility.
        """
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video at {input_path}")
            
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v') # Temporary encoding, re-encoded below
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        alpha = 0.5  # EMA smoothing factor (0.5 balance between responsiveness and flicker-filtering)
        smoothed_mask = None
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # Compute mask for current frame
                input_tensor = self.inference.preprocess(frame)
                outputs = self.inference.session.run(None, {self.inference.input_name: input_tensor})
                mask = outputs[0].squeeze()
                mask = cv2.resize(mask, (width, height))
                
                if smoothed_mask is None:
                    smoothed_mask = mask
                else:
                    smoothed_mask = alpha * mask + (1 - alpha) * smoothed_mask
                    
                # Apply remapping using the temporally-smoothed mask
                result = frame.copy().astype(np.float32)
                m = smoothed_mask * (severity * 1.5)
                
                cvd_lower = cvd_type.lower() if cvd_type else "deuteranopia"
                if cvd_lower == "protanopia":
                    # Protanopia (Red-blind): Shift red using green
                    result[:, :, 2] = frame[:, :, 2] * (1 - 0.5 * m) + frame[:, :, 1] * (0.5 * m)
                elif cvd_lower == "tritanopia":
                    # Tritanopia (Blue-blind): Shift blue using green
                    result[:, :, 0] = frame[:, :, 0] * (1 - 0.5 * m) + frame[:, :, 1] * (0.5 * m)
                else: # Default: deuteranopia
                    # Deuteranopia (Green-blind): Shift green using red
                    result[:, :, 1] = frame[:, :, 1] * (1 - 0.5 * m) + frame[:, :, 2] * (0.5 * m)
                    
                processed_frame = np.clip(result, 0, 255).astype(np.uint8)
                out.write(processed_frame)
        finally:
            cap.release()
            out.release()
            
        # Re-encode using ffmpeg to ensure standard H.264/AAC browser compatibility and restore original audio
        temp_output = output_path + ".temp.mp4"
        try:
            os.rename(output_path, temp_output)
            import subprocess
            subprocess.run([
                'ffmpeg', '-y',
                '-i', temp_output,
                '-i', input_path,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-map', '0:v:0',
                '-map', '1:a:0?',
                '-c:a', 'aac',
                '-shortest',
                output_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Video successfully re-encoded with H.264/AAC web compliance: {output_path}")
        except Exception as e:
            print(f"Failed to re-encode video with ffmpeg: {e}")
            # Fallback to original OpenCV output if ffmpeg fails or is missing
            if os.path.exists(temp_output) and not os.path.exists(output_path):
                os.rename(temp_output, output_path)
        finally:
            if os.path.exists(temp_output):
                try:
                    os.remove(temp_output)
                except Exception as e:
                    print(f"Failed to cleanup temp video file {temp_output}: {e}")
            
        return output_path

    def process_pdf(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        High-fidelity, layout-preserving PDF processing. Renders pages using Chrome's native
        PDFium engine (pypdfium2), applies dynamic CVD remapping to all visual components
        (text, charts, vector lines), and re-compiles pages back to a single PDF.
        """
        import pypdfium2 as pdfium
        from PIL import Image
        
        pdf = pdfium.PdfDocument(input_path)
        corrected_images = []
        
        try:
            for page in pdf:
                # Render to high-res PIL Image (scale=2 is ~150 DPI)
                bitmap = page.render(scale=2)
                pil_img = bitmap.to_pil()
                
                # Convert to OpenCV image (RGB to BGR)
                open_cv_image = np.array(pil_img)
                if len(open_cv_image.shape) == 3:
                    if open_cv_image.shape[2] == 4: # RGBA
                        open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGBA2BGR)
                    else: # RGB
                        open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2BGR)
                else: # Grayscale, make it BGR
                    open_cv_image = cv2.cvtColor(open_cv_image, cv2.COLOR_GRAY2BGR)
                
                # Remap colors using dynamic CVD type and severity
                processed_bgr = self.inference.remap_colors(open_cv_image, intensity=severity * 1.5, cvd_type=cvd_type)
                
                # Convert BGR back to PIL Image (RGB)
                processed_rgb = cv2.cvtColor(processed_bgr, cv2.COLOR_BGR2RGB)
                corrected_images.append(Image.fromarray(processed_rgb))
                
            if not corrected_images:
                raise ValueError("No pages found in PDF")
                
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save all pages back into a single high-quality PDF
            corrected_images[0].save(
                output_path, 
                "PDF", 
                save_all=True, 
                append_images=corrected_images[1:], 
                quality=95
            )
        finally:
            pdf.close()
            
        return output_path

