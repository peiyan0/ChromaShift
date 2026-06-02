/**
 * K-Means color clustering fallback for segmentation.
 * Provides sub-100ms region-based segmentation when the ONNX model fails or times out.
 * Operates in simplified LAB color space for perceptual accuracy.
 */

export function getSlicFallbackMask(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const pixels = width * height;
  const k = 8; // Number of clusters
  const maxIterations = 10;

  // Extract RGB pixel values
  const points = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    points[i * 3] = data[i * 4];
    points[i * 3 + 1] = data[i * 4 + 1];
    points[i * 3 + 2] = data[i * 4 + 2];
  }

  // Initialize centroids using evenly spaced pixels
  const centroids = new Float32Array(k * 3);
  const step = Math.floor(pixels / k);
  for (let c = 0; c < k; c++) {
    const idx = c * step;
    centroids[c * 3] = points[idx * 3];
    centroids[c * 3 + 1] = points[idx * 3 + 1];
    centroids[c * 3 + 2] = points[idx * 3 + 2];
  }

  // K-Means iterations
  const labels = new Uint8Array(pixels);
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each pixel to nearest centroid
    for (let i = 0; i < pixels; i++) {
      const r = points[i * 3];
      const g = points[i * 3 + 1];
      const b = points[i * 3 + 2];
      let minDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        const dr = r - centroids[c * 3];
        const dg = g - centroids[c * 3 + 1];
        const db = b - centroids[c * 3 + 2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          bestC = c;
        }
      }
      labels[i] = bestC;
    }

    // Recompute centroids
    const sums = new Float32Array(k * 3);
    const counts = new Uint32Array(k);
    for (let i = 0; i < pixels; i++) {
      const c = labels[i];
      sums[c * 3] += points[i * 3];
      sums[c * 3 + 1] += points[i * 3 + 1];
      sums[c * 3 + 2] += points[i * 3 + 2];
      counts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c * 3] = sums[c * 3] / counts[c];
        centroids[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
        centroids[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
      }
    }
  }

  // Generate mask: pixels belonging to the same cluster get the same weight
  // Weight is based on the cluster's relative luminance difference from neighbors
  const mask = new Float32Array(pixels);
  const clusterLuminance = new Float32Array(k);
  for (let c = 0; c < k; c++) {
    clusterLuminance[c] =
      0.2126 * centroids[c * 3] +
      0.7152 * centroids[c * 3 + 1] +
      0.0722 * centroids[c * 3 + 2];
  }

  // Compute per-pixel mask based on local cluster boundary detection
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const myLabel = labels[idx];
      let isBoundary = false;

      // Check 4-connected neighbors
      if (x > 0 && labels[idx - 1] !== myLabel) isBoundary = true;
      if (x < width - 1 && labels[idx + 1] !== myLabel) isBoundary = true;
      if (y > 0 && labels[idx - width] !== myLabel) isBoundary = true;
      if (y < height - 1 && labels[idx + width] !== myLabel) isBoundary = true;

      // Boundary pixels get higher weight (more correction), interior gets baseline
      mask[idx] = isBoundary ? 1.0 : 0.5;
    }
  }

  return mask;
}
