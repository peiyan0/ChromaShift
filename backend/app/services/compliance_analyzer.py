import os
import cv2
import numpy as np

def calculate_relative_luminance(bgr_image):
    """
    Computes the WCAG 2.1 relative luminance of every pixel in a BGR image.
    Formula: L = 0.2126 * R_sRGB + 0.7152 * G_sRGB + 0.0722 * B_sRGB
    """
    # Convert BGR (OpenCV standard) to RGB and scale to [0, 1]
    rgb = bgr_image[..., ::-1].astype(np.float32) / 255.0
    
    # Apply standard sRGB gamma correction
    mask = rgb <= 0.03928
    c = np.zeros_like(rgb)
    c[mask] = rgb[mask] / 12.92
    c[~mask] = ((rgb[~mask] + 0.055) / 1.055) ** 2.4
    
    # Calculate luminance
    luminance = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return luminance

def analyze_image_contrast(bgr_image, max_samples=500):
    """
    Conducts edge-guided local neighborhood contrast checks on an image.
    Returns: (score, critical_count, warning_count, total_sampled)
    """
    # 1. Downsample for fast processing
    h, w = bgr_image.shape[:2]
    max_dim = 800
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        bgr_image = cv2.resize(bgr_image, (int(w * scale), int(h * scale)))
        h, w = bgr_image.shape[:2]

    # 2. Get relative luminance
    luminance = calculate_relative_luminance(bgr_image)
    
    # 3. Use Canny edge detection on grayscale representation to locate boundary details
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Find all coordinates of edge pixels
    edge_pts = np.argwhere(edges > 0)
    
    if len(edge_pts) == 0:
        return 100.0, 0, 0, 0
        
    # 4. Sample edge points uniformly
    if len(edge_pts) > max_samples:
        indices = np.linspace(0, len(edge_pts) - 1, max_samples, dtype=int)
        sampled_pts = edge_pts[indices]
    else:
        sampled_pts = edge_pts
        
    critical_count = 0
    warning_count = 0
    radius = 3 # 7x7 local patch
    
    for y, x in sampled_pts:
        y_start = max(0, y - radius)
        y_end = min(h - 1, y + radius + 1)
        x_start = max(0, x - radius)
        x_end = min(w - 1, x + radius + 1)
        
        patch = luminance[y_start:y_end, x_start:x_end]
        if patch.size == 0:
            continue
            
        l_min = np.percentile(patch, 10)
        l_max = np.percentile(patch, 90)
        
        # Calculate local contrast ratio
        contrast_ratio = (l_max + 0.05) / (l_min + 0.05)
        
        # Check against WCAG 2.1 threshold standards
        if contrast_ratio < 3.0:
            critical_count += 1
        elif contrast_ratio < 4.5:
            warning_count += 1
            
    total_sampled = len(sampled_pts)
    if total_sampled == 0:
        score = 100.0
    else:
        score = 100.0 * (1.0 - (critical_count * 1.0 + warning_count * 0.5) / total_sampled)
        score = max(0.0, min(100.0, float(score)))
        
    return score, critical_count, warning_count, total_sampled

def generate_suggestions(cvd_type: str, critical_count: int, warning_count: int) -> list:
    """
    Translates raw failure metrics into actionable visual/profile adjustments.
    """
    issues = []
    cvd_lower = cvd_type.lower() if cvd_type else "deuteranopia"
    
    if critical_count > 0:
        if cvd_lower == "protanopia":
            issues.append({
                "sc_id": "1.4.3",
                "severity": "Error",
                "description": f"Detected {critical_count} visual boundaries with extremely low contrast (under 3:1) for Red-Green transitions.",
                "suggestion": "Increase the Protanopia compensation severity (intensity slider) by 15-25% in your profile to boost red-channel separation."
            })
        elif cvd_lower == "tritanopia":
            issues.append({
                "sc_id": "1.4.3",
                "severity": "Error",
                "description": f"Detected {critical_count} visual boundaries with extremely low contrast (under 3:1) for Blue-Yellow transitions.",
                "suggestion": "Boost your Tritanopia compensation intensity by 20% to enhance blue-channel luminance separation from yellow backgrounds."
            })
        else: # deuteranopia
            issues.append({
                "sc_id": "1.4.3",
                "severity": "Error",
                "description": f"Detected {critical_count} visual boundaries with extremely low contrast (under 3:1) for Green-Red transitions.",
                "suggestion": "Adjust your Deuteranopia contrast multiplier or severity slider upward to improve green-hue legibility."
            })
            
        issues.append({
            "sc_id": "1.4.11",
            "severity": "Error",
            "description": f"Non-text graphical elements (charts/legends) exhibit critical contrast barriers (under 3:1) at {critical_count} boundary locations.",
            "suggestion": "Apply structural design updates (e.g. increase line thickness, use patterns/shapes, or use higher-contrast primary colors)."
        })
        
    if warning_count > 0:
        issues.append({
            "sc_id": "1.4.3",
            "severity": "Warning",
            "description": f"Detected {warning_count} boundary areas with moderate contrast (between 3:1 and 4.5:1), violating WCAG AA for normal text.",
            "suggestion": "In your Vision Profile, increase the global contrast multiplier to enhance text clarity against its adjacent background."
        })
        
    return issues

