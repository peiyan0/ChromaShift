import React, { useState, useCallback, useRef, useEffect } from 'react';
import { mediaService } from '../services/media';
import { profileService } from '../services/profile';
import { useNavigate } from 'react-router-dom';
import { ClientSideVideoProcessor } from './ClientSideVideoProcessor';
import { FiCloud, FiCpu, FiAlertCircle, FiFileText } from 'react-icons/fi';

const UploadIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width={props.size || 24} height={props.size || 24} fill="currentColor" {...props}>
    <path d="M14,13V17H10V13H7L12,8L17,13H14M19.35,10.03C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.03C2.34,8.36 0,10.9 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.03Z" />
  </svg>
);

export const DragDropUpload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState(0); // 0 = Server, 1 = Client GPU
  const [alertMessage, setAlertMessage] = useState<{ type: 'info' | 'error' | 'success'; title: string; desc: string } | null>(null);
  const [hasCalibrated, setHasCalibrated] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const pollIntervalRef = useRef<any>(null);

  // Processing status messages
  const processingMessages = [
    "Uploading file securely to cloud storage...",
    "Analyzing image structure and color matrices...",
    "Applying Daltonization color transformation algorithms...",
    "Optimizing contrast for accessibility...",
    "Finalizing image processing...",
    "Generating compliance report..."
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    if (isUploading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % processingMessages.length);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [isUploading]);

  useEffect(() => {
    const checkCalibration = async () => {
      const cached = localStorage.getItem('chromashift_cvd_profile');
      if (cached) {
        setHasCalibrated(true);
        return;
      }
      
      try {
        const profile = await profileService.getProfile();
        if (profile) {
          setHasCalibrated(true);
          localStorage.setItem('chromashift_cvd_profile', JSON.stringify({
            cvd_type: profile.cvd_type,
            severity: profile.severity,
            contrast_multiplier: profile.contrast_multiplier,
            saturation_multiplier: profile.saturation_multiplier,
            intensity: profile.intensity
          }));
          return;
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setHasCalibrated(false);
          return;
        }
      }
      setHasCalibrated(false);
    };
    checkCalibration();
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const cachedPending = localStorage.getItem('chromashift_pending_file');
    if (cachedPending) {
      try {
        const parsed = JSON.parse(cachedPending);
        setAlertMessage({
          type: 'info',
          title: 'Interrupted Session Detected',
          desc: `We found a pending upload for "${parsed.name}" (${(parsed.size / 1024 / 1024).toFixed(2)} MB). Please re-select the file to resume.`,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setAlertMessage({
        type: 'error',
        title: 'Invalid file type',
        desc: 'Please upload a JPEG, PNG, WEBP, AVIF image, MP4 video, or PDF.',
      });
      return;
    }
    setFile(selectedFile);
    setActiveTab(0);
    setAlertMessage(null);

    // Save pending state to localStorage for recovery
    localStorage.setItem('chromashift_pending_file', JSON.stringify({
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      activeTab: 0
    }));
  };

  const loadSample = async (url: string, filename: string, type: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const actualFilename = url.substring(url.lastIndexOf('/') + 1);
      const sampleFile = new File([blob], actualFilename, { type });
      validateAndSetFile(sampleFile);
      setAlertMessage({
        type: 'success',
        title: 'Sample Loaded',
        desc: `Loaded ${filename} successfully.`,
      });
    } catch (e) {
      setAlertMessage({
        type: 'error',
        title: 'Load Failed',
        desc: 'Failed to load the sample file.',
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(10);
    setAlertMessage(null);
    
    // Clear pending session state once upload actively starts
    localStorage.removeItem('chromashift_pending_file');
    
    try {
      // 1. Upload to S3
      const uploadRes = await mediaService.uploadMedia(file);
      setProgress(40);
      
      // Save job ID to localStorage for guest tracking
      const guestJobs = JSON.parse(localStorage.getItem('chromashift_guest_jobs') || '[]');
      if (!guestJobs.includes(uploadRes.job_id)) {
        guestJobs.push(uploadRes.job_id);
        localStorage.setItem('chromashift_guest_jobs', JSON.stringify(guestJobs));
      }
      
      // 2. Trigger processing with the user's calibrated vision profile
      let cvdType = "deuteranopia";
      let severity = 1.0;
      
      // Try local storage baseline fallback first
      const localProfileStr = localStorage.getItem('chromashift_cvd_profile');
      if (localProfileStr) {
        try {
          const localProfile = JSON.parse(localProfileStr);
          cvdType = localProfile.cvd_type || "deuteranopia";
          severity = localProfile.severity !== undefined ? localProfile.severity : 1.0;
        } catch (e) {
          console.error("Failed to parse local profile in DragDropUpload", e);
        }
      }

      try {
        const savedProfile = await profileService.getProfile();
        if (savedProfile) {
          cvdType = savedProfile.cvd_type || "deuteranopia";
          severity = savedProfile.severity !== undefined ? savedProfile.severity : 1.0;
        }
      } catch (err) {
        console.log("Could not load vision profile from server, trying local/default values", err);
        const localProfileStr = localStorage.getItem('chromashift_cvd_profile');
        if (localProfileStr) {
          try {
            const localProfile = JSON.parse(localProfileStr);
            cvdType = localProfile.cvd_type || cvdType;
            severity = localProfile.severity !== undefined ? localProfile.severity : severity;
          } catch (e) {
            console.error("Failed to parse local profile in fallback", e);
          }
        }
      }
      
      await mediaService.processMedia(uploadRes.job_id, { cvd_type: cvdType, severity });
      setProgress(60);

      // 3. Poll for status with progressive backoff
      let delay = 2000;
      let consecutiveErrors = 0;

      const pollStatus = async () => {
        try {
          const statusRes = await mediaService.getMediaStatus(uploadRes.job_id);
          consecutiveErrors = 0; // Reset error counter
          setProgress(60 + (statusRes.progress * 0.4)); // Scale progress to remaining 40%

          if (statusRes.status === 'completed') {
            setProgress(100);
            setIsUploading(false);
            setAlertMessage({
              type: 'success',
              title: 'Processing Complete',
              desc: 'Your accessible file is ready.',
            });
            setTimeout(() => navigate('/hub'), 1500);
            return;
          }
          
          if (statusRes.status === 'failed') {
            setIsUploading(false);
            setAlertMessage({
              type: 'error',
              title: 'Processing Failed',
              desc: 'There was an error processing your file.',
            });
            return;
          }

          delay = Math.min(delay + 1000, 6000);
        } catch (pollErr) {
          consecutiveErrors++;
          console.error("Poll status check error:", pollErr);
          if (consecutiveErrors >= 5) {
            setIsUploading(false);
            setAlertMessage({
              type: 'error',
              title: 'Polling Interrupted',
              desc: 'Lost connection to the backend server.',
            });
            return;
          }
          delay = Math.min(delay * 1.5, 8000);
        }

        pollIntervalRef.current = setTimeout(pollStatus, delay);
      };

      pollIntervalRef.current = setTimeout(pollStatus, delay);

    } catch (error) {
      console.error(error);
      setIsUploading(false);
      setAlertMessage({
        type: 'error',
        title: 'Error',
        desc: 'An unexpected error occurred during upload.',
      });
    }
  };

  const isVideo = file && file.type.startsWith('video/');
  const isPdf = file && file.type === 'application/pdf';
  const isImage = file && file.type.startsWith('image/');

  if (hasCalibrated === null) {
    return (
      <div style={{ display: 'flex', minHeight: '300px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-primary)',
            borderTopColor: 'var(--primary)',
            borderRadius: 'var(--radius-full)',
            animation: 'spin-loading 1s linear infinite'
          }}
        />
        <style>{`
          @keyframes spin-loading {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (hasCalibrated === false) {
    return (
      <div 
        className="card-solid"
        style={{
          width: '100%',
          maxWidth: '850px',
          margin: '0 auto',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-primary)'
        }}
      >
        <div style={{ height: '3px', background: 'var(--primary-gradient)' }} />
        <div style={{ padding: '48px 32px' }} className="vstack gap-6">
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-error)',
            boxShadow: 'var(--shadow-sm)',
            alignSelf: 'center'
          }}>
            <FiAlertCircle size={32} />
          </div>
          
          <div className="vstack gap-2" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h2 className="text-gradient">Calibration Required</h2>
            <p style={{ maxWidth: '500px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Complete vision calibration before uploading media.
            </p>
          </div>

          <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

          <button 
            onClick={() => navigate('/settings')}
            className="btn btn-primary animate-pulse-border"
            style={{ 
              padding: '12px 32px',
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Start Calibration</span>
          </button>
        </div>
      </div>
    );
  }

  if (isVideo && activeTab === 1) {
    return <ClientSideVideoProcessor file={file} onCancel={() => setFile(null)} />;
  }

  return (
    <div 
      className="card-solid"
      style={{
        width: '100%',
        maxWidth: '850px',
        margin: '0 auto',
        padding: 0,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-primary)'
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: '3px', background: 'var(--primary-gradient)' }} />

      <div style={{ padding: '32px' }} className="vstack gap-6">
        
        {/* Header Title */}
        <div className="vstack gap-1" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 className="text-gradient">Upload Media</h2>
          <p style={{ fontSize: '0.875rem' }}>
            Images, videos, or PDFs.
          </p>
        </div>

        {/* Local Notification Alert banner */}
        {alertMessage && (
          <div 
            className={`badge badge-${alertMessage.type}`} 
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              textTransform: 'none',
              fontWeight: 'var(--fw-medium)',
              lineHeight: '1.5',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="vstack" style={{ alignItems: 'flex-start' }}>
              <strong style={{ fontSize: '0.85rem' }}>{alertMessage.title}</strong>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{alertMessage.desc}</span>
            </div>
          </div>
        )}

        {!file ? (
          <>
            {/* Drag Zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={isDragging ? 'animate-pulse-border' : ''}
              style={{
                width: '100%',
                padding: '48px 24px',
                border: isDragging ? '2px solid var(--primary)' : '2px dashed var(--border-secondary)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isDragging ? 'var(--primary-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <UploadIcon size={32} />
              </div>
              <div className="vstack gap-1">
                <strong style={{ fontSize: '0.9rem', color: isDragging ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {isDragging ? 'Drop to upload' : 'Drag & drop, or click to browse'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  JPEG · PNG · WEBP · AVIF · MP4 · PDF  |  Max 100 MB
                </span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,application/pdf"
              />
            </div>

            {/* Sample Loader */}
            <div style={{ width: '100%' }} className="vstack gap-4">
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No file? Try a sample:</strong>
              
              <div className="vstack gap-4">
                {/* Images */}
                <div className="vstack gap-2">
                  <div className="hstack">
                    <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '4px 8px' }}>Images</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {[
                      { url: '/stacked_bar_chart.png', name: 'Financial Trend: Stacked Bar Chart', type: 'image/png' },
                      { url: '/financial_area_chart.png', name: 'Data Analysis: Stacked Area Chart', type: 'image/png' },
                      { url: '/cohort_retention_heatmap.webp', name: 'Product Analytics: Cohort Retention Heatmap', type: 'image/webp' },
                      { url: '/temperature_heatmap.png', name: 'Weather Heatmap: Temperature Map', type: 'image/png' },
                      { url: '/ui_dashboard_metrics.png', name: 'Financial Dashboard Metrics', type: 'image/png' },
                      { url: '/biology_diagram.png', name: 'Educational Infographics: Biology Diagram', type: 'image/png' },
                      { url: '/transit_subway_map.png', name: 'Transit Map: Subway Route', type: 'image/png' },
                      { url: '/pcb_wiring_schematic.avif', name: 'Technical Safety: Wiring Schematic', type: 'image/avif' },
                      { url: '/financial_pie_chart.png', name: 'Data Analysis: Pie Chart', type: 'image/png' },
                      { url: '/nature_orchard.png', name: 'Educational Infographics: Nature Orchard', type: 'image/png' }
                    ].map((s, i) => (
                      <div 
                        key={i} 
                        onClick={() => loadSample(s.url, s.name, s.type)}
                        style={{
                          minWidth: '110px',
                          width: '110px',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: 'var(--bg-primary)'
                        }}
                      >
                        <div style={{ height: '60px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                          <img src={s.url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ padding: '6px', fontSize: '0.65rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={s.name}>
                          {s.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Videos */}
                <div className="vstack gap-2">
                  <div className="hstack">
                    <span className="badge badge-primary" style={{ fontSize: '0.6rem', color: 'var(--primary-violet)', backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: '4px 8px' }}>Videos</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {[
                      { url: '/sports_broadcast.mp4', name: 'Live Sports Broadcast', type: 'video/mp4' },
                      { url: '/trading_charts.mp4', name: 'Trading Charts', type: 'video/mp4' },
                      { url: '/driving_navigation.mp4', name: 'Driving Navigation', type: 'video/mp4' },
                      { url: '/moba_gameplay.mp4', name: 'Gaming Stream: MOBA Gameplay', type: 'video/mp4' },
                      { url: '/medical_imaging.mp4', name: 'Medical Imaging: MRI Review', type: 'video/mp4' },
                      { url: '/industrial_control.mp4', name: 'Industrial Control Panel', type: 'video/mp4' },
                      { url: '/infographic_motion.mp4', name: 'Infographic Motion Graphic', type: 'video/mp4' },
                      { url: '/pathology_scan.mp4', name: 'Medical Imaging: Pathology Scan', type: 'video/mp4' },
                      { url: '/transit_navigation.mp4', name: 'Public Transit Navigation', type: 'video/mp4' },
                      { url: '/software_tutorial.mp4', name: 'Software Tutorial: Syntax Highlighting', type: 'video/mp4' },
                      { url: '/nature_jungle.mp4', name: 'Nature: Jungle Wildlife', type: 'video/mp4' }
                    ].map((s, i) => (
                      <div 
                        key={i} 
                        onClick={() => loadSample(s.url, s.name, s.type)}
                        style={{
                          minWidth: '110px',
                          width: '110px',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: 'var(--bg-primary)'
                        }}
                      >
                        <div style={{ height: '60px', overflow: 'hidden', backgroundColor: 'black', position: 'relative' }}>
                          <video src={s.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="metadata" />
                        </div>
                        <div style={{ padding: '6px', fontSize: '0.65rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={s.name}>
                          {s.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PDFs */}
                <div className="vstack gap-2">
                  <div className="hstack">
                    <span className="badge badge-primary" style={{ fontSize: '0.6rem', color: 'var(--color-warning)', backgroundColor: 'rgba(234, 88, 12, 0.1)', padding: '4px 8px' }}>PDF Documents</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {[
                      { url: '/business_infographics.pdf', name: 'Business Infographics', type: 'application/pdf' },
                      { url: '/financial_report.pdf', name: 'Financial Report', type: 'application/pdf' },
                      { url: '/academic_paper.pdf', name: 'Academic Paper: Educational Diagrams', type: 'application/pdf' },
                      { url: '/architecture_infographics.pdf', name: 'Architecture Infographics', type: 'application/pdf' },
                      { url: '/timeline_infographics.pdf', name: 'Timeline Infographics', type: 'application/pdf' }
                    ].map((s, i) => (
                      <div 
                        key={i} 
                        onClick={() => loadSample(s.url, s.name, s.type)}
                        style={{
                          minWidth: '110px',
                          width: '110px',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: 'var(--bg-primary)'
                        }}
                      >
                        <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)' }}>
                          <FiFileText size={24} style={{ color: 'var(--color-warning)' }} />
                        </div>
                        <div style={{ padding: '6px', fontSize: '0.65rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={s.name}>
                          {s.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="vstack gap-4" style={{ width: '100%' }}>
            {/* Selected File Card */}
            <div 
              className="hstack" 
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div className="vstack gap-1" style={{ alignItems: 'flex-start' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{file.name}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB 
                  <span className="badge badge-primary" style={{ fontSize: '0.55rem', padding: '2px 6px' }}>
                    {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                  </span>
                </span>
              </div>
              <button 
                onClick={() => { setFile(null); localStorage.removeItem('chromashift_pending_file'); }}
                className="btn btn-sm btn-outline"
              >
                Change
              </button>
            </div>

            {/* Video File Pipeline Selector */}
            {isVideo && (
              <div className="vstack gap-3" style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                  <button
                    onClick={() => setActiveTab(0)}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      backgroundColor: activeTab === 0 ? 'var(--bg-primary)' : 'transparent',
                      border: activeTab === 0 ? '1px solid var(--border-primary)' : 'none',
                      color: 'var(--text-primary)',
                      boxShadow: activeTab === 0 ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <FiCloud size={14} />
                    <span>Cloud Remap (S3)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab(1)}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      backgroundColor: activeTab === 1 ? 'var(--bg-primary)' : 'transparent',
                      border: activeTab === 1 ? '1px solid var(--border-primary)' : 'none',
                      color: 'var(--text-primary)',
                      boxShadow: activeTab === 1 ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <FiCpu size={14} />
                    <span>GPU Remap (Local)</span>
                  </button>
                </div>

                <div className="card-solid" style={{ padding: '16px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {activeTab === 0 
                      ? 'Upload the file to secure S3 storage and process it via fine-tuned server models. Perfect for keeping a permanent archive in your history dashboard.'
                      : 'Remap colors directly on your device using TensorFlow.js GPU-acceleration. Zero file uploads needed. Faster processing.'}
                  </p>
                </div>
              </div>
            )}

            {/* Non-Video Pipeline Information */}
            {!isVideo && (
              <div className="card-solid" style={{ padding: '16px', width: '100%' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {isPdf 
                    ? 'Your PDF will be uploaded to securely hosted S3 storage. Our PyMuPDF pipeline will semantically recolor charts and diagrams while perfectly preserving all vector text layers for screen-reader accessibility.'
                    : isImage
                    ? 'Your image will be uploaded to securely hosted S3 storage. Our YOLO26n-seg pipeline will apply precise semantic Daltonization while ensuring 100% lightness preservation.'
                    : 'Your file will be uploaded to securely hosted S3 storage. Our backend fine-tuned Daltonization pipelines will apply CVD accessibility corrections.'}
                </p>
              </div>
            )}

            {/* Progress Bar */}
            {isUploading && (
              <div className="vstack gap-2" style={{ width: '100%', marginTop: '16px' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 'var(--fw-semibold)' }}>{processingMessages[loadingMessageIndex]}</span>
                  <span style={{ fontWeight: 'var(--fw-bold)', color: 'var(--primary)' }}>{Math.round(progress)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.2s ease-out' }} />
                </div>
              </div>
            )}

            <button
              disabled={isUploading}
              onClick={handleUpload}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '16px', padding: '14px' }}
            >
              {isUploading ? 'Uploading & Processing...' : 'Upload & Process File'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
