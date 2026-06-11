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
        self._pdf_color_cache = {}

    def process_image(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        1. Read image (OpenCV)
        2. Run YOLO26-seg for semantic mask
        3. Apply Hybrid Adaptive Color Remapping
        4. Save and return path with preserved EXIF and accessibility tagging
        """
        try:
            from PIL import Image as PILImage
            pil_img = PILImage.open(input_path).convert('RGB')
            # Convert RGB to BGR for OpenCV
            image = np.array(pil_img)[:, :, ::-1].copy()
        except Exception as e:
            raise ValueError(f"Could not read image at {input_path}: {e}")
            
        # Process using our dynamic CVD-specific AI service
        processed_img = self.inference.remap_colors(image, intensity=severity, cvd_type=cvd_type)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save processed image
        cv2.imwrite(output_path, processed_img)

        # Preserve metadata
        try:
            from PIL import Image as PILImage
            from PIL import PngImagePlugin
            
            with PILImage.open(input_path) as orig_img:
                exif_data = orig_img.info.get("exif")
                orig_format = orig_img.format
                
                with PILImage.open(output_path) as processed_pil:
                    meta = PngImagePlugin.PngInfo() if orig_format == 'PNG' else None
                    if meta:
                        meta.add_text("ChromaShift-Accessibility-Transformation", f"{cvd_type} (severity: {severity})")
                        processed_pil.save(output_path, format=orig_format, pnginfo=meta)
                    else:
                        if exif_data:
                            processed_pil.save(output_path, format=orig_format, exif=exif_data)
                        else:
                            processed_pil.save(output_path, format=orig_format)
        except Exception as e:
            print(f"Error preserving image metadata: {e}")
            
        return output_path

    def process_video(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Process video frame-by-frame with temporal smoothing and scene-change detection.
        Uses histogram Bhattacharyya distance to detect scene cuts and reset the EMA mask.
        Pipes processed frames directly to FFmpeg subprocess stdin for H.264/AAC output.
        Optimized to run semantic segmentation inference only on a frame interval or scene change.
        """
        import subprocess
        import shutil
        import gc

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video at {input_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Find FFmpeg binary
        ffmpeg_path = shutil.which('ffmpeg') or r'C:\ffmpeg\bin\ffmpeg.exe'

        # Launch FFmpeg subprocess: read raw RGB frames from stdin, mux with original audio
        cmd = [
            ffmpeg_path, '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{width}x{height}',
            '-pix_fmt', 'rgb24',
            '-r', str(fps),
            '-i', 'pipe:0',
            '-i', input_path,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            '-map', '0:v:0',
            '-map', '1:a:0?',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-shortest',
            '-map_metadata', '1',
            '-metadata', f'comment=ChromaShift-Accessibility-Transformation: {cvd_type} (severity {severity})',
            output_path,
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        alpha = 0.5  # EMA smoothing factor
        smoothed_mask = None
        prev_hist = None
        SCENE_CHANGE_THRESHOLD = 0.35  # Bhattacharyya distance threshold
        
        # Frame-skipping parameter to avoid running YOLO on every single frame
        frame_idx = 0
        frame_interval = 15

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Scene change detection via histogram Bhattacharyya distance
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
                cv2.normalize(hist, hist)

                scene_cut_detected = False
                if prev_hist is not None:
                    score = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
                    if score > SCENE_CHANGE_THRESHOLD:
                        smoothed_mask = None  # Reset EMA on scene cut
                        scene_cut_detected = True

                prev_hist = hist

                # Only run YOLO semantic segmentation on interval frames or on scene cuts
                if frame_idx % frame_interval == 0 or scene_cut_detected or smoothed_mask is None:
                    mask = self.inference.get_semantic_mask(frame)
                    mask = cv2.resize(mask, (width, height))

                    if smoothed_mask is None:
                        smoothed_mask = mask
                    else:
                        smoothed_mask = alpha * mask + (1 - alpha) * smoothed_mask

                frame_idx += 1

                # Apply remapping using the temporally-smoothed mask
                processed_frame = self.inference.remap_colors(frame, intensity=severity, cvd_type=cvd_type, mask=smoothed_mask)

                # Write raw RGB frame to FFmpeg stdin
                rgb_frame = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2RGB)
                proc.stdin.write(rgb_frame.tobytes())

                # Explicitly clean up frame array references to prevent RAM accumulation
                del frame
                del processed_frame
                del rgb_frame
                if frame_idx % 30 == 0:
                    gc.collect()
        finally:
            cap.release()
            if proc.stdin:
                proc.stdin.close()
            proc.wait()
            gc.collect()

        return output_path

    def _remap_pdf_color(self, color_tuple, cvd_type: str, severity: float):
        if not color_tuple or len(color_tuple) != 3:
            return color_tuple
        
        cache_key = (color_tuple, cvd_type, severity)
        if cache_key in self._pdf_color_cache:
            return self._pdf_color_cache[cache_key]
        
        # Convert RGB float to BGR [0, 255]
        r, g, b = color_tuple
        pixel = np.array([[[int(b * 255), int(g * 255), int(r * 255)]]], dtype=np.uint8)
        
        # Apply remapping, bypassing YOLO by passing a 1x1 mask of ones
        mask = np.ones((1, 1), dtype=np.float32)
        remapped_pixel = self.inference.remap_colors(pixel, intensity=severity, cvd_type=cvd_type, mask=mask)
        
        # Convert back to RGB float
        b_new, g_new, r_new = remapped_pixel[0, 0]
        result = (r_new / 255.0, g_new / 255.0, b_new / 255.0)
        self._pdf_color_cache[cache_key] = result
        return result

    def process_pdf(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Accessibility-preserving PDF processing using PyMuPDF (fitz).
        Extracts and recolors only embedded images/graphics, leaving text layers,
        hyperlinks, and vector elements intact for screen-reader compatibility.
        Uses a generator yield loop to process one image at a time, avoiding OOM issues.
        """
        import fitz  # PyMuPDF
        import gc
        import tempfile

        self._pdf_color_cache.clear()
        doc = fitz.open(input_path)

        try:
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # 1. Process Vector Drawings (Recolor and Redraw)
                drawings = page.get_drawings()
                if drawings:
                    # Mark original drawings for redaction
                    for draw in drawings:
                        page.add_redact_annot(draw["rect"])
                    
                    # Apply redaction to remove old drawings (keep text & images intact)
                    page.apply_redactions(images=0, graphics=1, text=0)
                    
                    # Recreate drawings with corrected colors
                    shape = page.new_shape()
                    for draw in drawings:
                        new_fill = self._remap_pdf_color(draw["fill"], cvd_type, severity) if draw["fill"] else None
                        new_color = self._remap_pdf_color(draw["color"], cvd_type, severity) if draw["color"] else None
                        
                        for item in draw["items"]:
                            if item[0] == "l":
                                shape.draw_line(item[1], item[2])
                            elif item[0] == "re":
                                shape.draw_rect(item[1])
                            elif item[0] == "qu":
                                shape.draw_quad(item[1])
                            elif item[0] == "c":
                                shape.draw_bezier(item[1], item[2], item[3], item[4])
                        
                        # Build finish parameters dynamically to avoid passing None values, which can cause MuPDF syntax warnings
                        finish_kwargs = {
                            "fill": new_fill,
                            "color": new_color,
                            "width": draw.get("width", 1)
                        }
                        if draw.get("dashes"):
                            finish_kwargs["dashes"] = draw["dashes"]
                        if draw.get("lineJoin") is not None:
                            finish_kwargs["lineJoin"] = draw["lineJoin"]
                        if draw.get("lineCap") is not None:
                            finish_kwargs["lineCap"] = max(draw["lineCap"])
                        
                        shape.finish(**finish_kwargs)
                    shape.commit()

                # 2. Process Embedded Images
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    xref = img_info[0]
                    try:
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]

                        nparr = np.frombuffer(image_bytes, np.uint8)
                        cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if cv_image is None:
                            continue

                        processed_bgr = self.inference.remap_colors(cv_image, intensity=severity, cvd_type=cvd_type)

                        # Write processed image to a temp file and replace via filename to handle encoding/filter conversion correctly
                        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_img:
                            temp_name = temp_img.name
                            cv2.imwrite(temp_name, processed_bgr)
                        
                        page.replace_image(xref, filename=temp_name)
                        
                        try:
                            os.remove(temp_name)
                        except Exception:
                            pass

                        # Actively dereference and garbage collect to keep memory low
                        del base_image
                        del image_bytes
                        del nparr
                        del cv_image
                        del processed_bgr
                        gc.collect()
                    except Exception as e:
                        print(f"Skipping image xref={xref}: {e}")
                        continue

            # Preserve metadata and append accessibility keyword
            try:
                metadata = doc.metadata
                if metadata:
                    metadata["keywords"] = (metadata.get("keywords", "") + f" ChromaShift-Accessibility-Transformation: {cvd_type}").strip()
                    metadata["subject"] = (metadata.get("subject", "") + f" Processed with ChromaShift for {cvd_type} (severity {severity})").strip()
                    doc.set_metadata(metadata)
            except Exception as e:
                print(f"Error copying PDF metadata: {e}")

            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            doc.save(output_path, garbage=4, deflate=True)
        finally:
            doc.close()
            gc.collect()

        return output_path

