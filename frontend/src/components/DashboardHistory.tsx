import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiGrid, FiList, FiTrash2, FiDownload, FiFileText, FiAlertCircle, 
  FiChevronDown, FiSearch, FiFilter, FiShare2, FiExternalLink, FiRefreshCw 
} from 'react-icons/fi';
import { mediaService, type MediaHistoryResponse } from '../services/media';
import { ComplianceReportModal } from './ComplianceReportModal';

const StudioIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M19,3H5A2,2 0 0,0 3,5V15A2,2 0 0,0 5,17H10V19H8V21H16V19H14V17H19A2,2 0 0,0 21,15V5A2,2 0 0,0 19,3M19,15H5V5H19V15Z" />
  </svg>
);

const AuditIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
  </svg>
);

export const DashboardHistory: FC = () => {
  const navigate = useNavigate();
  
  // App states
  const [history, setHistory] = useState<MediaHistoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    (localStorage.getItem('chromashift_view_mode') as 'list' | 'grid') || 'grid'
  );
  
  // Sorting state
  type SortField = 'filename' | 'type' | 'created_at' | 'status';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Search, Filter and Grid State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>(['image', 'video', 'pdf']);
  const [gridSize, setGridSize] = useState(3);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  
  // Local alerts/toasts
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Deletion state
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Modal states
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Mobile / layout sharing states
  const [sharingJobId, setSharingJobId] = useState<string | null>(null);

  // Window resize width listener
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await mediaService.getHistory();
        setHistory(data);
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const triggerNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <span className="badge badge-success" style={{ padding: '4px 8px' }}>Completed</span>;
      case 'processing': return <span className="badge badge-primary" style={{ padding: '4px 8px' }}>Processing</span>;
      case 'failed': return <span className="badge badge-error" style={{ padding: '4px 8px' }}>Failed</span>;
      default: return <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 8px' }}>{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'image': return <span className="badge badge-primary" style={{ padding: '4px 8px' }}>Image</span>;
      case 'video': return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: 'var(--color-warning)', padding: '4px 8px' }}>Video</span>;
      case 'pdf': return <span className="badge badge-error" style={{ padding: '4px 8px' }}>PDF</span>;
      default: return null;
    }
  };

  const handleDownload = async (jobId: string, itemFilename?: string) => {
    try {
      const data = await mediaService.getDownloadUrl(jobId);
      const downloadUrl = data.url;
      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = itemFilename || 'processed_media';
      const ext = downloadUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
      const baseWithoutExt = baseName.substring(0, baseName.lastIndexOf('.')) || baseName;
      a.download = `${baseWithoutExt}_processed.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Download failed", error);
      triggerNotification('error', 'Download failed. Could not retrieve the processed file.');
    }
  };

  const handleShare = async (jobId: string) => {
    setSharingJobId(jobId);
    try {
      const data = await mediaService.shareMedia(jobId);
      await navigator.clipboard.writeText(data.share_url);
      triggerNotification('success', 'Link Copied! Public preview link is copied to your clipboard.');
    } catch (error) {
      console.error("Share failed", error);
      triggerNotification('error', 'Share link failed. Could not generate temporary preview link.');
    } finally {
      setSharingJobId(null);
    }
  };

  const openComplianceReport = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsReportOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await mediaService.deleteMedia(jobToDelete);
      setHistory(prev => prev.filter(item => item.job_id !== jobToDelete));
      triggerNotification('success', 'File deleted. Media cleared from active storage.');
    } catch (error) {
      console.error("Deletion failed", error);
      triggerNotification('error', 'Deletion failed. Please try again.');
    } finally {
      setIsDeleting(false);
      setJobToDelete(null);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await mediaService.clearAllMedia();
      setHistory([]);
      triggerNotification('success', res.message || 'Uploads Cleared. Processed media files purged.');
    } catch (error) {
      console.error("Failed to purge uploads", error);
      triggerNotification('error', 'Failed to clear history. Please try again.');
    } finally {
      setIsClearing(false);
      setIsClearOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card-solid animate-fade-in" style={{ width: '100%', maxWidth: '1024px', margin: '0 auto', padding: '24px' }}>
        <div style={{ height: '3px', background: 'var(--primary-gradient)', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
              <div className="skeleton" style={{ aspectRatio: '4/3', width: '100%' }} />
              <div style={{ padding: '12px' }}>
                <div className="skeleton" style={{ height: '14px', width: '70%', marginBottom: '8px' }} />
                <div className="skeleton" style={{ height: '10px', width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterTypes.length === 0 || filterTypes.includes(item.type);
    return matchesSearch && matchesFilter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];
    
    if (sortField === 'created_at') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    } else if (typeof valA === 'string' && typeof valB === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Grid columns calculator restricted by viewport
  let gridColumnsCount = 7 - gridSize;
  if (windowWidth <= 480) {
    gridColumnsCount = 1;
  } else if (windowWidth <= 768) {
    if (gridColumnsCount > 3) gridColumnsCount = 2;
    else if (gridColumnsCount < 2) gridColumnsCount = 2;
  } else if (windowWidth <= 1024) {
    if (gridColumnsCount > 4) gridColumnsCount = 3;
    else if (gridColumnsCount < 2) gridColumnsCount = 2;
  }

  const getAvailableColumns = () => {
    if (windowWidth <= 480) return [];
    if (windowWidth <= 768) return [2, 3];
    if (windowWidth <= 1024) return [2, 3, 4];
    return [2, 3, 4, 5];
  };
  const availableCols = getAvailableColumns();

  return (
    <>
      {/* Notification Toast replacement */}
      {notification && (
        <div className={`badge badge-${notification.type}`} style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          textTransform: 'none',
          fontWeight: 'bold',
          backgroundColor: notification.type === 'success' ? 'var(--color-success)' : notification.type === 'error' ? 'var(--color-error)' : 'var(--color-info)',
          color: '#ffffff',
          boxShadow: 'var(--shadow-lg)',
          border: 'none',
          animation: 'slide-up 0.2s ease-out'
        }}>
          {notification.text}
        </div>
      )}

      <div 
        className="card-solid"
        style={{
          width: '100%',
          maxWidth: '1024px',
          margin: '0 auto',
          padding: 0,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-primary)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div style={{ height: '3px', background: 'var(--primary-gradient)' }} />

        <div style={{ padding: '24px' }} className="vstack gap-6">
          
          {/* Header controls bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div className="vstack gap-1" style={{ alignItems: 'flex-start' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)' }}>Media Hub</h2>
              <p style={{ fontSize: '0.85rem' }}>Manage, preview, and audit your CVD-remapped files</p>
            </div>
            
            <div className="hstack gap-3" style={{ flexWrap: 'wrap' }}>
              {/* View toggle */}
              <div className="hstack gap-1" style={{ backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                <button 
                  onClick={() => { setViewMode('grid'); localStorage.setItem('chromashift_view_mode', 'grid'); }}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: viewMode === 'grid' ? 'var(--bg-primary)' : 'transparent',
                    border: viewMode === 'grid' ? '1px solid var(--border-primary)' : 'none',
                    color: 'var(--text-primary)',
                    boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
                    padding: '6px'
                  }}
                  title="Grid view"
                >
                  <FiGrid size={16} />
                </button>
                <button 
                  onClick={() => { setViewMode('list'); localStorage.setItem('chromashift_view_mode', 'list'); }}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: viewMode === 'list' ? 'var(--bg-primary)' : 'transparent',
                    border: viewMode === 'list' ? '1px solid var(--border-primary)' : 'none',
                    color: 'var(--text-primary)',
                    boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                    padding: '6px'
                  }}
                  title="List view"
                >
                  <FiList size={16} />
                </button>
              </div>

              {/* Grid view Sort Dropdown */}
              {viewMode === 'grid' && (
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                    className="btn btn-sm btn-outline"
                  >
                    <span>Sort</span>
                    <FiChevronDown size={14} />
                  </button>
                  {isSortOpen && (
                    <div className="card-solid" style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      zIndex: 10,
                      minWidth: '180px',
                      boxShadow: 'var(--shadow-lg)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {[
                        { field: 'created_at', dir: 'desc', label: 'Newest First' },
                        { field: 'created_at', dir: 'asc', label: 'Oldest First' },
                        { field: 'filename', dir: 'asc', label: 'Filename (A-Z)' },
                        { field: 'filename', dir: 'desc', label: 'Filename (Z-A)' },
                        { field: 'type', dir: 'asc', label: 'Type (A-Z)' },
                        { field: 'status', dir: 'asc', label: 'Status' }
                      ].map((o, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSortField(o.field as SortField);
                            setSortDirection(o.dir as 'asc' | 'desc');
                            setIsSortOpen(false);
                          }}
                          className="btn btn-sm btn-ghost"
                          style={{
                            justifyContent: 'flex-start',
                            fontWeight: sortField === o.field && sortDirection === o.dir ? 'bold' : 'normal'
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={() => setIsClearOpen(true)}
                className="btn btn-sm btn-outline"
                style={{ color: 'var(--color-error)', borderColor: 'rgba(185, 28, 28, 0.2)' }}
                disabled={history.length === 0}
              >
                <FiTrash2 size={14} />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Filters and search group */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
            <div className="hstack gap-2" style={{
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-full)',
              padding: '0 12px',
              backgroundColor: 'var(--bg-secondary)',
              flex: 1,
              maxWidth: '320px'
            }}>
              <FiSearch size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input"
                style={{ border: 'none', backgroundColor: 'transparent', padding: '8px 0', fontSize: '0.85rem' }}
              />
            </div>

            {/* Filter tags dropdown */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                className="btn btn-sm btn-outline"
              >
                <FiFilter size={14} />
                <span>Filter Types ({filterTypes.length})</span>
              </button>
              {isFilterOpen && (
                <div className="card-solid" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  zIndex: 10,
                  minWidth: '150px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {['image', 'video', 'pdf'].map(type => (
                    <label key={type} className="hstack gap-2" style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={filterTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterTypes([...filterTypes, type]);
                          } else {
                            setFilterTypes(filterTypes.filter(t => t !== type));
                          }
                        }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{type}s</span>
                    </label>
                  ))}
                  <button 
                    onClick={() => { setFilterTypes(['image', 'video', 'pdf']); setIsFilterOpen(false); }} 
                    className="btn btn-sm btn-ghost" 
                    style={{ fontSize: '0.75rem', marginTop: '4px' }}
                  >
                    Select All
                  </button>
                </div>
              )}
            </div>

            {/* Grid Size Control */}
            {viewMode === 'grid' && availableCols.length > 0 && (
              <div className="hstack gap-3" style={{ marginLeft: 'auto', width: 'auto', maxWidth: '200px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Columns:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {availableCols.map((cols) => (
                    <button
                      key={cols}
                      onClick={() => setGridSize(7 - cols)}
                      className="btn btn-sm"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        backgroundColor: gridColumnsCount === cols ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: gridColumnsCount === cols ? 'white' : 'var(--text-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-xs)'
                      }}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History listing body */}
          {sortedHistory.length === 0 ? (
            <div style={{
              width: '100%',
              padding: '64px 24px',
              border: '2px dashed var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              gap: '16px'
            }}>
              <FiAlertCircle size={40} style={{ color: 'var(--text-muted)' }} />
              <div className="vstack gap-1">
                <strong>No media items found</strong>
                <p style={{ fontSize: '0.85rem' }}>Upload files to calibrate them for your vision deficiency.</p>
              </div>
              <button onClick={() => navigate('/upload')} className="btn btn-primary">
                Upload File
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Card Grid Layout */
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumnsCount}, minmax(0, 1fr))`,
              gap: '20px',
              width: '100%'
            }}>
              {sortedHistory.map((item) => (
                <div 
                  key={item.job_id}
                  className="card card-interactive"
                  onClick={() => { if (item.status === 'completed') navigate(`/workspace/${item.job_id}`); }}
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--bg-primary)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: item.status === 'completed' ? 'pointer' : 'default'
                  }}
                >
                  {/* Thumbnail */}
                  <div 
                    style={{
                      aspectRatio: '4/3',
                      width: '100%',
                      backgroundColor: 'var(--bg-secondary)',
                      position: 'relative',
                      borderBottom: '1px solid var(--border-primary)',
                      overflow: 'hidden'
                    }}
                  >
                    {item.status === 'completed' ? (
                      item.type === 'image' && item.download_url ? (
                        <img src={item.download_url} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      ) : item.type === 'video' && item.download_url ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <video 
                            src={item.download_url} 
                            muted 
                            loop 
                            playsInline 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                          <span style={{ position: 'absolute', bottom: '6px', right: '6px', fontSize: '0.55rem', fontWeight: 'bold', color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none' }}>
                            Hover Play
                          </span>
                        </div>
                      ) : item.type === 'pdf' ? (
                        item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        ) : (
                          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(234, 88, 12, 0.05)' }}>
                            <FiFileText size={32} style={{ color: 'var(--color-warning)' }} />
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>No Preview</div>
                      )
                    ) : item.status === 'processing' ? (
                      <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Processing...</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
                        <FiAlertCircle size={24} />
                        <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>Failed</span>
                      </div>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div style={{ padding: '12px' }} className="vstack gap-2">
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.filename}>
                      {item.filename}
                    </strong>
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      {getTypeBadge(item.type)}
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div 
                    onClick={e => e.stopPropagation()}
                    style={{
                      padding: '8px 12px',
                      borderTop: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div className="hstack gap-1">
                      <button 
                        onClick={() => navigate(`/workspace/${item.job_id}`)}
                        className="btn btn-sm btn-ghost" 
                        disabled={item.status !== 'completed'}
                        title="Open workspace studio"
                        style={{ padding: '4px' }}
                      >
                        <StudioIcon size={16} />
                      </button>
                      <button 
                        onClick={() => openComplianceReport(item.job_id)}
                        className="btn btn-sm btn-ghost" 
                        disabled={item.status !== 'completed'}
                        title="Compliance audit report"
                        style={{ padding: '4px' }}
                      >
                        <AuditIcon size={16} />
                      </button>
                    </div>
                    
                    <div className="hstack gap-1">
                      <button 
                        onClick={() => handleShare(item.job_id)}
                        className="btn btn-sm btn-ghost" 
                        disabled={item.status !== 'completed' || sharingJobId === item.job_id}
                        title="Share preview link"
                        style={{ padding: '4px' }}
                      >
                        {sharingJobId === item.job_id ? <FiRefreshCw size={14} className="animate-spin" /> : <FiShare2 size={14} />}
                      </button>
                      <button 
                        onClick={() => handleDownload(item.job_id, item.filename)}
                        className="btn btn-sm btn-ghost" 
                        disabled={item.status !== 'completed'}
                        title="Download file"
                        style={{ padding: '4px' }}
                      >
                        <FiDownload size={14} />
                      </button>
                      <button 
                        onClick={() => setJobToDelete(item.job_id)}
                        className="btn btn-sm btn-ghost" 
                        title="Delete permanently"
                        style={{ padding: '4px', color: 'var(--color-error)' }}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : windowWidth <= 768 ? (
              /* Mobile responsive cards list for List View mode on smaller viewports */
              <div className="vstack gap-4" style={{ width: '100%' }}>
                {sortedHistory.map((item) => (
                  <div 
                    key={item.job_id} 
                    className="card-solid vstack gap-3 animate-fade-in" 
                    style={{ padding: '16px', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
                    onClick={() => { if(item.status === 'completed') navigate(`/workspace/${item.job_id}`); }}
                  >
                    <div className="hstack gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="vstack gap-1" style={{ alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }} title={item.filename}>
                          {item.filename}
                        </strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="vstack gap-1" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                        {getTypeBadge(item.type)}
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                    
                    <div className="hstack gap-2" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: '12px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      <button 
                        disabled={item.status !== 'completed'}
                        onClick={() => navigate(`/workspace/${item.job_id}`)}
                        className="btn btn-sm btn-outline"
                        style={{ minHeight: '36px' }}
                      >
                        <FiExternalLink size={14} />
                        <span>Workspace</span>
                      </button>
                      <button 
                        disabled={item.status !== 'completed'}
                        onClick={() => openComplianceReport(item.job_id)}
                        className="btn btn-sm btn-outline"
                        style={{ minHeight: '36px' }}
                      >
                        Audit
                      </button>
                      <button 
                        onClick={() => handleShare(item.job_id)}
                        disabled={item.status !== 'completed' || sharingJobId === item.job_id}
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '8px', minWidth: '36px', minHeight: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {sharingJobId === item.job_id ? <FiRefreshCw size={16} className="animate-spin" /> : <FiShare2 size={16} />}
                      </button>
                      <button 
                        onClick={() => handleDownload(item.job_id, item.filename)}
                        disabled={item.status !== 'completed'}
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '8px', minWidth: '36px', minHeight: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <FiDownload size={16} />
                      </button>
                      <button 
                        onClick={() => setJobToDelete(item.job_id)}
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '8px', minWidth: '36px', minHeight: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View Layout for Desktop (without className="btn-ghost" on <tr>) */
              <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                      <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('filename')}>
                        Filename <FiChevronDown size={12} style={{ display: 'inline', marginLeft: '4px', opacity: sortField === 'filename' ? 1 : 0.3 }} />
                      </th>
                      <th style={{ padding: '12px 16px' }}>Type</th>
                      <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                        Created <FiChevronDown size={12} style={{ display: 'inline', marginLeft: '4px', opacity: sortField === 'created_at' ? 1 : 0.3 }} />
                      </th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((item) => (
                      <tr 
                        key={item.job_id} 
                        style={{ borderBottom: '1px solid var(--border-primary)', cursor: item.status === 'completed' ? 'pointer' : 'default' }}
                        onClick={() => { if(item.status === 'completed') navigate(`/workspace/${item.job_id}`); }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                          <div className="hstack gap-3">
                            <FiFileText size={16} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{getTypeBadge(item.type)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(item.status)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="hstack gap-2" style={{ justifyContent: 'flex-end' }}>
                            <button 
                              disabled={item.status !== 'completed'}
                              onClick={() => navigate(`/workspace/${item.job_id}`)}
                              className="btn btn-sm btn-outline"
                              style={{ minHeight: '38px', padding: '6px 12px' }}
                            >
                              <FiExternalLink size={14} />
                              <span>Workspace</span>
                            </button>
                            <button 
                              disabled={item.status !== 'completed'}
                              onClick={() => openComplianceReport(item.job_id)}
                              className="btn btn-sm btn-outline"
                              style={{ minHeight: '38px', padding: '6px 12px' }}
                            >
                              Audit Report
                            </button>
                            <button 
                              onClick={() => handleShare(item.job_id)}
                              disabled={item.status !== 'completed' || sharingJobId === item.job_id}
                              className="btn btn-sm btn-ghost"
                              style={{ padding: '10px', minWidth: '38px', minHeight: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Copy share link"
                            >
                              {sharingJobId === item.job_id ? <FiRefreshCw size={16} className="animate-spin" /> : <FiShare2 size={16} />}
                            </button>
                            <button 
                              onClick={() => handleDownload(item.job_id, item.filename)}
                              disabled={item.status !== 'completed'}
                              className="btn btn-sm btn-ghost"
                              style={{ padding: '10px', minWidth: '38px', minHeight: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Download file"
                            >
                              <FiDownload size={16} />
                            </button>
                            <button 
                              onClick={() => setJobToDelete(item.job_id)}
                              className="btn btn-sm btn-ghost"
                              style={{ padding: '10px', minWidth: '38px', minHeight: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}
                              title="Delete file"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .animate-spin {
                animation: spin 1s linear infinite;
              }
            `}</style>
        </div>
      </div>

      {/* Compliance report modal */}
      <ComplianceReportModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        jobId={selectedJobId} 
      />

      {/* Deletion confirmation modal */}
      {jobToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--overlay-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          padding: '16px'
        }}>
          <div className="card-solid animate-scale-in" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Delete Uploaded File</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this uploaded file? This will immediately remove it from active storage and purge all related reports. This action cannot be undone.
            </p>
            <div className="hstack gap-3" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setJobToDelete(null)} className="btn btn-sm btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete} 
                className="btn btn-sm btn-primary"
                style={{ backgroundColor: 'var(--color-error)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All confirmation modal */}
      {isClearOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--overlay-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          padding: '16px'
        }}>
          <div className="card-solid animate-scale-in" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--color-error)' }}>⚠️ Clear All Uploads</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              This will permanently delete <strong>EVERY SINGLE</strong> upload, processed asset, and WCAG accessibility compliance audit report connected to your profile from active database structures and storage buckets.
              <br /><br />
              This action is immediate and absolute. Are you sure you want to proceed?
            </p>
            <div className="hstack gap-3" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setIsClearOpen(false)} className="btn btn-sm btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleConfirmClearAll} 
                className="btn btn-sm btn-primary"
                style={{ backgroundColor: 'var(--color-error)' }}
                disabled={isClearing}
              >
                {isClearing ? 'Purging...' : 'Purge All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
