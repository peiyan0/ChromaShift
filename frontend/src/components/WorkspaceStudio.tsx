import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mediaService, type MediaStatusResponse } from '../services/media';
import { complianceService, type ComplianceReportResponse } from '../services/compliance';
import { profileService, type VisionProfile } from '../services/profile';
import api from '../services/api';
import { aiPreviewService } from '../services/ai_preview';
import { 
  FiArrowLeft, FiColumns, FiMaximize2, FiDownload, FiShare2, 
  FiRefreshCw, FiAlertTriangle, FiAlertCircle, FiExternalLink, FiTrash2
} from 'react-icons/fi';

export const WorkspaceStudio: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<MediaStatusResponse | null>(null);
  const [report, setReport] = useState<ComplianceReportResponse | null>(null);
  const [mediaType, setMediaType] = useState<string>('image');
  const [fileName, setFileName] = useState<string>('Loading file...');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'side-by-side' | 'toggle'>('side-by-side');
  
  // Processing status messages
  const processingMessages = [
    "Uploading your file securely...",
    "Applying color corrections tailored to your vision...",
    "Did you know? 1 in 12 men are color blind",
    "Almost done preparing your accessible media...",
    "Red-green color blindness is the most common type",
    "Generating your compliance report..."
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    if (status?.status === 'processing' || status?.status === 'uploaded') {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % processingMessages.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [status?.status]);
  
  // Image Zoom & Pan States
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.25, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPanOffset({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  const [toggleActive, setToggleActive] = useState<'original' | 'processed'>('processed');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dynamic Filtering State
  const [profile, setProfile] = useState<VisionProfile | null>(null);
  const [intensity, setIntensity] = useState<number>(1.0);
  const [selectedPreviewCvd, setSelectedPreviewCvd] = useState<'profile' | 'deuteranopia' | 'protanopia' | 'tritanopia'>('profile');

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Video Synced References
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const processedVideoRef = useRef<HTMLVideoElement>(null);
  const isSyncing = useRef<boolean>(false);
  const [aiMaskStatus, setAiMaskStatus] = useState<string>('pending');
  const maskInitiated = useRef<boolean>(false);

  useEffect(() => {
    if (jobId) {
      maskInitiated.current = false;
      setAiMaskStatus('pending');
      loadWorkspace();
    }
  }, [jobId]);

  useEffect(() => {
    let timeoutId: any;
    let delay = 2000;
    
    const tick = async () => {
      if (status?.status === 'processing' || status?.status === 'uploaded') {
        try {
          await loadWorkspace(true);
          delay = Math.min(delay + 1000, 6000);
        } catch (err) {
          console.error("Workspace status polling failed:", err);
          delay = Math.min(delay * 1.5, 10000);
        }
        timeoutId = setTimeout(tick, delay);
      }
    };

    if (status?.status === 'processing' || status?.status === 'uploaded') {
      timeoutId = setTimeout(tick, delay);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status?.status, jobId]);

  useEffect(() => {
    const loadProfile = async () => {
      let p = null;
      const cached = localStorage.getItem('chromashift_cvd_profile');
      if (cached) {
        try { p = JSON.parse(cached); } catch (_) {}
      }
      if (!p) {
        try { p = await profileService.getProfile(); } catch (_) {}
      }
      if (p) {
        setProfile(p);
        setIntensity(p.severity || 1.0);
      }
    };
    loadProfile();
  }, []);

  const triggerNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadWorkspace = async (isPolling = false) => {
    if (!jobId) return;
    if (!isPolling) setIsLoading(true);
    try {
      const statusRes = await mediaService.getMediaStatus(jobId);
      setStatus(statusRes);
      
      if (statusRes.download_url_original && !maskInitiated.current) {
        maskInitiated.current = true;
        setAiMaskStatus('generating');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              await aiPreviewService.getSemanticMask(imgData);
              setAiMaskStatus('complete');
            }
          } catch (e) {
            setAiMaskStatus('fallback');
          }
        };
        img.src = statusRes.download_url_original;
      }
      
      const ext = statusRes.download_url?.split('?')[0].split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
        setMediaType('video');
      } else if (ext === 'pdf') {
        setMediaType('pdf');
      } else {
        setMediaType('image');
      }

      if (statusRes.filename) {
        setFileName(statusRes.filename);
      }
      if (statusRes.media_type) {
        setMediaType(statusRes.media_type);
      } else {
        const ext = statusRes.download_url?.split('?')[0].split('.').pop()?.toLowerCase() || '';
        if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
          setMediaType('video');
        } else if (ext === 'pdf') {
          setMediaType('pdf');
        } else {
          setMediaType('image');
        }
      }

      try {
        const reportRes = await complianceService.getReport(jobId);
        setReport(reportRes);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setReport(null);
        }
      }

    } catch (error) {
      triggerNotification('error', 'Workspace load failed. Could not fetch media info.');
      navigate('/hub');
    } const finallyBlock = () => {
      if (!isPolling) setIsLoading(false);
    };
    finallyBlock();
  };

  const handleRunAudit = async () => {
    if (!jobId) return;
    setIsAuditing(true);
    try {
      const reportRes = await complianceService.runCheck(jobId);
      setReport(reportRes);
      triggerNotification('success', 'Accessibility Audit Complete');
    } catch (error) {
      triggerNotification('error', 'Accessibility Audit Failed');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleReprocess = async () => {
    if (!jobId) return;
    setIsReprocessing(true);
    try {
      const cvdType = profile?.cvd_type || (profile as any)?.type || 'deuteranopia';
      await mediaService.processMedia(jobId, { severity: intensity, cvd_type: cvdType });
      triggerNotification('info', 'Re-rendering started on the server.');
      setIsDirty(false);
      await loadWorkspace();
    } catch (error) {
      triggerNotification('error', 'Reprocessing failed.');
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleDownload = async () => {
    if (!jobId) return;
    try {
      const response = await mediaService.getDownloadUrl(jobId);
      const downloadUrl = response.url;
      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = fileName !== 'Loading file...' ? fileName : 'processed_media';
      const ext = downloadUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
      const baseWithoutExt = baseName.substring(0, baseName.lastIndexOf('.')) || baseName;
      a.download = `${baseWithoutExt}_processed.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Programmatic download failed, falling back to window.open", err);
      if (status?.download_url) {
        window.open(status.download_url, '_blank');
      } else {
        triggerNotification('error', 'Download link generation failed');
      }
    }
  };

  const handleShare = async () => {
    if (!jobId) return;
    setIsSharing(true);
    try {
      const data = await mediaService.shareMedia(jobId);
      await navigator.clipboard.writeText(data.share_url);
      triggerNotification('success', 'Accessible share link copied!');
    } catch (error) {
      triggerNotification('error', 'Share Link Generation Failed');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!jobId) return;
    if (!window.confirm("Are you sure you want to permanently delete this uploaded file? This action cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await mediaService.deleteMedia(jobId);
      triggerNotification('success', 'File deleted. Media cleared from storage.');
      navigate('/hub');
    } catch (err) {
      triggerNotification('error', 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportReport = async () => {
    if (!jobId) return;
    try {
      const response = await api.get(`compliance/${jobId}/report`, {
        responseType: 'blob'
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility_report_${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      triggerNotification('error', 'Export Failed');
    }
  };

  const syncPlayback = (source: 'processed' | 'original') => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const sourceVideo = source === 'processed' ? processedVideoRef.current : originalVideoRef.current;
    const targetVideo = source === 'processed' ? originalVideoRef.current : processedVideoRef.current;

    if (sourceVideo && targetVideo) {
      if (sourceVideo.paused && !targetVideo.paused) {
        targetVideo.pause();
      } else if (!sourceVideo.paused && targetVideo.paused) {
        targetVideo.play().catch(() => {});
      }
      if (Math.abs(targetVideo.currentTime - sourceVideo.currentTime) > 0.05) {
        targetVideo.currentTime = sourceVideo.currentTime;
      }
    }

    setTimeout(() => {
      isSyncing.current = false;
    }, 15);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
        <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading Workspace Studio...</span>
      </div>
    );
  }

  if (status?.status === 'processing' || status?.status === 'uploaded') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '24px', gap: '16px', maxWidth: '460px', margin: '0 auto' }}>
        <div className="skeleton animate-pulse-border" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
        <h3 style={{ fontFamily: 'var(--font-heading)' }}>AI Re-rendering File...</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          We are applying your personalized color corrections. This will just take a moment.
        </p>
        <div 
          style={{ 
            fontSize: '0.8rem', 
            color: 'var(--primary)', 
            fontWeight: '600', 
            fontStyle: 'italic',
            backgroundColor: 'var(--primary-glow)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--primary)',
            animation: 'pulse 2s infinite ease-in-out'
          }}
        >
          {processingMessages[loadingMessageIndex]}
        </div>
        <button onClick={() => loadWorkspace()} className="btn btn-outline">
          <FiRefreshCw size={14} />
          <span>Check Status</span>
        </button>
      </div>
    );
  }

  if (status?.status === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '24px', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
        <FiAlertCircle size={48} style={{ color: 'var(--color-error)' }} />
        <h3 style={{ fontFamily: 'var(--font-heading)' }}>AI Processing Failed</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          An error occurred in our server pipeline while trying to Daltonize this asset.
        </p>
        <button onClick={() => navigate('/hub')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const getFilterStyle = (isProcessed: boolean) => {
    if (!isProcessed) {
      if (selectedPreviewCvd !== 'profile') {
        return `url(#sim-${selectedPreviewCvd})`;
      }
      return 'none';
    }
    if (selectedPreviewCvd !== 'profile') {
      return `url(#sim-${selectedPreviewCvd})`;
    }
    
    const contrast = profile?.contrast_multiplier !== undefined ? profile.contrast_multiplier : 1.0;
    const saturate = profile?.saturation_multiplier !== undefined ? profile.saturation_multiplier : 1.0;
    
    return `contrast(${contrast}) saturate(${saturate})`;
  };

  return (
    <>
      {/* Local Notification Alerts */}
      {notification && (
        <div className={`badge badge-${notification.type}`} style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: 'none',
          textTransform: 'none',
          fontWeight: 'bold',
          backgroundColor: notification.type === 'success' ? 'var(--color-success)' : notification.type === 'error' ? 'var(--color-error)' : 'var(--color-info)',
          color: '#ffffff',
          animation: 'slide-up 0.2s ease-out'
        }}>
          {notification.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', position: 'relative' }}>

      {/* Hidden simulator SVG filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="sim-deuteranopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values="0.41563 0.58437 0 0 0  0.41563 0.58437 0 0 0  -0.04239 0.04239 1 0 0  0 0 0 1 0" />
          </filter>
          <filter id="sim-protanopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values="0.06857 0.93143 0 0 0  0.06857 0.93143 0 0 0  0.01365 -0.01365 1 0 0  0 0 0 1 0" />
          </filter>
          <filter id="sim-tritanopia" colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values="1 -0.02323 0.02323 0 0  0 1.0003 -0.0003 0 0  0 1.0003 -0.0003 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      {/* Studio Header Card */}
      <div 
        className="card-solid hstack" 
        style={{
          justifyContent: 'space-between',
          padding: '16px 24px',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-primary)',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div className="hstack gap-4">
          <button 
            onClick={() => navigate('/hub')}
            className="btn btn-ghost"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px' }}
            aria-label="Back to dashboard"
          >
            <FiArrowLeft size={18} />
          </button>
          
          <div className="vstack gap-1" style={{ alignItems: 'flex-start', flex: 1, minWidth: '200px' }}>
            <div className="hstack gap-2" style={{ flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{fileName}</strong>
              <span className="badge badge-primary" style={{ padding: '4px 8px' }}>{mediaType.toUpperCase()}</span>
              {aiMaskStatus === 'complete' && <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '4px 8px' }}>AI Mask Active</span>}
              {aiMaskStatus === 'fallback' && <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '4px 8px' }}>SLIC Fallback Active</span>}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Job ID: {jobId}</span>
          </div>
        </div>

        {/* View Mode Toggle & Action Buttons Container */}
        <div className="hstack gap-3" style={{ flexWrap: 'wrap' }}>
          {/* View Mode Toggle Buttons */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setDisplayMode('side-by-side')}
              className="btn btn-sm"
              style={{
                backgroundColor: displayMode === 'side-by-side' ? 'var(--bg-primary)' : 'transparent',
                border: displayMode === 'side-by-side' ? '1px solid var(--border-primary)' : 'none',
                color: 'var(--text-primary)',
                boxShadow: displayMode === 'side-by-side' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <FiColumns size={14} />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setDisplayMode('toggle')}
              className="btn btn-sm"
              style={{
                backgroundColor: displayMode === 'toggle' ? 'var(--bg-primary)' : 'transparent',
                border: displayMode === 'toggle' ? '1px solid var(--border-primary)' : 'none',
                color: 'var(--text-primary)',
                boxShadow: displayMode === 'toggle' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <FiMaximize2 size={14} />
              <span>Overlay Toggle</span>
            </button>
          </div>

          {/* Action Buttons: Download, Share, Delete */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownload}
              className="btn btn-sm btn-outline"
              title="Download file"
            >
              <FiDownload size={14} />
              <span>Download</span>
            </button>
            
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="btn btn-sm btn-outline"
              title="Copy share link"
            >
              {isSharing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiShare2 size={14} />}
              <span>{isSharing ? 'Sharing...' : 'Share'}</span>
            </button>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn btn-sm btn-outline"
              style={{ color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              title="Delete file permanently"
            >
              {isDeleting ? <FiRefreshCw size={14} className="animate-spin" /> : <FiTrash2 size={14} />}
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="grid gap-6" style={{
        gridTemplateColumns: 'repeat(12, 1fr)',
        alignItems: 'start',
        width: '100%'
      }}>
        
        {/* Left Side Media Render Container */}
        <div 
          className="card-solid"
          style={{
            gridColumn: displayMode === 'side-by-side' ? 'span 12' : 'span 8',
            padding: isMobile ? '12px' : '24px',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
          className-mobile-col="span 12"
        >
          {/* Top simulated filter switcher */}
          <div 
            className="hstack" 
            style={{
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Simulate deficiency:</span>
            <div className="hstack gap-2" style={{ flexWrap: 'wrap' }}>
              <button 
                onClick={() => setSelectedPreviewCvd('profile')}
                className={`btn btn-xs ${selectedPreviewCvd === 'profile' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.65rem' }}
              >
                Corrected View
              </button>
              <button 
                onClick={() => setSelectedPreviewCvd('deuteranopia')}
                className={`btn btn-xs ${selectedPreviewCvd === 'deuteranopia' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.65rem' }}
              >
                Deuteranopia
              </button>
              <button 
                onClick={() => setSelectedPreviewCvd('protanopia')}
                className={`btn btn-xs ${selectedPreviewCvd === 'protanopia' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.65rem' }}
              >
                Protanopia
              </button>
              <button 
                onClick={() => setSelectedPreviewCvd('tritanopia')}
                className={`btn btn-xs ${selectedPreviewCvd === 'tritanopia' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.65rem' }}
              >
                Tritanopia
              </button>
            </div>
          </div>

          {/* Severity Adjuster Panel */}
          {(mediaType === 'image' || mediaType === 'video') && (
            <div className="card-solid vstack gap-3" style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Correction Severity</strong>
                <span className="text-mono" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{Math.round(intensity * 100)}%</span>
              </div>
              
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={intensity}
                  onChange={e => { setIntensity(parseFloat(e.target.value)); setIsDirty(true); }}
                  className="slider"
                />
              </div>

              <div className="hstack" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '70%' }}>
                  Slider modifies dynamic preview instantly. Click Re-Render to save parameters.
                </span>
                <button 
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                  className="btn btn-sm btn-primary"
                >
                  {isReprocessing ? 'Processing...' : 'Apply & Re-Render'}
                </button>
              </div>
            </div>
          )}

          {/* Toggle buttons for overlay display mode */}
          {displayMode === 'toggle' && (
            <div className="hstack" style={{ justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                <button
                  onClick={() => setToggleActive('original')}
                  className={`btn btn-sm ${toggleActive === 'original' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  Original File
                </button>
                <button
                  onClick={() => setToggleActive('processed')}
                  className={`btn btn-sm ${toggleActive === 'processed' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  Corrected View
                </button>
              </div>
            </div>
          )}

          {/* Media Viewport */}
          <div style={{ width: '100%' }}>
            
            {/* Image renderer */}
            {mediaType === 'image' && (
              <div className="vstack gap-4" style={{ width: '100%', alignItems: 'center' }}>
                {/* Zoom Toolbar */}
                <div 
                  className="hstack" 
                  style={{ 
                    justifyContent: 'center', 
                    gap: '12px', 
                    padding: '6px 16px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-primary)',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: 'var(--space-2)'
                  }}
                >
                  <button 
                    onClick={handleZoomOut} 
                    className="btn btn-sm btn-outline" 
                    disabled={zoomLevel <= 1}
                    style={{ padding: '4px 12px', minWidth: '32px', fontSize: '0.8rem', fontWeight: 'bold' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', minWidth: '48px', textAlign: 'center' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button 
                    onClick={handleZoomIn} 
                    className="btn btn-sm btn-outline" 
                    disabled={zoomLevel >= 4}
                    style={{ padding: '4px 12px', minWidth: '32px', fontSize: '0.8rem', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                  {zoomLevel > 1 && (
                    <>
                      <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-primary)' }} />
                      <button 
                        onClick={resetZoom} 
                        className="btn btn-sm btn-ghost" 
                        style={{ fontSize: '0.8rem', color: 'var(--color-error)', padding: '4px 8px' }}
                      >
                        Reset
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        (Drag image to pan)
                      </span>
                    </>
                  )}
                </div>

                {/* Viewports */}
                {displayMode === 'side-by-side' ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', width: '100%' }}>
                    <div className="vstack gap-2" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Original</span>
                      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', width: '100%', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <img 
                          src={status?.download_url_original || ''} 
                          alt="Original uploaded file" 
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          draggable={false}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain',
                            filter: getFilterStyle(false),
                            WebkitFilter: getFilterStyle(false),
                            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                            transformOrigin: 'center center',
                            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            userSelect: 'none'
                          }} 
                        />
                      </div>
                    </div>
                    <div className="vstack gap-2" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {isDirty ? 'Preview (Unsaved Changes)' : 'Calibrated View'}
                      </span>
                      <div style={{ border: isDirty ? '1px solid var(--color-warning)' : '1px solid var(--primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', width: '100%', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <img 
                          src={status?.download_url || (status?.download_url_original || '')} 
                          alt="Corrected remapped file" 
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          draggable={false}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain', 
                            opacity: isDirty ? 0.6 : 1,
                            filter: getFilterStyle(true),
                            WebkitFilter: getFilterStyle(true),
                            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                            transformOrigin: 'center center',
                            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            userSelect: 'none'
                          }} 
                        />
                        {isDirty && !isDragging && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <button onClick={handleReprocess} className="btn btn-sm btn-primary" style={{ backgroundColor: 'var(--color-warning)' }}>
                              Apply Changes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <img
                      src={toggleActive === 'processed' ? (status?.download_url || (status?.download_url_original || '')) : (status?.download_url_original || '')}
                      alt="Single viewport view"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                      draggable={false}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain', 
                        opacity: toggleActive === 'processed' && isDirty ? 0.6 : 1,
                        filter: getFilterStyle(toggleActive === 'processed'),
                        WebkitFilter: getFilterStyle(toggleActive === 'processed'),
                        transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                        transformOrigin: 'center center',
                        cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        userSelect: 'none'
                      }}
                    />
                    {toggleActive === 'processed' && isDirty && !isDragging && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <button onClick={handleReprocess} className="btn btn-sm btn-primary" style={{ backgroundColor: 'var(--color-warning)' }}>
                          Apply Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Video renderer */}
            {mediaType === 'video' && (
              displayMode === 'side-by-side' ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                  <div className="vstack gap-2" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Original</span>
                    <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'black', width: '100%', height: '320px', display: 'flex' }}>
                      <video
                        ref={originalVideoRef}
                        src={status?.download_url_original || ''}
                        controls
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'contain', filter: getFilterStyle(false), WebkitFilter: getFilterStyle(false) }}
                        onPlay={() => syncPlayback('original')}
                        onPause={() => syncPlayback('original')}
                        onSeeking={() => syncPlayback('original')}
                        onSeeked={() => syncPlayback('original')}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          el.addEventListener('fullscreenchange', () => {
                            if (document.fullscreenElement === el) {
                               el.style.filter = getFilterStyle(false);
                               el.style.webkitFilter = getFilterStyle(false);
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="vstack gap-2" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {isDirty ? 'Preview (Unsaved Changes)' : 'Calibrated View'}
                    </span>
                    <div 
                      id="processed-video-container"
                      style={{ border: isDirty ? '1px solid var(--color-warning)' : '1px solid var(--primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'black', width: '100%', height: '320px', display: 'flex', position: 'relative' }}
                    >
                      <video
                        ref={processedVideoRef}
                        src={status?.download_url || (status?.download_url_original || '')}
                        controls
                        muted
                        playsInline
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain', 
                          opacity: isDirty ? 0.6 : 1,
                          filter: getFilterStyle(true),
                          WebkitFilter: getFilterStyle(true)
                        }}
                        onPlay={() => syncPlayback('processed')}
                        onPause={() => syncPlayback('processed')}
                        onSeeking={() => syncPlayback('processed')}
                        onSeeked={() => syncPlayback('processed')}
                        onMouseEnter={(e) => {
                          // Allow native fullscreen but copy simulated filters if native fullscreen events occur
                          const el = e.currentTarget;
                          el.addEventListener('fullscreenchange', () => {
                            if (document.fullscreenElement === el) {
                               el.style.filter = getFilterStyle(true);
                               el.style.webkitFilter = getFilterStyle(true);
                            }
                          });
                        }}
                      />
                      {isDirty && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <button onClick={handleReprocess} className="btn btn-sm btn-primary" style={{ backgroundColor: 'var(--color-warning)' }}>
                            Apply Changes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: 'black', width: '100%', height: '400px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <video
                    key={toggleActive}
                    src={toggleActive === 'processed' ? (status?.download_url || (status?.download_url_original || '')) : (status?.download_url_original || '')}
                    controls
                    autoPlay
                    muted
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'contain', 
                      opacity: toggleActive === 'processed' && isDirty ? 0.6 : 1,
                      filter: getFilterStyle(toggleActive === 'processed'),
                      WebkitFilter: getFilterStyle(toggleActive === 'processed')
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.addEventListener('fullscreenchange', () => {
                        if (document.fullscreenElement === el) {
                          el.style.filter = getFilterStyle(toggleActive === 'processed');
                          el.style.webkitFilter = getFilterStyle(toggleActive === 'processed');
                        }
                      });
                    }}
                  />
                  {toggleActive === 'processed' && isDirty && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <button onClick={handleReprocess} className="btn btn-sm btn-primary" style={{ backgroundColor: 'var(--color-warning)' }}>
                        Apply Changes
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* PDF renderer */}
            {mediaType === 'pdf' && (
              (isMobile || /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? (
                <div className="vstack gap-4" style={{ padding: isMobile ? '16px 12px' : '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', alignItems: 'center', textAlign: 'center' }}>
                  <div className="badge badge-info" style={{ textTransform: 'none', fontWeight: 'bold', padding: '8px 16px' }}>Mobile Viewer Mode</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                    Scrolling PDF files inside frames can be limited on mobile web browsers. Open the documents in a new tab to view, scroll, and zoom using your device's native PDF reader.
                  </p>
                  <div className="vstack gap-2" style={{ width: '100%', maxWidth: '300px' }}>
                    <a 
                      href={status?.download_url_original || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-outline" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                    >
                      <FiExternalLink /> Original PDF
                    </a>
                    <a 
                      href={status?.download_url || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                    >
                      <FiExternalLink /> Calibrated PDF
                    </a>
                  </div>
                </div>
              ) : (
                displayMode === 'side-by-side' ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    <div className="vstack gap-2" style={{ height: '580px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', textAlign: 'center' }}>Original</span>
                      <div style={{ height: '100%', width: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <iframe
                          src={`${status?.download_url_original}#toolbar=0`}
                          width="100%"
                          height="100%"
                          style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', backgroundColor: 'white', minHeight: '580px', filter: getFilterStyle(false), WebkitFilter: getFilterStyle(false) }}
                          title="Original PDF"
                        />
                      </div>
                    </div>
                    <div className="vstack gap-2" style={{ height: '580px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>Calibrated PDF</span>
                      <div style={{ height: '100%', width: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <iframe
                          src={`${status?.download_url}#toolbar=0`}
                          width="100%"
                          height="100%"
                          style={{ border: '1px solid rgba(79, 70, 229, 0.2)', borderRadius: 'var(--radius-md)', backgroundColor: 'white', minHeight: '580px', filter: getFilterStyle(true), WebkitFilter: getFilterStyle(true) }}
                          title="Processed PDF"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '580px', width: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <iframe
                      key={toggleActive}
                      src={toggleActive === 'original' ? (status?.download_url_original || '') : (status?.download_url || '')}
                      width="100%"
                      height="100%"
                      style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', backgroundColor: 'white', minHeight: '580px', filter: getFilterStyle(toggleActive === 'processed'), WebkitFilter: getFilterStyle(toggleActive === 'processed') }}
                      title="PDF Toggle Viewer"
                    />
                  </div>
                )
              )
            )}

          </div>
        </div>

        {/* Right Side Compliance Sidebar Panel */}
        <div 
          className="card-solid"
          style={{
            gridColumn: displayMode === 'side-by-side' ? 'span 12' : 'span 4',
            padding: '24px',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            alignSelf: 'stretch'
          }}
          className-mobile-col="span 12"
        >
          {!report ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center', gap: '16px', height: '100%' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No compliance report exists for this file.</p>
              <button 
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="btn btn-primary"
              >
                {isAuditing ? 'Auditing...' : 'Run Compliance Check'}
              </button>
            </div>
          ) : (
            <div className="vstack gap-6" style={{ alignItems: 'stretch' }}>
              
              {/* Score Arc */}
              <div 
                className="vstack"
                style={{
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                  gap: '16px'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Accessibility Score</span>
                
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  {/* SVG circular arc progress */}
                  <svg width="90" height="90" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--border-primary)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={report.score >= 90 ? 'var(--color-success)' : report.score >= 70 ? 'var(--color-warning)' : 'var(--color-error)'}
                      strokeWidth="3"
                      strokeDasharray={`${report.score}, 100`}
                      style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: 'var(--text-primary)'
                  }}>
                    {Math.round(report.score)}%
                  </div>
                </div>

                <div className="vstack gap-1" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                  <span className={`badge badge-${report.status === 'pass' ? 'success' : report.status === 'fail' ? 'error' : 'warning'}`} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                    {report.status === 'pass' ? '✓ PASS' : report.status === 'fail' ? '✗ FAIL' : '~ PARTIAL'}
                  </span>
                </div>
              </div>

              {/* Actions panel */}
              <div className="vstack gap-3" style={{ alignItems: 'stretch' }}>
                <strong style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Operations</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={handleDownload} className="btn btn-sm btn-primary">
                    <FiDownload size={14} />
                    <span>Download</span>
                  </button>
                  <button onClick={handleShare} disabled={isSharing} className="btn btn-sm btn-outline">
                    {isSharing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiShare2 size={14} />}
                    <span>{isSharing ? 'Sharing...' : 'Share'}</span>
                  </button>
                </div>
                <button onClick={handleExportReport} className="btn btn-sm btn-secondary" style={{ width: '100%' }}>
                  Export JSON Report
                </button>
                <button 
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="btn btn-sm btn-ghost" 
                  style={{ width: '100%', color: 'var(--text-secondary)' }}
                >
                  <FiRefreshCw size={12} />
                  <span>Re-run Audit</span>
                </button>
              </div>

              <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

              {/* Identified Issues */}
              <div className="vstack gap-3" style={{ alignItems: 'stretch' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Identified Violations ({report.issues.length})</strong>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                  {report.issues.length === 0 ? (
                    <div className="badge badge-success" style={{ padding: '12px', textTransform: 'none', display: 'block', borderRadius: 'var(--radius-md)' }}>
                      Excellent! Contrast ratios pass all target checks.
                    </div>
                  ) : (
                    report.issues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className="card-solid"
                        style={{
                          borderLeft: `4px solid ${issue.severity === 'Error' ? 'var(--color-error)' : 'var(--color-warning)'}`,
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderTop: 'none',
                          borderRight: 'none',
                          borderBottom: 'none',
                          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                        }}
                      >
                        <div className="hstack" style={{ justifyContent: 'space-between' }}>
                          <div className="hstack gap-1.5" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {issue.severity === 'Error' ? <FiAlertCircle size={14} style={{ color: 'var(--color-error)' }} /> : <FiAlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />}
                            <span>Criterion {issue.sc_id}</span>
                          </div>
                          <span className={`badge badge-${issue.severity === 'Error' ? 'error' : 'warning'}`} style={{ fontSize: '0.55rem', padding: '1px 6px' }}>
                            {issue.severity}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{issue.description}</p>
                        
                        <div style={{ backgroundColor: 'var(--primary-light)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                          <strong style={{ fontSize: '0.55rem', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Recommendation</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>{issue.suggestion}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Responsive layout fix for mobile sidebar */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @media (max-width: 991px) {
          [className-mobile-col~="span"] {
            grid-column: span 12 !important;
          }
        }
      `}</style>
    </div>
    </>
  );
};
