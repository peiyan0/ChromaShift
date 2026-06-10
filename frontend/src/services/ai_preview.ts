import { getSlicFallbackMask } from './fallback_slic';
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

// YOLO26n-seg: NMS-free instance segmentation from Ultralytics
// https://docs.ultralytics.com/models/yolo26
// const MODEL_INT8_URL = 'https://huggingface.co/peiyan2/cvd-onnx-models/resolve/main/yolo26n-seg_int8.onnx';
const MODEL_INT8_URL = '/models/yolo26n-seg_int8.onnx';
const CACHE_NAME    = 'chromashift-models-v3';

export class AIPreviewService {
  private session: ort.InferenceSession | null = null;
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  public onLoadProgress: ((progress: number) => void) | null = null;

  constructor() {
    this.loadingPromise = this.initModel();
  }

  private async initModel(): Promise<void> {
    // Default to the INT8 version for browser-based projects for optimal performance,
    // as it is lightweight (3.32MB vs 11.2MB), downloads faster, and uses less RAM.
    const url = MODEL_INT8_URL;

    try {
      const modelBuffer = await this.fetchModelWithCache(url);
      const modelData = modelBuffer instanceof Uint8Array ? modelBuffer : new Uint8Array(modelBuffer);

      // Verify if the buffer is actually HTML content (starts with '<' which is ASCII 60)
      if (modelData.length > 0 && modelData[0] === 60) {
        throw new Error('Fetched model data is HTML content, not a valid ONNX binary. This usually happens due to SPA router rewrite.');
      }

      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['wasm'],
      });
      this.isLoaded = true;
      console.log('YOLO26n-seg ONNX (int8) loaded successfully.');
    } catch (error) {
      console.error('Failed to load YOLO26n-seg ONNX:', error);
      // Evict corrupted model from cache so the next reload tries a fresh download
      if ('caches' in self) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.delete(url);
          console.log('Evicted corrupted model from Cache API:', url);
        } catch (cacheError) {
          console.warn('Failed to evict model from Cache API:', cacheError);
        }
      }
    }
  }

  /**
   * Runtime fetch with Cache API: checks cache first, fetches from CDN if absent,
   * reports download progress, and stores in cache for subsequent loads.
   */
  private async fetchModelWithCache(url: string): Promise<ArrayBuffer> {
    // Check Cache API first
    if ('caches' in self) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) {
          // Verify cached response before using it
          const cachedBuffer = await cached.arrayBuffer();
          const cachedData = new Uint8Array(cachedBuffer);
          if (cachedData.length > 0 && cachedData[0] === 60) {
            console.warn('Cached response is HTML, deleting from cache...');
            await cache.delete(url);
          } else {
            console.log('Model loaded from Cache API.');
            return cachedBuffer;
          }
        }
      } catch (e) {
        console.warn('Cache API check failed:', e);
      }
    }

    // Fetch from network with progress tracking
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Model fetch failed: ${response.status}`);

    // Verify response content-type to prevent caching fallback HTML
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Fetched model URL returned HTML content instead of binary data. Check static file routing.');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && this.onLoadProgress) {
        this.onLoadProgress(Math.round((received / contentLength) * 100));
      }
    }

    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Store in Cache API for next time
    if ('caches' in self) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, new Response(buffer.buffer));
      } catch (e) {
        console.warn('Failed to cache model:', e);
      }
    }

    return buffer.buffer;
  }

  /**
   * Generates a semantic mask using YOLO26n-seg ONNX.
   *
   * YOLO26 is NMS-free: it uses one-to-one assignment during training so the
   * exported ONNX already produces matched (non-duplicate) predictions. We only
   * need to apply a confidence threshold — no NMS post-processing required.
   *
   * Falls back to K-Means SLIC on timeout or failure.
   */
  public async getSemanticMask(imageData: ImageData): Promise<Float32Array> {
    // Wait for model to finish loading if still in progress
    if (this.loadingPromise) {
      await this.loadingPromise;
      this.loadingPromise = null;
    }

    if (!this.isLoaded || !this.session) {
      console.warn('YOLO26n-seg not loaded. Falling back to SLIC.');
      return getSlicFallbackMask(imageData);
    }

    try {
      return await Promise.race([
        this.runSegmentation(imageData),
        this.timeoutPromise(2000),
      ]);
    } catch (error) {
      console.warn('Segmentation timed out or failed. Falling back to SLIC.', error);
      return getSlicFallbackMask(imageData);
    }
  }

  private async runSegmentation(imageData: ImageData): Promise<Float32Array> {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = width * height;
    const inputSize = 640;

    // Resize to 640×640 using canvas for YOLO input
    const offscreen = new OffscreenCanvas(inputSize, inputSize);
    const ctx = offscreen.getContext('2d')!;
    const srcCanvas = new OffscreenCanvas(width, height);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, inputSize, inputSize);
    const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);

    // Convert to NCHW float32 tensor normalised to [0, 1]
    const inputPixels = inputSize * inputSize;
    const floatArray = new Float32Array(3 * inputPixels);
    for (let i = 0; i < inputPixels; i++) {
      floatArray[i]                    = resizedData.data[i * 4]     / 255.0; // R
      floatArray[inputPixels + i]      = resizedData.data[i * 4 + 1] / 255.0; // G
      floatArray[2 * inputPixels + i]  = resizedData.data[i * 4 + 2] / 255.0; // B
    }

    const tensor = new ort.Tensor('float32', floatArray, [1, 3, inputSize, inputSize]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session!.inputNames[0]] = tensor;

    const results = await this.session!.run(feeds);

    const outputNames = this.session!.outputNames;
    let detectOutput = results[outputNames[0]];
    let protoOutput  = results[outputNames[1]];

    // Normalise output order: detectOutput → [1, channels, boxes], protoOutput → [1, 32, pH, pW]
    if (detectOutput.dims.length === 4 && protoOutput.dims.length === 3) {
      [detectOutput, protoOutput] = [protoOutput, detectOutput];
    } else if (detectOutput.dims[1] === 32 && protoOutput.dims[1] !== 32) {
      [detectOutput, protoOutput] = [protoOutput, detectOutput];
    }

    const detectData = detectOutput.data as Float32Array;
    const protoData  = protoOutput.data  as Float32Array;

    const numChannels = detectOutput.dims[1]; // 4 + num_classes + 32
    const numBoxes    = detectOutput.dims[2]; // matched predictions (NMS-free, already deduplicated)

    const protoHeight = protoOutput.dims[2]; // e.g. 160
    const protoWidth  = protoOutput.dims[3]; // e.g. 160

    // YOLO26 is NMS-free: predictions are already one-to-one matched.
    // Simply confidence-filter; no sorting or NMS needed.
    const confThreshold = 0.25;
    const compositeProtoMask = new Float32Array(protoHeight * protoWidth);
    const coeffStart = numChannels - 32;

    for (let c = 0; c < numBoxes; c++) {
      // Find the best class score for this prediction
      let maxScore = 0;
      for (let cl = 4; cl < coeffStart; cl++) {
        const score = detectData[cl * numBoxes + c];
        if (score > maxScore) maxScore = score;
      }

      if (maxScore <= confThreshold) continue;

      // Decode box (cx, cy, w, h) in input-space pixels
      const cx = detectData[0 * numBoxes + c];
      const cy = detectData[1 * numBoxes + c];
      const bw = detectData[2 * numBoxes + c];
      const bh = detectData[3 * numBoxes + c];
      const x1 = cx - bw / 2;
      const y1 = cy - bh / 2;
      const x2 = cx + bw / 2;
      const y2 = cy + bh / 2;

      // Clamp box to proto-mask coordinate space
      const px1 = Math.max(0, Math.floor((x1 / inputSize) * protoWidth));
      const py1 = Math.max(0, Math.floor((y1 / inputSize) * protoHeight));
      const px2 = Math.min(protoWidth  - 1, Math.ceil((x2 / inputSize) * protoWidth));
      const py2 = Math.min(protoHeight - 1, Math.ceil((y2 / inputSize) * protoHeight));

      // Read the 32 mask coefficients for this prediction
      const coeffs = new Float32Array(32);
      for (let i = 0; i < 32; i++) {
        coeffs[i] = detectData[(coeffStart + i) * numBoxes + c];
      }

      // Decode instance mask: sigmoid(proto @ coeffs^T) within the bounding box
      for (let py = py1; py <= py2; py++) {
        for (let px = px1; px <= px2; px++) {
          let val = 0;
          for (let k = 0; k < 32; k++) {
            val += coeffs[k] * protoData[k * protoHeight * protoWidth + py * protoWidth + px];
          }
          const sigmoidVal = 1 / (1 + Math.exp(-val));
          if (sigmoidVal > 0.5) {
            const idx = py * protoWidth + px;
            if (sigmoidVal > compositeProtoMask[idx]) {
              compositeProtoMask[idx] = sigmoidVal;
            }
          }
        }
      }
    }

    // Upscale proto-resolution mask to original image dimensions via canvas bilinear
    const maskCanvas = new OffscreenCanvas(protoWidth, protoHeight);
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImageData = maskCtx.createImageData(protoWidth, protoHeight);
    for (let i = 0; i < protoWidth * protoHeight; i++) {
      const val = Math.round(compositeProtoMask[i] * 255);
      maskImageData.data[i * 4]     = val;
      maskImageData.data[i * 4 + 1] = val;
      maskImageData.data[i * 4 + 2] = val;
      maskImageData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    const finalCanvas = new OffscreenCanvas(width, height);
    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.drawImage(maskCanvas, 0, 0, width, height);
    const finalData = finalCtx.getImageData(0, 0, width, height);

    const mask = new Float32Array(pixels);
    for (let i = 0; i < pixels; i++) {
      mask[i] = finalData.data[i * 4] / 255.0;
    }

    // If nothing was detected, return a uniform mask so colour remapping still applies
    const hasDetections = mask.some(v => v > 0);
    if (!hasDetections) return new Float32Array(pixels).fill(1.0);

    return mask;
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }
}

export const aiPreviewService = new AIPreviewService();
