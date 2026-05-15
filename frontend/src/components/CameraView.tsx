import React, { useEffect, useRef, useState } from 'react';
import { processFrame } from '../services/api';

const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function setupCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
    setupCamera();

    const interval = setInterval(async () => {
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const url = await processFrame(blob);
              setProcessedUrl(url);
            } catch (err) {
              console.error('Frame processing error:', err);
            }
          }
        }, 'image/jpeg', 0.8);
      }
    }, 200); // 5 FPS target for correction

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      {processedUrl ? (
        <img src={processedUrl} className="w-full h-full object-contain" alt="Corrected View" />
      ) : (
        <div className="flex items-center justify-center h-full text-white">Initializing Correction...</div>
      )}
    </div>
  );
};

export default CameraView;