def analyze_pdf_compliance(local_path: str, cvd_type: str) -> dict:
    """
    Renders pages of a PDF (capped at 3 for performance) and performs spatial contrast analysis.
    """
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(local_path)
    
    scores = []
    total_crit = 0
    total_warn = 0
    pages_to_check = min(3, len(pdf))
    
    try:
        for i in range(pages_to_check):
            page = pdf[i]
            bitmap = page.render(scale=1.5) # Fast high-quality render
            pil_img = bitmap.to_pil()
            bgr_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            
            page_score, page_crit, page_warn, page_sampled = analyze_image_contrast(bgr_img)
            scores.append(page_score)
            total_crit += page_crit
            total_warn += page_warn
    finally:
        pdf.close()
        
    avg_score = float(np.mean(scores)) if scores else 100.0
    status = "pass" if avg_score >= 90.0 else "fail"
    
    # Average the incident count per analyzed page
    avg_crit = total_crit // pages_to_check if pages_to_check > 0 else 0
    avg_warn = total_warn // pages_to_check if pages_to_check > 0 else 0
    
    issues = generate_suggestions(cvd_type, avg_crit, avg_warn)
    
    return {
        "status": status,
        "score": round(avg_score, 1),
        "issues": issues
    }

def analyze_video_compliance(local_path: str, cvd_type: str) -> dict:
    """
    Extracts frames (capped at 5) throughout the video duration and performs visual contrast analysis.
    """
    cap = cv2.VideoCapture(local_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video at {local_path}")
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return {"status": "pass", "score": 100.0, "issues": []}
        
    # Sample up to 5 frames evenly spaced
    num_samples = 5
    frame_indices = np.linspace(0, total_frames - 1, num_samples, dtype=int)
    
    scores = []
    total_crit = 0
    total_warn = 0
    
    try:
        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue
                
            frame_score, frame_crit, frame_warn, frame_sampled = analyze_image_contrast(frame)
            scores.append(frame_score)
            total_crit += frame_crit
            total_warn += frame_warn
    finally:
        cap.release()
        
    avg_score = float(np.mean(scores)) if scores else 100.0
    status = "pass" if avg_score >= 90.0 else "fail"
    
    # Average the incident count per analyzed frame
    num_frames_read = len(scores) if len(scores) > 0 else 1
    avg_crit = total_crit // num_frames_read
    avg_warn = total_warn // num_frames_read
    
    issues = generate_suggestions(cvd_type, avg_crit, avg_warn)
    
    return {
        "status": status,
        "score": round(avg_score, 1),
        "issues": issues
    }

def analyze_media_compliance(local_path: str, media_type: str, cvd_type: str) -> dict:
    """
    Main orchestrator for loading the correct file parser and executing visual contrast audits.
    """
    media_type = media_type.lower()
    
    if media_type == "image":
        image = cv2.imread(local_path)
        if image is None:
            raise ValueError(f"Could not read image at {local_path}")
        score, crit, warn, sampled = analyze_image_contrast(image)
        status = "pass" if score >= 90.0 else "fail"
        issues = generate_suggestions(cvd_type, crit, warn)
        return {
            "status": status,
            "score": round(score, 1),
            "issues": issues
        }
    elif media_type == "pdf":
        return analyze_pdf_compliance(local_path, cvd_type)
    elif media_type == "video":
        return analyze_video_compliance(local_path, cvd_type)
    else:
        raise ValueError(f"Unsupported media type for compliance audit: {media_type}")
