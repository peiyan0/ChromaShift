import cv2
import numpy as np

class HybridColorRemapper:
    """
    Implements Hybrid Adaptive Color Remapping using Confusion Line Theory 
    in CIELAB space with luminance-preserving constraints.
    
    This algorithm shifts colors orthogonal to the CVD confusion line 
    while strictly preserving the L* (luminance) channel.
    """
    def __init__(self, cvd_type='deuteranopia', severity=1.0):
        self.cvd_type = cvd_type
        self.severity = np.clip(severity, 0.0, 1.0)
        
        # Approximate confusion angles in a* b* plane (radians)
        self.confusion_angles = {
            'protanopia': np.deg2rad(15), 
            'deuteranopia': np.deg2rad(15), 
            'tritanopia': np.deg2rad(96)
        }
    
    def process(self, image_bgr: np.ndarray, semantic_mask: np.ndarray = None) -> np.ndarray:
        """
        Remap colors in the image, optionally focusing on areas highlighted by semantic_mask.
        
        Args:
            image_bgr: Input BGR image.
            semantic_mask: Optional mask (0 to 1) identifying important objects (e.g., from RT-DETR).
        Returns:
            Remapped BGR image.
        """
        # 1. Convert BGR to CIELAB
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        # Normalize a* and b* from OpenCV [0, 255] back to [-128, 127] roughly
        a_norm = a_channel - 128.0
        b_norm = b_channel - 128.0
        
        # 2. Identify confused colors
        # Calculate angle in a*b* plane
        angles = np.arctan2(b_norm, a_norm)
        target_angle = self.confusion_angles[self.cvd_type]
        
        # 3. Orthogonal shift calculation
        # Calculate how close current angle is to confusion line
        angle_diff = np.abs(np.mod(angles - target_angle + np.pi, 2 * np.pi) - np.pi)
        
        # Shift magnitude peaks near the confusion line
        shift_magnitude = np.clip(1.0 - (angle_diff / (np.pi / 4)), 0, 1) * 30.0 * self.severity
        
        if semantic_mask is not None:
            # Apply semantic priority (objects in mask get stronger shift)
            semantic_mask = cv2.resize(semantic_mask, (image_bgr.shape[1], image_bgr.shape[0]))
            shift_magnitude *= (0.5 + 0.5 * semantic_mask) # Boost areas with mask
            
        # Shift angle orthogonally (+90 deg) for colors on confusion line
        new_angles = angles + (np.pi / 2) * (shift_magnitude / 30.0)
        
        # Calculate new a* and b*
        chroma = np.sqrt(np.square(a_norm) + np.square(b_norm))
        new_a = chroma * np.cos(new_angles) + 128.0
        new_b = chroma * np.sin(new_angles) + 128.0
        
        # 4. Reconstruct LAB (Luminance L* is strictly preserved)
        new_lab = cv2.merge([
            l_channel, 
            np.clip(new_a, 0, 255), 
            np.clip(new_b, 0, 255)
        ]).astype(np.uint8)
        
        # 5. Convert back to BGR
        result_bgr = cv2.cvtColor(new_lab, cv2.COLOR_LAB2BGR)
        
        return result_bgr
