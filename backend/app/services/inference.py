import cv2
import os
import logging
import numpy as np
import urllib.request

logger = logging.getLogger(__name__)

class InferenceService:
    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = os.path.join(os.path.dirname(__file__), "models")
        os.makedirs(models_dir, exist_ok=True)
        
        self.model_id = os.path.join(models_dir, "yolo26n-seg_int8.onnx")
        self.model_url = "https://huggingface.co/peiyan2/cvd-onnx-models/resolve/main/yolo26n-seg_int8.onnx"
        
        self.model = None
        self._pattern_cache = {}

    def _load_model(self):
        if self.model is None:
            # 1. Try loading the INT8 model first
            try:
                if not os.path.exists(self.model_id):
                    logger.info(f"Model not found locally. Downloading from {self.model_url}...")
                    urllib.request.urlretrieve(self.model_url, self.model_id)
                    logger.info("Model downloaded successfully.")
                from ultralytics import YOLO
                model_candidate = YOLO(self.model_id)
                
                # Perform dummy inference to check compatibility (e.g. ConvInteger)
                dummy_img = np.zeros((64, 64, 3), dtype=np.uint8)
                model_candidate(dummy_img, imgsz=64, verbose=False)
                
                self.model = model_candidate
                logger.info(f"Successfully loaded and verified YOLO model from {self.model_id}.")
                return
            except Exception as e:
                logger.warning(f"INT8 YOLO model loading/inference failed: {e}. Trying FP32 model fallback...")
            
            # 2. Try loading the FP32 model fallback
            try:
                models_dir = os.path.dirname(self.model_id)
                fp32_model_id = os.path.join(models_dir, "yolo26n-seg.onnx")
                fp32_url = "https://huggingface.co/peiyan2/cvd-onnx-models/resolve/main/yolo26n-seg.onnx"
                
                if not os.path.exists(fp32_model_id):
                    logger.info(f"FP32 model not found locally. Downloading from {fp32_url}...")
                    urllib.request.urlretrieve(fp32_url, fp32_model_id)
                    logger.info("FP32 model downloaded successfully.")
                
                from ultralytics import YOLO
                model_candidate = YOLO(fp32_model_id)
                
                # Verify FP32 model works
                dummy_img = np.zeros((64, 64, 3), dtype=np.uint8)
                model_candidate(dummy_img, imgsz=64, verbose=False)
                
                self.model_id = fp32_model_id
                self.model = model_candidate
                logger.info(f"Successfully loaded and verified FP32 YOLO model from {fp32_model_id}.")
            except Exception as fp_err:
                logger.error(f"Failed to load FP32 YOLO model: {fp_err}")
                self.model = "FAILED"

    def get_semantic_mask(self, image):
        if self.model is None:
            self._load_model()
            
        # Fallback to uniform mask if model fails
        if self.model == "FAILED" or not self.model:
            return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)
            
        try:
            h_orig, w_orig = image.shape[:2]
            
            # Downscale for faster YOLO inference on CPU
            max_dim = 640
            if max(h_orig, w_orig) > max_dim:
                scale = max_dim / max(h_orig, w_orig)
                infer_img = cv2.resize(image, (int(w_orig * scale), int(h_orig * scale)))
            else:
                infer_img = image
                
            # Run inference
            results = self.model(infer_img, imgsz=640, verbose=False)
            
            final_mask = np.zeros((h_orig, w_orig), dtype=np.float32)
            
            if len(results) > 0 and results[0].masks is not None and results[0].boxes is not None:
                # masks.data contains the tensor of shape (N, H, W)
                masks_data = results[0].masks.data.cpu().numpy()
                classes = results[0].boxes.cls.cpu().numpy()
                
                # Filter to only keep major semantic categories (person: 0, bicycle: 1, car: 2, motorcycle: 3, 
                # airplane: 4, bus: 5, train: 6, truck: 7, boat: 8, bird: 14, cat: 15, dog: 16, horse: 17, 
                # sheep: 18, cow: 19, elephant: 20, bear: 21, zebra: 22, giraffe: 23).
                # This prevents round/flat chart features from being misclassified as "frisbee", "pizza", "clock", "bowl", etc.
                valid_classes = {0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
                valid_indices = [i for i, c in enumerate(classes) if int(c) in valid_classes]
                
                if len(valid_indices) > 0 and masks_data.size > 0:
                    combined_mask = np.max(masks_data[valid_indices], axis=0)
                    # Unletterbox crop logic for models returning fixed 640x640 masks
                    h_infer, w_infer = infer_img.shape[:2]
                    r = min(640 / h_infer, 640 / w_infer)
                    new_unpad_w = int(round(w_infer * r))
                    new_unpad_h = int(round(h_infer * r))
                    pad_w = (640 - new_unpad_w) / 2
                    pad_h = (640 - new_unpad_h) / 2
                    
                    x_start = int(pad_w)
                    x_end = x_start + new_unpad_w
                    y_start = int(pad_h)
                    y_end = y_start + new_unpad_h
                    
                    cropped_mask = combined_mask[y_start:y_end, x_start:x_end]
                    final_mask = cv2.resize(cropped_mask, (w_orig, h_orig))
                else:
                    # No primary semantic objects -> return uniform mask of ones for uniform remapping
                    final_mask = np.ones((h_orig, w_orig), dtype=np.float32)
            else:
                final_mask = np.ones((h_orig, w_orig), dtype=np.float32)
                
            return final_mask
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return np.ones((image.shape[0], image.shape[1]), dtype=np.float32)

    def is_photographic(self, image: np.ndarray) -> bool:
        """
        Check if the image is a natural photograph vs a synthetic graphic/chart.
        """
        try:
            h, w = image.shape[:2]
            if h < 10 or w < 10:
                return False
            # Sample by resizing to speed up unique color counting
            small_w = min(w, 128)
            small_h = min(h, 128)
            resized = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
            unique_colors = len(np.unique(resized.reshape(-1, 3), axis=0))
            ratio = unique_colors / (small_w * small_h)
            # Photographic images have high density of unique colors
            return ratio > 0.15 or unique_colors > 1000
        except Exception as e:
            logger.warning(f"Error in is_photographic detection: {e}")
            return True # Safe default

    def is_discrete_graphic(self, image: np.ndarray) -> bool:
        """
        Check if the image is a synthetic graphic with discrete regions (e.g. charts, maps, diagrams)
        rather than a smooth gradient, color wheel/palette, or natural photo.
        """
        try:
            h, w = image.shape[:2]
            if h < 10 or w < 10:
                return False
            # Sample by resizing to speed up unique color counting
            small_w = min(w, 128)
            small_h = min(h, 128)
            resized = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
            unique_colors = len(np.unique(resized.reshape(-1, 3), axis=0))
            # Discrete graphics typically have a very low number of unique colors (< 500 when resized)
            return unique_colors < 500
        except Exception as e:
            logger.warning(f"Error in is_discrete_graphic detection: {e}")
            return False

    def remap_colors(self, image, intensity=1.0, cvd_type="deuteranopia", mask=None, is_photo=None, is_discrete=None):
        # Generate pixel-perfect semantic mask using YOLO26-seg if not provided
        if mask is None:
            mask = self.get_semantic_mask(image)
        
        # Normalize cvd_type
        cvd_type = cvd_type.lower() if cvd_type else "deuteranopia"
        
        if cvd_type == "normal" or intensity == 0:
            return image
            
        # Capture original image HSV channels for Phase 5 texture mapping before any modifications
        try:
            orig_hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            orig_h, orig_s, orig_v = orig_hsv[:,:,0], orig_hsv[:,:,1], orig_hsv[:,:,2]
        except Exception as e:
            logger.error(f"Error capturing original HSV: {e}")
            orig_h = orig_s = orig_v = None

        if is_photo is None:
            is_photo = self.is_photographic(image)
        if is_discrete is None:
            is_discrete = self.is_discrete_graphic(image)

        # --- Pre-processing: HSV Hue Rotation to prevent chart line/slice collisions ---
        # Run only on discrete graphics to prevent color gradient distortion/tearing on palettes and spectrums
        if is_discrete:
            try:
                hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
                h, s, v = cv2.split(hsv)
                
                # Cast Hue to signed int32 to prevent underflow/overflow during additions/subtractions
                h = h.astype(np.int32)
                
                if cvd_type in ["deuteranopia", "protanopia"]:
                    # Shift greens (Hue 35-85) towards cyan/blue (+15)
                    green_mask = (h >= 35) & (h <= 85)
                    h[green_mask] = (h[green_mask] + 15) % 180
                    
                    # Shift reds (Hue < 15 or > 165) slightly towards orange/magenta
                    red_mask = (h < 15) | (h > 165)
                    h[red_mask] = np.where(h[red_mask] < 15, (h[red_mask] - 10) % 180, (h[red_mask] + 10) % 180)

                    # Widely separate blue/purple (90-135) and magenta/pink (135-165) to prevent collision
                    blue_purple_mask = (h >= 90) & (h <= 135)
                    h[blue_purple_mask] = (h[blue_purple_mask] - 25) % 180
                    
                    magenta_pink_mask = (h > 135) & (h <= 165)
                    h[magenta_pink_mask] = (h[magenta_pink_mask] + 20) % 180
                elif cvd_type == "tritanopia":
                    # Shift yellow/orange (Hue 15-35) towards red (-10)
                    yellow_mask = (h >= 15) & (h <= 35)
                    h[yellow_mask] = (h[yellow_mask] - 10) % 180
                    
                    # Shift blue (Hue 100-140) towards cyan/green (-15)
                    blue_mask = (h >= 100) & (h <= 140)
                    h[blue_mask] = (h[blue_mask] - 15) % 180
                    
                # Cast back to uint8 after clipping to range
                h = np.clip(h, 0, 180).astype(np.uint8)
                shifted_hsv = cv2.merge((h, s, v))
                image = cv2.cvtColor(shifted_hsv, cv2.COLOR_HSV2BGR)
            except Exception as e:
                logger.error(f"Error in hue rotation: {e}")

        # Identify if we have active YOLO/semantic detections (meaning it's not a fallback mask of all ones/zeros)
        has_detections = not (np.all(mask == 1.0) or np.all(mask == 0.0))

        # Protect natural objects (like skin tones) in photos by dampening correction on them,
        # but apply standard correction/remapping for synthetic charts and layouts.
        if is_photo and has_detections:
            effective_mask = 1.0 - (mask * 0.8)
        elif not is_photo and has_detections:
            effective_mask = 0.4 + (mask * 0.6)
        else:
            effective_mask = np.ones_like(mask)
            
        # Scale intensity to modulate correction strength
        m = effective_mask * intensity
        
        # 1. Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 2. Linearize image from sRGB to Linear RGB
        img_float = rgb_image.astype(np.float32) / 255.0
        linear_img = np.where(img_float <= 0.04045, img_float / 12.92, ((img_float + 0.055) / 1.055) ** 2.4)
        
        # 3. Setup matrices
        M_rgb2lms = np.array([
            [0.3904725,  0.54990437, 0.00890159],
            [0.07092586, 0.96310739, 0.00135809],
            [0.02314268, 0.12801221, 0.93605194]
        ], dtype=np.float32)
        
        M_lms2rgb = np.array([
            [ 2.85831110, -1.62870796, -0.02481870],
            [-0.21043478,  1.15841493,  0.00032046],
            [-0.04188950, -0.11815433,  1.06888657]
        ], dtype=np.float32)
        
        if cvd_type == "protanopia":
            M_cvd = np.array([
                [0.0, 0.90822864, 0.00819200],
                [0.0, 1.0,        0.0],
                [0.0, 0.0,        1.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [0.0, 0.0, 0.0],
                [0.7, 1.0, 0.0],
                [0.7, 0.0, 1.0]
            ], dtype=np.float32)
        elif cvd_type == "deuteranopia":
            M_cvd = np.array([
                [1.0,        0.0, 0.0],
                [1.10104433, 0.0, -0.00901975],
                [0.0,        0.0, 1.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [1.0, 0.7, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.7, 1.0]
            ], dtype=np.float32)
        elif cvd_type == "tritanopia":
            M_cvd = np.array([
                [1.0,         0.0,        0.0],
                [0.0,         1.0,        0.0],
                [-0.15773032, 1.19465634, 0.0]
            ], dtype=np.float32)
            M_err2mod = np.array([
                [1.0, 0.0, 0.7],
                [0.0, 1.0, 0.7],
                [0.0, 0.0, 0.0]
            ], dtype=np.float32)
        else:
            return image
            
        # Correct Daltonization Error Remapping:
        # The simulation is done in LMS, and the error redistribution is done in RGB.
        # M_cvd_rgb = M_lms2rgb @ M_cvd @ M_rgb2lms
        # M_err_remap = M_err2mod @ (I - M_cvd_rgb)
        I_mat = np.eye(3, dtype=np.float32)
        M_cvd_rgb = M_lms2rgb @ M_cvd @ M_rgb2lms
        M_err_remap = M_err2mod @ (I_mat - M_cvd_rgb)
        
        # 4. Calculate raw correction vector for all pixels
        raw_corr = linear_img @ M_err_remap.T
        
        # 5. Modulate by pixel-level mask weight
        modulated_corr = raw_corr * m[:, :, np.newaxis]
        
        # 6. Apply correction
        corrected_linear = linear_img + modulated_corr
        
        # 7. Convert back to sRGB with gamma correction
        corrected_linear = np.maximum(corrected_linear, 0.0)
        corrected_srgb = np.where(corrected_linear <= 0.0031308, corrected_linear * 12.92, 1.055 * (corrected_linear ** (1.0 / 2.4)) - 0.055)
        corrected_srgb = np.clip(corrected_srgb * 255.0, 0, 255).astype(np.uint8)
        
        # 8. Convert RGB back to BGR
        corrected_bgr = cv2.cvtColor(corrected_srgb, cv2.COLOR_RGB2BGR)
        
        # --- Post-processing: Local Luminance Contrast Booster (CLAHE) & Detail Booster (Phase 4) ---
        try:
            lab = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2LAB)
            l_chan, a_chan, b_chan = cv2.split(lab)
            
            # Blend original luminance to prevent Daltonization from making the image too dark (maintaining brightness/contrast)
            try:
                orig_lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
                orig_l = orig_lab[:, :, 0]
                l_chan = cv2.addWeighted(orig_l, 0.75, l_chan, 0.25, 0)
            except Exception as l_err:
                logger.warning(f"Error blending original luminance: {l_err}")
            
            h_img, w_img = corrected_bgr.shape[:2]
            # Skip local contrast enhancement and texture overlay for small/1x1 vector colors
            if h_img >= 10 and w_img >= 10:
                # 1. Apply CLAHE local histogram equalization (lower clipLimit for smooth gradients to avoid banding)
                clip_limit = 3.0 if is_discrete else 1.2
                clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
                cl = clahe.apply(l_chan)
                l_clahe = cv2.addWeighted(l_chan, 1.0 - (0.5 * intensity), cl, 0.5 * intensity, 0)
                
                # 2. Extract and boost high-frequency edge detail (unsharp mask) for text/UI readability
                # Symmetric detail booster instead of asymmetric cv2.subtract to prevent white spot/halo noise on gradients
                blurred = cv2.GaussianBlur(l_clahe, (5, 5), 0)
                l_float = l_clahe.astype(np.float32)
                blurred_float = blurred.astype(np.float32)
                diff = l_float - blurred_float
                
                amount = 0.5 * intensity if is_discrete else 0.15 * intensity
                l_boosted = np.clip(l_float + amount * diff, 0, 255).astype(np.uint8)
                
                # --- Phase 5: Automated Dual-Encoding Texture Overlay ---
                # Apply subtle pattern modulation on original red and green hues to satisfy WCAG 1.4.1 / 1.3.3
                # Apply only to discrete synthetic graphics (e.g. charts/diagrams) to prevent visual noise on photos and gradients
                # Also calculate edge variance (Laplacian) to skip texture overlay on highly detailed maps/schematics (where textures create severe legibility issues)
                try:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                except Exception:
                    lap_var = 0.0
                    
                if is_discrete and lap_var < 20000.0 and orig_h is not None and orig_s is not None and orig_v is not None:
                    cache_key = (h_img, w_img)
                    if cache_key in self._pattern_cache:
                        stripe_pattern, dot_pattern = self._pattern_cache[cache_key]
                    else:
                        y_indices, x_indices = np.indices((h_img, w_img), dtype=np.int32)
                        stripe_pattern = ((x_indices + y_indices) % 14 < 3).astype(np.float32)
                        dot_pattern = (((x_indices % 8 == 0) & (y_indices % 8 == 0)) |
                                       (((x_indices + 4) % 8 == 0) & ((y_indices + 4) % 8 == 0))).astype(np.float32)
                        if len(self._pattern_cache) > 10:
                            self._pattern_cache.clear()
                        self._pattern_cache[cache_key] = (stripe_pattern, dot_pattern)
                    
                    # Create masks selecting pixels with original color saturation/value
                    cool_hue_mask = (orig_h >= 35) & (orig_h <= 135) & (orig_s > 30) & (orig_v > 30)
                    warm_hue_mask = ((orig_h < 35) | (orig_h > 135)) & (orig_s > 30) & (orig_v > 30)
                    
                    l_float_tex = l_boosted.astype(np.float32)
                    
                    # Apply stripe modulation to original cool regions (subtle -3.5 brightness shift where stripe is active)
                    stripe_mod = stripe_pattern * -3.5 * intensity
                    l_float_tex[cool_hue_mask] = np.clip(l_float_tex[cool_hue_mask] + stripe_mod[cool_hue_mask], 0, 255)
                    
                    # Apply dot modulation to original warm regions (subtle +3.5 brightness shift where dot is active)
                    dot_mod = dot_pattern * 3.5 * intensity
                    l_float_tex[warm_hue_mask] = np.clip(l_float_tex[warm_hue_mask] + dot_mod[warm_hue_mask], 0, 255)
                    
                    l_boosted = l_float_tex.astype(np.uint8)
                    
                enhanced_lab = cv2.merge((l_boosted, a_chan, b_chan))
                corrected_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        except Exception as e:
            logger.error(f"Error in contrast booster/texture overlay: {e}")
            
        return corrected_bgr

inference_service = InferenceService()
