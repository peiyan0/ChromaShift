import os
import cv2
import numpy as np
import colorsys
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

    def process_image(self, input_path: str, output_path: str, cvd_type: str, severity: float, compression_level: str = "medium"):
        """
        1. Read image (OpenCV/PIL fallback)
        2. Run YOLO26-seg for semantic mask
        3. Apply Hybrid Adaptive Color Remapping
        4. Save and return path with preserved EXIF and accessibility tagging
        """
        try:
            from PIL import Image as PILImage
            try:
                import pillow_heif
                pillow_heif.register_heif_opener()
            except ImportError:
                pass
            pil_img = PILImage.open(input_path).convert('RGB')
            # Convert RGB to BGR for OpenCV
            image = np.array(pil_img)[:, :, ::-1].copy()
        except Exception as e:
            raise ValueError(f"Could not read image at {input_path}: {e}")
            
        # Process using our dynamic CVD-specific AI service
        processed_img = self.inference.remap_colors(image, intensity=severity, cvd_type=cvd_type)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save processed image and preserve metadata
        try:
            from PIL import Image as PILImage
            from PIL import PngImagePlugin
            
            with PILImage.open(input_path) as orig_img:
                exif_data = orig_img.info.get("exif")
                orig_format = orig_img.format
                
            # Convert BGR processed image to PIL RGB image
            rgb_processed = cv2.cvtColor(processed_img, cv2.COLOR_BGR2RGB)
            processed_pil = PILImage.fromarray(rgb_processed)
            
            save_kwargs = {}
            if orig_format == 'WEBP':
                if compression_level == "high":
                    save_kwargs["lossless"] = False
                    save_kwargs["quality"] = 65
                elif compression_level == "low":
                    save_kwargs["lossless"] = True
                else:  # medium / default
                    save_kwargs["lossless"] = False
                    save_kwargs["quality"] = 80
            elif orig_format in ['JPEG', 'JPG']:
                if compression_level == "high":
                    save_kwargs["quality"] = 65
                elif compression_level == "low":
                    save_kwargs["quality"] = 95
                else:
                    save_kwargs["quality"] = 80
            elif orig_format == 'PNG':
                if compression_level == "high":
                    save_kwargs["compress_level"] = 9
                    save_kwargs["optimize"] = True
                elif compression_level == "low":
                    save_kwargs["compress_level"] = 1
                    save_kwargs["optimize"] = False
                else:
                    save_kwargs["compress_level"] = 6
                    save_kwargs["optimize"] = True
            
            if orig_format == 'PNG':
                meta = PngImagePlugin.PngInfo()
                meta.add_text("ChromaShift-Accessibility-Transformation", f"{cvd_type} (severity: {severity})")
                processed_pil.save(output_path, format=orig_format, pnginfo=meta, **save_kwargs)
            else:
                if exif_data:
                    processed_pil.save(output_path, format=orig_format, exif=exif_data, **save_kwargs)
                else:
                    processed_pil.save(output_path, format=orig_format, **save_kwargs)
        except Exception as e:
            print(f"Error saving image/metadata with PIL: {e}")
            # Fallback to cv2.imwrite just in case
            cv2.imwrite(output_path, processed_img)
            
        return output_path

    def process_video(self, input_path: str, output_path: str, cvd_type: str, severity: float, compression_level: str = "medium"):
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

        crf = "23"
        preset = "medium"
        if compression_level == "high":
            crf = "28"
            preset = "slow"
        elif compression_level == "low":
            crf = "18"
            preset = "fast"

        # Launch FFmpeg subprocess: read raw RGB frames from stdin, mux with original audio
        # Enforce constant frame rate with -vsync cfr and sync audio start via -async 1
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
            '-preset', preset,
            '-crf', crf,
            '-map', '0:v:0',
            '-map', '1:a:0?',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-shortest',
            '-vsync', 'cfr',
            '-async', '1',
            '-map_metadata', '1',
            '-metadata', f'comment=ChromaShift-Accessibility-Transformation: {cvd_type} (severity {severity})',
            output_path,
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        alpha = 0.5  # EMA smoothing factor
        smoothed_mask = None
        prev_hist = None
        prev_gray = None
        prev_L = None  # Previous frame's L channel for temporal luminance smoothing
        SCENE_CHANGE_THRESHOLD = 0.35  # Bhattacharyya distance threshold
        
        # Frame-skipping parameter - set to 2 for highly responsive tracking
        frame_idx = 0
        frame_interval = 2

        # Video content classification (cached)
        is_photo = None
        is_discrete = None
        bypass_segmentation = True
        uniform_mask = np.ones((height, width), dtype=np.float32)

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if is_photo is None:
                    is_photo = self.inference.is_photographic(frame)
                    is_discrete = self.inference.is_discrete_graphic(frame)

                if bypass_segmentation:
                    smoothed_mask = uniform_mask
                else:
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
                        
                        prev_gray = gray.copy()
                    else:
                        # Warp the mask using Optical Flow between prev_gray and current gray frame
                        if prev_gray is not None and smoothed_mask is not None:
                            try:
                                # Downscale for performance optimization
                                flow_scale = 0.5
                                prev_gray_small = cv2.resize(prev_gray, (0, 0), fx=flow_scale, fy=flow_scale)
                                gray_small = cv2.resize(gray, (0, 0), fx=flow_scale, fy=flow_scale)
                                
                                flow = cv2.calcOpticalFlowFarneback(
                                    prev_gray_small, gray_small, None, 0.5, 3, 15, 3, 5, 1.2, 0
                                )
                                
                                h_small, w_small = gray_small.shape[:2]
                                mask_small = cv2.resize(smoothed_mask, (w_small, h_small))
                                
                                # Create coordinates mapping grid
                                y_coords, x_coords = np.mgrid[0:h_small, 0:w_small].astype(np.float32)
                                map_x = x_coords + flow[..., 0]
                                map_y = y_coords + flow[..., 1]
                                
                                warped_mask_small = cv2.remap(
                                    mask_small, map_x, map_y, cv2.INTER_LINEAR,
                                    borderMode=cv2.BORDER_CONSTANT, borderValue=0
                                )
                                smoothed_mask = cv2.resize(warped_mask_small, (width, height))
                            except Exception as e:
                                print(f"Error in optical flow warping: {e}")
                        
                        prev_gray = gray.copy()

                frame_idx += 1

                # Apply remapping using the temporally-smoothed mask
                processed_frame = self.inference.remap_colors(
                    frame, intensity=severity, cvd_type=cvd_type, mask=smoothed_mask,
                    is_photo=is_photo, is_discrete=is_discrete
                )

                # Temporal luminance smoothing to prevent rapid brightness flashes (WCAG 2.3.1)
                try:
                    lab = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2LAB)
                    l_chan, a_chan, b_chan = cv2.split(lab)
                    if prev_L is not None:
                        mean_curr = np.mean(l_chan)
                        mean_prev = np.mean(prev_L)
                        diff = mean_curr - mean_prev
                        if abs(diff) > 25.0:
                            # Dampen the luminance shift
                            damp_factor = 0.4
                            l_chan = cv2.addWeighted(l_chan, damp_factor, prev_L, 1.0 - damp_factor, 0)
                    prev_L = l_chan.copy()
                    processed_frame = cv2.cvtColor(cv2.merge((l_chan, a_chan, b_chan)), cv2.COLOR_LAB2BGR)
                except Exception as e:
                    print(f"Error in temporal luminance smoothing: {e}")

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

    def process_pdf(self, input_path: str, output_path: str, cvd_type: str, severity: float, compression_level: str = "medium"):
        """
        Accessibility-preserving PDF processing using PyMuPDF (fitz).
        Copies the file first and performs incremental updates to 100% preserve structural trees,
        metadata, hyperlinks, interactive forms, and tab orders.
        """
        import fitz  # PyMuPDF
        import gc
        import tempfile
        import shutil

        self._pdf_color_cache.clear()
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        doc = None
        try:
            # Open the input file directly (read-only)
            doc = fitz.open(input_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # 1. Process Vector Drawings (Recolor and Redraw)
                drawings = page.get_drawings()
                if drawings:
                    def is_colored(rgb_tuple):
                        if not rgb_tuple:
                            return False
                        r, g, b = rgb_tuple
                        h, l, s = colorsys.rgb_to_hls(r, g, b)
                        return s > 0.10 and l > 0.05 and l < 0.98

                    # Redact the bounding boxes of ALL drawings on the page to completely clear the old line-art layer.
                    # Setting text=1 (PDF_REDACT_TEXT_NONE) prevents the selectable text layers from being removed.
                    for draw in drawings:
                        page.add_redact_annot(draw["rect"], fill=False)
                    page.apply_redactions(images=0, graphics=2, text=1)

                    # Re-draw all shapes back in their original stack order
                    shape = page.new_shape()
                    for draw in drawings:
                        fill = draw["fill"]
                        color = draw["color"]
                        new_fill = self._remap_pdf_color(fill, cvd_type, severity) if fill and is_colored(fill) else fill
                        new_color = self._remap_pdf_color(color, cvd_type, severity) if color and is_colored(color) else color
                        
                        for item in draw["items"]:
                            if item[0] == "l":
                                shape.draw_line(item[1], item[2])
                            elif item[0] == "re":
                                shape.draw_rect(item[1])
                            elif item[0] == "qu":
                                shape.draw_quad(item[1])
                            elif item[0] == "c":
                                shape.draw_bezier(item[1], item[2], item[3], item[4])
                        
                        finish_kwargs = {
                            "fill": new_fill,
                            "color": new_color,
                            "width": draw.get("width", 1)
                        }
                        if draw.get("fill_opacity") is not None:
                            finish_kwargs["fill_opacity"] = draw["fill_opacity"]
                        if draw.get("stroke_opacity") is not None:
                            finish_kwargs["stroke_opacity"] = draw["stroke_opacity"]
                        if draw.get("dashes"):
                            finish_kwargs["dashes"] = draw["dashes"]
                        if draw.get("lineJoin") is not None:
                            finish_kwargs["lineJoin"] = int(draw["lineJoin"])
                        if draw.get("lineCap") is not None:
                            line_cap = draw["lineCap"]
                            if isinstance(line_cap, (int, float)):
                                finish_kwargs["lineCap"] = int(line_cap)
                            else:
                                try:
                                    finish_kwargs["lineCap"] = max(line_cap)
                                except (TypeError, ValueError):
                                    finish_kwargs["lineCap"] = 0
                        shape.finish(**finish_kwargs)

                    # Commit to the background layer (behind text and other elements)
                    shape.commit(overlay=False)

                # 2. Process Embedded Images
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    xref = img_info[0]
                    smask_xref = img_info[1]
                    try:
                        main_pix = fitz.Pixmap(doc, xref)
                        
                        # Extract BGR / BGRA image with correct alpha channel mapped from SMask if it exists
                        if smask_xref > 0:
                            mask_pix = fitz.Pixmap(doc, smask_xref)
                            main_array = np.frombuffer(main_pix.samples, dtype=np.uint8).reshape((main_pix.height, main_pix.width, 4 if main_pix.alpha else 3))
                            mask_array = np.frombuffer(mask_pix.samples, dtype=np.uint8).reshape((mask_pix.height, mask_pix.width, 1))
                            
                            if main_pix.alpha:
                                rgba = main_array.copy()
                                rgba[:, :, 3] = mask_array[:, :, 0]
                            else:
                                rgba = np.zeros((main_pix.height, main_pix.width, 4), dtype=np.uint8)
                                rgba[:, :, :3] = main_array
                                rgba[:, :, 3] = mask_array[:, :, 0]
                            cv_image = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
                        else:
                            if main_pix.alpha:
                                rgba = np.frombuffer(main_pix.samples, dtype=np.uint8).reshape((main_pix.height, main_pix.width, 4))
                                cv_image = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
                            else:
                                rgb = np.frombuffer(main_pix.samples, dtype=np.uint8).reshape((main_pix.height, main_pix.width, 3))
                                cv_image = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

                        if cv_image is None:
                            continue

                        # Handle transparency (4 channels)
                        h_img, w_img = cv_image.shape[:2]
                        uniform_mask = np.ones((h_img, w_img), dtype=np.float32)
                        if len(cv_image.shape) == 3 and cv_image.shape[2] == 4:
                            bgr = cv_image[:, :, :3]
                            alpha = cv_image[:, :, 3]
                            processed_bgr = self.inference.remap_colors(bgr, intensity=severity, cvd_type=cvd_type, mask=uniform_mask)
                            processed_image = cv2.merge((processed_bgr, alpha))
                        else:
                            processed_image = self.inference.remap_colors(cv_image, intensity=severity, cvd_type=cvd_type, mask=uniform_mask)

                        # Write processed image to a temp file and replace via filename to handle encoding/filter conversion correctly
                        # Force PNG format if transparency is present to preserve the alpha channel
                        has_transparency = (smask_xref > 0) or main_pix.alpha
                        img_ext = "png"
                        if not has_transparency:
                            try:
                                img_dict = doc.extract_image(xref)
                                if img_dict and "ext" in img_dict:
                                    img_ext = img_dict["ext"].lower()
                            except Exception as ext_err:
                                print(f"Error extracting image format metadata: {ext_err}")

                        temp_suffix = f".{img_ext}"
                        write_params = []
                        if img_ext in ["jpeg", "jpg"]:
                            temp_suffix = ".jpg"
                            if compression_level == "high":
                                quality = 65
                            elif compression_level == "low":
                                quality = 95
                            else:
                                quality = 80
                            write_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
                        elif img_ext == "png":
                            if compression_level == "high":
                                compress_level = 9
                            elif compression_level == "low":
                                compress_level = 1
                            else:
                                compress_level = 6
                            write_params = [int(cv2.IMWRITE_PNG_COMPRESSION), compress_level]
                        else:
                            temp_suffix = ".png"

                        with tempfile.NamedTemporaryFile(suffix=temp_suffix, delete=False) as temp_img:
                            temp_name = temp_img.name
                            cv2.imwrite(temp_name, processed_image, write_params)
                        
                        page.replace_image(xref, filename=temp_name)
                        
                        try:
                            os.remove(temp_name)
                        except Exception:
                            pass

                        # Actively dereference and garbage collect to keep memory low
                        del main_pix
                        if smask_xref > 0:
                            del mask_pix
                        del cv_image
                        del processed_image
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

            # Save directly to output_path using garbage collection and deflation
            doc.save(output_path, garbage=4, deflate=True, clean=True, encryption=fitz.PDF_ENCRYPT_KEEP)
        finally:
            if doc and not doc.is_closed:
                doc.close()
            gc.collect()

        return output_path

