import cv2
import numpy as np

class TemporalCoherenceFilter:
    """
    Implements Temporal Coherence using Optical Flow and Weighted Blending.
    Used for video processing pipelines to prevent flickering artifacts
    caused by frame-by-frame color remapping variations.
    """
    def __init__(self, alpha=0.3):
        """
        Args:
            alpha: Blending factor. 
                   0.0 = completely trust current processed frame (no temporal smoothing).
                   1.0 = completely trust warped previous frame (heavy trailing).
                   0.3 is a good balance for smooth video.
        """
        self.alpha = np.clip(alpha, 0.0, 1.0)
        self.prev_gray = None
        self.prev_processed = None

    def process_frame(self, current_original_bgr, current_processed_bgr):
        """
        Applies temporal coherence to a newly processed frame.
        
        Args:
            current_original_bgr: The original video frame (before CVD processing).
            current_processed_bgr: The CVD-remapped video frame.
            
        Returns:
            The stabilized processed frame.
        """
        current_gray = cv2.cvtColor(current_original_bgr, cv2.COLOR_BGR2GRAY)
        
        # If it's the first frame, just initialize and return the processed frame
        if self.prev_gray is None or self.prev_processed is None:
            self.prev_gray = current_gray
            self.prev_processed = current_processed_bgr
            return current_processed_bgr
            
        # 1. Calculate Dense Optical Flow (Farneback) between original frames
        flow = cv2.calcOpticalFlowFarneback(
            prev=self.prev_gray, 
            next=current_gray, 
            flow=None, 
            pyr_scale=0.5, levels=3, winsize=15, 
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0
        )
        
        # 2. Warp the previous PROCESSED frame using the flow
        h, w = current_gray.shape
        flow_map = np.column_stack((np.repeat(np.arange(h), w), np.tile(np.arange(w), h)))
        
        # Displacement map: coordinates + flow
        map_x = (flow_map[:, 1].reshape(h, w) + flow[..., 0]).astype(np.float32)
        map_y = (flow_map[:, 0].reshape(h, w) + flow[..., 1]).astype(np.float32)
        
        # Remap previous processed frame to align with current frame
        warped_prev_processed = cv2.remap(
            self.prev_processed, 
            map_x, map_y, 
            interpolation=cv2.INTER_LINEAR, 
            borderMode=cv2.BORDER_REPLICATE
        )
        
        # 3. Weighted Blending
        # Stabilized = (1 - alpha) * Current + alpha * Warped_Previous
        stabilized_frame = cv2.addWeighted(
            current_processed_bgr, 1.0 - self.alpha,
            warped_prev_processed, self.alpha,
            gamma=0
        )
        
        # 4. Update states for next frame
        self.prev_gray = current_gray
        self.prev_processed = stabilized_frame
        
        return stabilized_frame

    def reset(self):
        """Reset state for a new video."""
        self.prev_gray = None
        self.prev_processed = None
