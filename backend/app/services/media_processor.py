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
        2. Run YOLO26-seg for semantic mask
        3. Apply Hybrid Adaptive Color Remapping
        4. Save and return path
        """
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not read image at {input_path}")
            
        # Process using our dynamic CVD-specific AI service
        processed_img = self.inference.remap_colors(image, intensity=severity, cvd_type=cvd_type)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save processed image
        cv2.imwrite(output_path, processed_img)
        return output_path

    def process_video(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Process video frame-by-frame with temporal smoothing and scene-change detection.
        Uses histogram Bhattacharyya distance to detect scene cuts and reset the EMA mask.
        Pipes processed frames directly to FFmpeg subprocess stdin for H.264/AAC output.
        """
        import subprocess
        import shutil

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
            output_path,
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        alpha = 0.5  # EMA smoothing factor
        smoothed_mask = None
        prev_hist = None
        SCENE_CHANGE_THRESHOLD = 0.35  # Bhattacharyya distance threshold

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Scene change detection via histogram Bhattacharyya distance
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
                cv2.normalize(hist, hist)

                if prev_hist is not None:
                    score = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
                    if score > SCENE_CHANGE_THRESHOLD:
                        smoothed_mask = None  # Reset EMA on scene cut

                prev_hist = hist

                # Compute mask for current frame
                mask = self.inference.get_semantic_mask(frame)
                mask = cv2.resize(mask, (width, height))

                if smoothed_mask is None:
                    smoothed_mask = mask
                else:
                    smoothed_mask = alpha * mask + (1 - alpha) * smoothed_mask

                # Apply remapping using the temporally-smoothed mask
                processed_frame = self.inference.remap_colors(frame, intensity=severity, cvd_type=cvd_type, mask=smoothed_mask)

                # Write raw RGB frame to FFmpeg stdin
                rgb_frame = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2RGB)
                proc.stdin.write(rgb_frame.tobytes())
        finally:
            cap.release()
            if proc.stdin:
                proc.stdin.close()
            proc.wait()

        return output_path

    def process_pdf(self, input_path: str, output_path: str, cvd_type: str, severity: float):
        """
        Accessibility-preserving PDF processing using PyMuPDF (fitz).
        Extracts and recolors only embedded images/graphics, leaving text layers,
        hyperlinks, and vector elements intact for screen-reader compatibility.
        """
        import fitz  # PyMuPDF

        doc = fitz.open(input_path)

        try:
            for page in doc:
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    xref = img_info[0]
                    try:
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]

                        # Decode image
                        nparr = np.frombuffer(image_bytes, np.uint8)
                        cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if cv_image is None:
                            continue

                        # Remap colors
                        processed_bgr = self.inference.remap_colors(cv_image, intensity=severity, cvd_type=cvd_type)

                        # Encode back to JPEG at reduced quality
                        _, buffer = cv2.imencode('.jpg', processed_bgr, [cv2.IMWRITE_JPEG_QUALITY, 75])

                        # Replace image in PDF
                        page.replace_image(xref, stream=buffer.tobytes())
                    except Exception as e:
                        print(f"Skipping image xref={xref}: {e}")
                        continue

            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            doc.save(output_path, garbage=4, deflate=True)
        finally:
            doc.close()

        return output_path

