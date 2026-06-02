import cv2
import numpy as np
from typing import List, Tuple


def extract_dominant_colors(image: np.ndarray, k: int = 8) -> List[Tuple[int, int, int]]:
    """
    Extract k dominant colors from an image using K-Means clustering.
    Returns a list of (B, G, R) tuples sorted by frequency.
    """
    pixels = image.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)

    # Sort by cluster frequency (most common first)
    unique, counts = np.unique(labels, return_counts=True)
    sorted_indices = np.argsort(-counts)
    sorted_centers = centers[sorted_indices]

    return [tuple(int(c) for c in color) for color in sorted_centers]


def compute_adjacency_conflicts(
    image: np.ndarray,
    labels: np.ndarray,
    min_hue_diff: float = 30.0
) -> List[Tuple[int, int]]:
    """
    Find pairs of adjacent color clusters whose hue difference is below min_hue_diff.
    Used to detect pie-chart-style color collisions after Daltonization.

    Args:
        image: BGR image
        labels: Per-pixel cluster label map (same H x W as image)
        min_hue_diff: Minimum hue separation in degrees (0-180 in OpenCV)

    Returns:
        List of (cluster_a, cluster_b) pairs that are spatially adjacent
        AND have insufficient hue separation.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, w = labels.shape[:2]
    conflicts = set()

    # Check horizontal and vertical adjacency
    for dy, dx in [(0, 1), (1, 0)]:
        y_end = h - dy if dy else h
        x_end = w - dx if dx else w
        a_labels = labels[:y_end, :x_end]
        b_labels = labels[dy:dy + y_end, dx:dx + x_end]
        border = a_labels != b_labels
        if not np.any(border):
            continue
        pairs = set(zip(a_labels[border].flat, b_labels[border].flat))
        for ca, cb in pairs:
            key = (min(ca, cb), max(ca, cb))
            if key not in conflicts:
                # Compute mean hue for each cluster
                mask_a = labels == ca
                mask_b = labels == cb
                hue_a = np.mean(hsv[:, :, 0][mask_a])
                hue_b = np.mean(hsv[:, :, 0][mask_b])
                diff = min(abs(hue_a - hue_b), 180 - abs(hue_a - hue_b))
                if diff < min_hue_diff:
                    conflicts.add(key)

    return list(conflicts)


def force_hue_separation(
    image: np.ndarray,
    labels: np.ndarray,
    conflicts: List[Tuple[int, int]],
    target_separation: float = 40.0
) -> np.ndarray:
    """
    For conflicting cluster pairs, rotate the hue of the smaller cluster
    to enforce minimum hue separation.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    result = hsv.copy()

    for ca, cb in conflicts:
        mask_a = labels == ca
        mask_b = labels == cb
        count_a = np.sum(mask_a)
        count_b = np.sum(mask_b)

        # Rotate the smaller cluster's hue
        if count_a <= count_b:
            target_mask = mask_a
            anchor_hue = np.mean(hsv[:, :, 0][mask_b])
        else:
            target_mask = mask_b
            anchor_hue = np.mean(hsv[:, :, 0][mask_a])

        current_hue = np.mean(hsv[:, :, 0][target_mask])
        diff = current_hue - anchor_hue
        # Determine rotation direction
        if abs(diff) < target_separation:
            shift = target_separation - abs(diff)
            if diff >= 0:
                result[:, :, 0][target_mask] += shift
            else:
                result[:, :, 0][target_mask] -= shift

    result[:, :, 0] = np.mod(result[:, :, 0], 180)
    return cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_HSV2BGR)
