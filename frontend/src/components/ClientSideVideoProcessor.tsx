import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { profileService, type VisionProfile } from '../services/profile';
import { aiPreviewService } from '../services/ai_preview';
import { 
  FiPlay, FiPause, FiDownload, FiCpu, FiCheckCircle, 
  FiSliders, FiInfo, FiAlertCircle 
} from 'react-icons/fi';

const KEYFRAME_INTERVAL = 20;

interface ClientSideVideoProcessorProps {
  file: File;
  onCancel: () => void;
}

export const ClientSideVideoProcessor: React.FC<ClientSideVideoProcessorProps> = ({ file, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [profile, setProfile] = useState<VisionProfile>({ cvd_type: 'deuteranopia', severity: 1.0 });
  const [isLivePreview, setIsLivePreview] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings ref for real-time requestAnimationFrame access
  const settingsRef = useRef({
    cvdType: 'deuteranopia',
    severity: 1.0,
    isLivePreview: true,
    isProcessing: false,
  });

  const videoUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // Refs for keyframe-based YOLO semantic mask
  const segMaskRef = useRef<{ data: Float32Array; w: number; h: number } | null>(null);
  const maskFrameCountRef = useRef<number>(0);
  const maskPendingRef = useRef<boolean>(false);

  useEffect(() => {
    // Synchronize states to refs
    settingsRef.current.cvdType = profile.cvd_type;
    settingsRef.current.severity = profile.severity;
    settingsRef.current.isLivePreview = isLivePreview;
    settingsRef.current.isProcessing = isProcessing;
  }, [profile, isLivePreview, isProcessing]);

  useEffect(() => {
    // Generate object URL for the local video file
    videoUrlRef.current = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = videoUrlRef.current;
    }

    const setupTF = async () => {
      try {
        await tf.ready();
        await tf.setBackend('webgl');
      } catch (err) {
        console.warn('Failed to initialize WebGL backend, falling back to CPU/WASM:', err);
      }
    };

    const initProcessor = async () => {
      try {
        await setupTF();

        try {
          const savedProfile = await profileService.getProfile();
          setProfile({
            cvd_type: savedProfile.cvd_type || 'deuteranopia',
            severity: savedProfile.severity !== undefined ? savedProfile.severity : 1.0
          });
        } catch (err) {
          console.log("Could not load vision profile, using default values");
        }

        setIsInitializing(false);
      } catch (error) {
        setErrorMsg('Could not initialize WebGL accelerator for GPU video processing.');
        setIsInitializing(false);
      }
    };

    initProcessor();

    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [file]);

  const startRenderLoop = () => {
    if (animationFrameIdRef.current) return;

    let lastTime = performance.now();
    let frameCount = 0;

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      if (video.paused || video.ended || video.readyState < 2) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      const { cvdType, severity, isLivePreview: activePreview, isProcessing: activeProcessing } = settingsRef.current;

      if (!activePreview && !activeProcessing) {
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        const w = canvas.width;
        const h = canvas.height;

        maskFrameCountRef.current++;
        if (maskFrameCountRef.current % KEYFRAME_INTERVAL === 0 && !maskPendingRef.current) {
          maskPendingRef.current = true;
          const offscreen = new OffscreenCanvas(w, h);
          const octx = offscreen.getContext('2d')!;
          octx.drawImage(video, 0, 0, w, h);
          const imageData = octx.getImageData(0, 0, w, h);
          aiPreviewService.getSemanticMask(imageData).then(data => {
            segMaskRef.current = { data, w, h };
            maskPendingRef.current = false;
          }).catch(() => {
            maskPendingRef.current = false;
          });
        }

        tf.tidy(() => {
          const inputTensor = tf.browser.fromPixels(video);
          const imgFloat = tf.cast(inputTensor, 'float32');

          const stored = segMaskRef.current;
          const maskData = (stored && stored.w === w && stored.h === h)
            ? stored.data
            : new Float32Array(w * h).fill(1.0);
          const maskTensor = tf.tensor3d(maskData, [h, w, 1]);

          const rgb2lms = [
            [0.3904725,  0.54990437, 0.00890159],
            [0.07092586, 0.96310739, 0.00135809],
            [0.02314268, 0.12801221, 0.93605194]
          ];
          const lms2rgb = [
            [ 2.85831110, -1.62870796, -0.02481870],
            [-0.21043478,  1.15841493,  0.00032046],
            [-0.04188950, -0.11815433,  1.06888657]
          ];
          
          let cvd: number[][];
          let err2mod: number[][];
          
          if (cvdType === 'protanopia') {
            cvd = [
              [0.0, 0.90822864, 0.00819200],
              [0.0, 1.0,        0.0],
              [0.0, 0.0,        1.0]
            ];
            err2mod = [
              [0.0, 0.0, 0.0],
              [0.7, 1.0, 0.0],
              [0.7, 0.0, 1.0]
            ];
          } else if (cvdType === 'tritanopia') {
            cvd = [
              [1.0,         0.0,        0.0],
              [0.0,         1.0,        0.0],
              [-0.15773032, 1.19465634, 0.0]
            ];
            err2mod = [
              [1.0, 0.0, 0.7],
              [0.0, 1.0, 0.7],
              [0.0, 0.0, 0.0]
            ];
          } else {
            cvd = [
              [1.0,        0.0, 0.0],
              [1.10104433, 0.0, -0.00901975],
              [0.0,        0.0, 1.0]
            ];
            err2mod = [
              [1.0, 0.7, 0.0],
              [0.0, 0.0, 0.0],
              [0.0, 0.7, 1.0]
            ];
          }

          const matMul3x3 = (A: number[][], B: number[][]) => {
            const C = Array(3).fill(0).map(() => Array(3).fill(0));
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                let sum = 0;
                for (let k = 0; k < 3; k++) {
                  sum += A[i][k] * B[k][j];
                }
                C[i][j] = sum;
              }
            }
            return C;
          };
          
          const matSub3x3 = (A: number[][], B: number[][]) => {
            const C = Array(3).fill(0).map(() => Array(3).fill(0));
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                C[i][j] = A[i][j] - B[i][j];
              }
            }
            return C;
          };
          
          const identity3x3 = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
          ];

          const S_mat = matMul3x3(matMul3x3(lms2rgb, cvd), rgb2lms);
          const I_minus_S = matSub3x3(identity3x3, S_mat);
          const M_err_remap = matMul3x3(err2mod, I_minus_S);
          const M_err_remap_transposed = [
            [M_err_remap[0][0], M_err_remap[1][0], M_err_remap[2][0]],
            [M_err_remap[0][1], M_err_remap[1][1], M_err_remap[2][1]],
            [M_err_remap[0][2], M_err_remap[1][2], M_err_remap[2][2]]
          ];

          const norm = imgFloat.div(tf.scalar(255.0));
          const cond = norm.lessEqual(tf.scalar(0.04045));
          const lowVals = norm.div(tf.scalar(12.92));
          const highVals = tf.pow(norm.add(tf.scalar(0.055)).div(tf.scalar(1.055)), tf.scalar(2.4));
          const linearized = tf.where(cond, lowVals, highVals);

          const flatLinear = linearized.reshape([-1, 3]);
          const errRemapTensor = tf.tensor2d(M_err_remap_transposed);
          const flatCorr = tf.matMul(flatLinear, errRemapTensor);
          const rawCorr = flatCorr.reshape([h, w, 3]);

          const effectiveMask = tf.scalar(0.4).add(maskTensor.mul(tf.scalar(0.6)));
          const m = effectiveMask.mul(tf.scalar(severity));

          const correctedLinear = linearized.add(rawCorr.mul(m));

          const clippedLinear = tf.clipByValue(correctedLinear, 0.0, 1.0);
          const condSRGB = clippedLinear.lessEqual(tf.scalar(0.0031308));
          const lowSRGB = clippedLinear.mul(tf.scalar(12.92));
          const highSRGB = tf.scalar(1.055).mul(tf.pow(clippedLinear, tf.scalar(1 / 2.4))).sub(tf.scalar(0.055));
          const correctedSRGB = tf.where(condSRGB, lowSRGB, highSRGB).mul(tf.scalar(255.0));

          const outputTensor = tf.cast(tf.clipByValue(correctedSRGB, 0, 255), 'int32');

          tf.browser.toPixels(outputTensor as tf.Tensor3D, canvas);
        });
      }

      if (activeProcessing) {
        const curProgress = (video.currentTime / video.duration) * 100;
        setProgress(curProgress);

        if (video.currentTime >= video.duration - 0.1 || video.ended) {
          stopExport();
          return;
        }
      }

      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);
  };

  const stopRenderLoop = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      stopRenderLoop();
    } else {
      video.play().then(() => {
        setIsPlaying(true);
        startRenderLoop();
      });
    }
  };

  const handleStartExport = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
    stopRenderLoop();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const stream = canvas.captureStream(30);
    const combinedStream = new MediaStream([stream.getVideoTracks()[0]]);

    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream.addTrack(audioTracks[0]);
        }
      }
    } catch (e) {
      console.log("No audio track detected or captured from source video.");
    }

    recordedChunksRef.current = [];
    let recorder: MediaRecorder;
    
    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    try {
      recorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      recorder = new MediaRecorder(combinedStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setIsProcessing(false);
      setProgress(100);
    };

    recorderRef.current = recorder;
    setIsProcessing(true);
    setProgress(0);

    video.muted = true;
    
    recorder.start();
    video.play().then(() => {
      setIsPlaying(true);
      startRenderLoop();
    });
  };

  const stopExport = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = false;
    }
    setIsPlaying(false);
    stopRenderLoop();

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleDownload = () => {
    if (!exportUrl) return;
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = `daltonized_${file.name.split('.')[0]}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setExportUrl(null);
    setProgress(0);
    setIsProcessing(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
    }
  };

  return (
    <div 
      className="card-solid"
      style={{
        width: '100%',
        maxWidth: '750px',
        margin: '0 auto',
        padding: 0,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-primary)'
      }}
    >
      {/* Header bar */}
      <div 
        style={{
          background: 'var(--primary-gradient)',
          padding: '16px 24px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div className="hstack gap-3">
          <FiCpu size={24} style={{ color: '#fbbf24' }} />
          <div className="vstack" style={{ alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, color: 'white', fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>Local GPU Video Remapper</h3>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>Zero uploads. Processed entirely on your machine.</span>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="btn btn-sm btn-outline"
          style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          Cancel
        </button>
      </div>

      <div style={{ padding: '24px' }} className="vstack gap-6">
        
        {errorMsg && (
          <div className="badge badge-error" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', textTransform: 'none', display: 'flex', gap: '8px' }}>
            <FiAlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {isInitializing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '16px' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Initializing GPU Pipeline...</span>
          </div>
        ) : (
          <div className="vstack gap-6" style={{ width: '100%', alignItems: 'stretch' }}>
            
            {/* Info Banner */}
            {!isProcessing && !exportUrl && (
              <div 
                className="badge badge-primary" 
                style={{ 
                  padding: '14px', 
                  borderRadius: 'var(--radius-md)', 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'flex-start',
                  textTransform: 'none',
                  fontWeight: 'var(--fw-medium)',
                  lineHeight: '1.4'
                }}
              >
                <FiInfo size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Adjust deficiency type and correction severity to see active shifts. Click <strong>Start GPU Remap</strong> to compile and export the video.
                </span>
              </div>
            )}

            {/* Video Canvas Container */}
            <div 
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                backgroundColor: 'black',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-secondary)'
              }}
            >
              {/* Native video tag */}
              <video
                ref={videoRef}
                playsInline
                muted
                preload="auto"
                crossOrigin="anonymous"
                style={{ display: 'none' }}
                onEnded={() => {
                  setIsPlaying(false);
                  if (!isProcessing) stopRenderLoop();
                }}
              />

              {/* Display canvas */}
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />

              {/* Exporting loading layer */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  gap: '16px',
                  zIndex: 10
                }}>
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <strong style={{ color: 'white', fontSize: '0.95rem' }}>RENDERING remapped frames...</strong>
                  
                  <div style={{ width: '80%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.1s ease-out' }} />
                  </div>
                  
                  <div className="hstack" style={{ justifyContent: 'space-between', width: '80%', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <span>{Math.round(progress)}% compiled</span>
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{fps} FPS processing</span>
                  </div>

                  <button onClick={stopExport} className="btn btn-sm btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                    Abort Export
                  </button>
                </div>
              )}

              {/* Success screen layer */}
              {exportUrl && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  gap: '20px',
                  zIndex: 10
                }}>
                  <FiCheckCircle size={48} style={{ color: 'var(--color-success)' }} />
                  <div className="vstack gap-1" style={{ textAlign: 'center' }}>
                    <h4 style={{ color: 'white', margin: 0, fontFamily: 'var(--font-heading)' }}>Export Completed Successfully</h4>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Local GPU Daltonization rendering finished.</span>
                  </div>
                  <div className="hstack gap-3">
                    <button onClick={handleDownload} className="btn btn-primary">
                      <FiDownload size={14} />
                      <span>Download Video</span>
                    </button>
                    <button onClick={handleReset} className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Play Preview control strip */}
            {!isProcessing && !exportUrl && (
              <div 
                className="hstack" 
                style={{
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <button onClick={handlePlayPause} className="btn btn-sm btn-primary">
                  {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
                  <span>{isPlaying ? 'Pause Preview' : 'Play Live Preview'}</span>
                </button>

                <div className="hstack gap-4" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    GPU Accelerator: <span style={{ color: 'var(--primary)' }}>{isPlaying ? `${fps} FPS` : 'Online'}</span>
                  </span>
                  
                  {/* Switch toggle re-styled */}
                  <label className="hstack gap-2" style={{ cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={isLivePreview}
                      onChange={e => setIsLivePreview(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Correction Applied</span>
                  </label>
                </div>
              </div>
            )}

            {/* Parameter Adjustment Panel */}
            {!isProcessing && !exportUrl && (
              <div className="card-solid vstack gap-4" style={{ padding: '20px', border: '1px solid var(--border-primary)' }}>
                <div className="hstack gap-2">
                  <FiSliders size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Remap Parameters
                  </span>
                </div>

                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: '100%' }}>
                  <div className="form-group">
                    <label className="label" htmlFor="cvd-type-select">CVD Type</label>
                    <select
                      id="cvd-type-select"
                      value={profile.cvd_type}
                      onChange={e => setProfile(prev => ({ ...prev, cvd_type: e.target.value as any }))}
                      className="select"
                    >
                      <option value="deuteranopia">Green-Blind (Deuteranopia)</option>
                      <option value="protanopia">Red-Blind (Protanopia)</option>
                      <option value="tritanopia">Blue-Blind (Tritanopia)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <label className="label">Correction Strength</label>
                      <span className="text-mono" style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {Math.round(profile.severity * 100)}%
                      </span>
                    </div>
                    <div className="slider-container">
                      <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.05"
                        value={profile.severity}
                        onChange={e => setProfile(prev => ({ ...prev, severity: parseFloat(e.target.value) }))}
                        className="slider"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleStartExport}
                  className="btn btn-lg btn-primary"
                  style={{ width: '100%', marginTop: '8px', padding: '12px' }}
                >
                  Start GPU Remap & Export Video
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
