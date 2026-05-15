import numpy as np

class TemporalSmoother:
    def __init__(self, alpha=0.3):
        """
        Initializes the smoother using Exponential Moving Average (EMA).
        alpha: smoothing factor (higher = more weight to current frame).
        """
        self.alpha = alpha
        self.previous_mask = None

    def smooth(self, current_mask):
        if self.previous_mask is None:
            self.previous_mask = current_mask
            return current_mask
        
        # Apply EMA: S_t = alpha * Y_t + (1 - alpha) * S_{t-1}
        smoothed_mask = self.alpha * current_mask + (1 - self.alpha) * self.previous_mask
        self.previous_mask = smoothed_mask
        return smoothed_mask