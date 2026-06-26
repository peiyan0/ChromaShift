import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiUsers, FiClock, FiHeart, FiSettings, FiActivity, FiSmile, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';
import api from '../services/api';

// SVG Icons for clean, zero-dependency rendering
const AnalyticsIcon = () => (
  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v16.5A2.25 2.25 0 006 21.75h16.5M9 7.5l3 3 6-6M18 12v.008H18V12zm0 3v.008H18V15zm0 3v.008H18V18z" />
  </svg>
);

export const AdminAnalytics: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cvdFilter, setCvdFilter] = useState<string>('all');

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = p.uuid.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.occupation && p.occupation.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCvd = cvdFilter === 'all' || p.cvd_type?.toLowerCase() === cvdFilter.toLowerCase();
    return matchesSearch && matchesCvd;
  });

  const handleExportCSV = () => {
    if (participants.length === 0) return;
    const headers = ['UUID', 'Age', 'Gender', 'Occupation', 'Education Level', 'CVD Type', 'Diagnosed', 'Prior Tool', 'Glasses Freq', 'App Comfort', 'Device Freq', 'Date'];
    const rows = participants.map(p => [
      p.uuid,
      p.age,
      p.gender,
      p.occupation || 'N/A',
      p.education_level || 'N/A',
      p.cvd_type,
      p.is_diagnosed,
      p.prior_tool_use,
      p.color_glasses_frequency || 'N/A',
      p.web_app_comfort || 'N/A',
      p.device_use_frequency || 'N/A',
      new Date(p.created_at).toLocaleDateString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chromashift_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('success', 'CSV Registry exported successfully!');
  };

  const triggerNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, participantsRes] = await Promise.all([
        api.get('research/analytics/segmented', { params: { cvd_type: cvdFilter } }),
        api.get('research/participants')
      ]);
      setData(analyticsRes.data);
      setParticipants(participantsRes.data);
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || 'Failed to fetch administrator research data.');
      triggerNotification('error', 'Access Denied: Only authenticated administrators can view analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [cvdFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '450px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div className="vstack gap-4" style={{ alignItems: 'center', textAlign: 'center' }}>
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
          <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
            Assembling Research Analytics...
          </span>
        </div>
        <style>{`
          @keyframes spin-loading {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', minHeight: '400px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card vstack gap-6" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <FiAlertCircle size={48} style={{ color: 'var(--color-error)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>Administrator Credentials Required</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            This workspace section stores protected medical, demographics, and workload performance research data. It is restricted strictly to root developers.
          </p>
          <div
            className="badge badge-error"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              textTransform: 'none',
              fontWeight: '600',
              fontSize: '0.85rem',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            {error}
          </div>
          <button className="btn btn-primary" onClick={fetchAnalytics} style={{ width: '100%' }}>
            Retry Authentication
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.total_participants === 0) {
    return (
      <div style={{ display: 'flex', minHeight: '400px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card vstack gap-6" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <FiUsers size={48} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>No Research Data Logged Yet</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Once participants complete the official Guided Study Session, telemetry metrics and usability indexes will appear here automatically.
          </p>
          <button className="btn btn-primary" onClick={fetchAnalytics} style={{ width: '100%' }}>
            <FiRefreshCw /> Check for Entries
          </button>
        </div>
      </div>
    );
  }

  const sus = data.avg_sus_score || 0;
  const susGrade = sus >= 80.3 ? 'A (Excellent)' : sus >= 68.0 ? 'C (Acceptable / Good)' : 'F (Needs Improvement)';
  const susColorClass = sus >= 80.3 ? 'badge-success' : sus >= 68.0 ? 'badge-primary' : 'badge-error';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: 'var(--space-6) auto',
        padding: '1px',
        background: 'var(--primary-gradient)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        position: 'relative'
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          className={`badge badge-${notification.type === 'error' ? 'error' : 'success'}`}
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-lg)',
            border: 'none',
            textTransform: 'none',
            fontWeight: 'bold'
          }}
        >
          {notification.text}
        </div>
      )}

      <div
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '23px',
          border: '1px solid var(--border-primary)'
        }}
        className="vstack gap-8"
      >
        {/* Dashboard Header */}
        <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div className="hstack gap-4">
            <div
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <AnalyticsIcon />
            </div>
            <div className="vstack gap-1">
              <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>Admin Control Panel</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Research & Telemetry Analytics
              </h2>
            </div>
          </div>
          <div className="hstack gap-3" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={handleExportCSV}>
              Export Registry to CSV
            </button>
            <button className="btn btn-outline" onClick={fetchAnalytics}>
              <FiRefreshCw /> Sync Telemetry
            </button>
          </div>
        </div>

        <div className="divider" />

        {/* Level 1: Overview Scorecards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
            width: '100%'
          }}
        >
          {/* Card 1: Total Subjects */}
          <div className="card vstack gap-2">
            <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
              <FiUsers />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Participants</span>
            </div>
            <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>
              {data.total_participants}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total verified logged subjects in PostgreSQL</p>
          </div>

          {/* Card 2: System Usability Scale (SUS) */}
          <div className="card vstack gap-2">
            <div className="hstack" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
                <FiSmile />
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>System Usability (SUS)</span>
              </div>
              <span className={`badge ${susColorClass}`}>{susGrade}</span>
            </div>
            <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>
              {sus.toFixed(1)} <span style={{ fontSize: '1.15rem', fontWeight: '400', color: 'var(--text-muted)' }}>/ 100</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Industry benchmark: 68.0 average usability</p>
          </div>

          {/* Card 3: Visual Comfort Delta */}
          <div className="card vstack gap-2">
            <div className="hstack gap-2" style={{ color: 'var(--color-success)' }}>
              <FiHeart />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Comfort Index</span>
            </div>
            <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>
              {data.visual_comfort.remapped_comfort?.toFixed(1)} <span style={{ fontSize: '1.15rem', fontWeight: '400', color: 'var(--text-muted)' }}>/ 5.0</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average remapped media comfort level rating</p>
          </div>
        </div>

        {/* Level 2: Performance Delta (Stopwatch speedups) */}
        <div className="card-solid vstack gap-4" style={{ width: '100%', border: '1px solid var(--border-primary)', padding: 'var(--space-6)' }}>
          <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
            <FiClock />
            <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Programmatic Speed & Accuracy Gains (Original vs. Corrected)</span>
          </div>

          <div className="divider" style={{ margin: 'var(--space-2) 0' }} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-4)',
              width: '100%'
            }}
          >
            {Object.keys(data.task_performance).map((taskKey) => {
              const task = data.task_performance[taskKey];
              const speedup = (task.avg_original_time > 0 && task.avg_corrected_time > 0)
                ? (task.avg_original_time / task.avg_corrected_time).toFixed(1)
                : '1.0';
              
              let label = '';
              if (taskKey === 'task1') label = 'Line Graph';
              else if (taskKey === 'task2') label = 'Bar Status';
              else if (taskKey === 'task3') label = 'Node Alerts';
              else if (taskKey === 'video') label = 'Video Tracking';
              else if (taskKey === 'document') label = 'PDF Shading';
              else if (taskKey === 'task6') label = 'Fruit Spotting';

              return (
                <div 
                  key={taskKey} 
                  className="card vstack gap-3"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    padding: 'var(--space-4)',
                    justifyContent: 'space-between'
                  }}
                >
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>{label}</span>

                  <div className="vstack gap-1">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Time (Orig vs Corr)</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {task.avg_original_time?.toFixed(1)}s <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>➔</span> {task.avg_corrected_time?.toFixed(1)}s
                    </span>
                  </div>

                  <div className="vstack gap-1">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Accuracy (Orig vs Corr)</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {Math.round(task.avg_original_accuracy * 100)}% <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>➔</span> {Math.round(task.avg_corrected_accuracy * 100)}%
                    </span>
                  </div>

                  <span className="badge badge-success" style={{ width: '100%', textAlign: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: 'var(--space-1.5) 0' }}>
                    {speedup}x Faster
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Level 2.5: Visual Comfort Dimensions Assessment */}
        <div className="card-solid vstack gap-4" style={{ width: '100%', border: '1px solid var(--border-primary)', padding: 'var(--space-6)' }}>
          <div className="hstack gap-2" style={{ color: 'var(--color-success)', fontWeight: '700' }}>
            <FiHeart />
            <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Visual Comfort Assessment Ratings (1.0 to 5.0)</span>
          </div>

          <div className="divider" style={{ margin: 'var(--space-2) 0' }} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-4)',
              width: '100%'
            }}
          >
            {[
              { label: 'Overall Session Comfort', value: data.visual_comfort.dry_eyes_comfort, icon: '😊' },
              { label: 'Eye Strain & Fatigue (Inverse)', value: data.visual_comfort.strain_fatigue, icon: '👁️' },
              { label: 'Headaches (Inverse)', value: data.visual_comfort.headaches, icon: '🤕' },
              { label: 'Remapped Media Comfort', value: data.visual_comfort.remapped_comfort, icon: '🎨' },
              { label: 'Long Reading Durations', value: data.visual_comfort.long_reading, icon: '📖' }
            ].map((comfort, i) => (
              <div 
                key={i} 
                className="card vstack gap-2"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{comfort.icon}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>{comfort.label}</span>
                <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                  {comfort.value?.toFixed(1)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 5.0</span>
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Level 2.6: Platform Usage & S3 Compliance Telemetry */}
        {data.platform_stats && (
          <div className="card-solid vstack gap-4" style={{ width: '100%', border: '1px solid var(--border-primary)', padding: 'var(--space-6)' }}>
            <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
              <FiSettings />
              <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Platform Usage & S3 Compliance Telemetry (Out of Survey)</span>
            </div>

            <div className="divider" style={{ margin: 'var(--space-2) 0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
                width: '100%'
              }}
            >
              {/* Users & Profiles */}
              <div className="card vstack gap-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Accounts</span>
                <div className="vstack gap-1" style={{ fontSize: '0.85rem' }}>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Registered Accounts:</span>
                    <strong>{data.platform_stats.total_users}</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Active Calibration Profiles:</span>
                    <strong>{data.platform_stats.total_vision_profiles}</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Avg Profile Severity:</span>
                    <strong>{(data.platform_stats.avg_profile_severity * 100).toFixed(0)}%</strong>
                  </div>
                </div>
              </div>

              {/* Media Processing */}
              <div className="card vstack gap-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Media Processing</span>
                <div className="vstack gap-1" style={{ fontSize: '0.85rem' }}>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Uploads (Jobs):</span>
                    <strong>{data.platform_stats.total_media_jobs}</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Processed (Completed):</span>
                    <strong>{data.platform_stats.completed_media_jobs}</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Images/Videos/PDFs:</span>
                    <strong>
                      {data.platform_stats.media_type_distributions.image || 0} / {data.platform_stats.media_type_distributions.video || 0} / {data.platform_stats.media_type_distributions.pdf || 0}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Compliance Stats */}
              <div className="card vstack gap-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>S3 Compliance Auditing</span>
                <div className="vstack gap-1" style={{ fontSize: '0.85rem' }}>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Audits Generated:</span>
                    <strong>{data.platform_stats.total_compliance_reports}</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Average Compliance Score:</span>
                    <strong>{data.platform_stats.avg_compliance_score?.toFixed(1)}%</strong>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Audit Pass Rate:</span>
                    <strong>
                      {data.platform_stats.total_compliance_reports > 0 
                        ? `${Math.round((data.platform_stats.pass_compliance_reports / data.platform_stats.total_compliance_reports) * 100)}%` 
                        : '100%'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Level 3: Workloads (NASA TLX) & Demographics Splits */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
            width: '100%',
            alignItems: 'start'
          }}
        >
          {/* NASA TLX Card */}
          <div className="card vstack gap-4" style={{ height: '100%' }}>
            <div className="hstack gap-2" style={{ color: 'var(--color-warning)', fontWeight: '700' }}>
              <FiActivity />
              <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Average NASA Task Workload (0 to 20)</span>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div className="vstack gap-4" style={{ paddingTop: 'var(--space-2)' }}>
              {[
                { label: 'Mental Demand (Problem Solving)', value: data.nasa_tlx.mental, isRed: false },
                { label: 'Physical Demand (Eye Strain)', value: data.nasa_tlx.physical, isRed: false },
                { label: 'Temporal Demand (Rushed Feeling)', value: data.nasa_tlx.temporal, isRed: false },
                { label: 'Overall Effort', value: data.nasa_tlx.effort, isRed: false },
                { label: 'Frustration Level', value: data.nasa_tlx.frustration, isRed: true }
              ].map((tlx) => {
                const percentage = Math.min(100, Math.max(0, (tlx.value / 20) * 100));
                return (
                  <div key={tlx.label} className="vstack gap-1.5">
                    <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{tlx.label}</span>
                      <span style={{ fontWeight: '700', color: tlx.isRed ? 'var(--color-error)' : 'var(--color-warning)' }}>
                        {tlx.value?.toFixed(1)} / 20
                      </span>
                    </div>
                    {/* Native progress bar */}
                    <div
                      style={{
                        height: '8px',
                        width: '100%',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-primary)'
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${percentage}%`,
                          backgroundColor: tlx.isRed ? 'var(--color-error)' : 'var(--color-warning)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width var(--transition-normal)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Demographics Splits */}
          <div className="card vstack gap-4" style={{ height: '100%' }}>
            <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
              <FiUsers />
              <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>CVD Demographics Distributions</span>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                paddingTop: 'var(--space-2)'
              }}
            >
              <div className="card-solid vstack gap-3" style={{ backgroundColor: 'var(--bg-primary)', padding: 'var(--space-4)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Color Blindness Types</span>
                <div className="vstack gap-2">
                  {Object.keys(data.demographics.cvd_types).map(cvd => (
                    <div key={cvd} className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span className="capitalize" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{cvd}</span>
                      <span className="badge badge-primary">{data.demographics.cvd_types[cvd]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-solid vstack gap-3" style={{ backgroundColor: 'var(--bg-primary)', padding: 'var(--space-4)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Genders</span>
                <div className="vstack gap-2">
                  {Object.keys(data.demographics.genders).map(gen => (
                    <div key={gen} className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span className="capitalize" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{gen}</span>
                      <span className="badge badge-primary">{data.demographics.genders[gen]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Level 4: Scrollable list of Qualitative feedback */}
        <div className="card vstack gap-4" style={{ width: '100%' }}>
          <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
            <FiMessageSquare />
            <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Participant Self-Reported Qualitative Interview Notes</span>
          </div>

          <div className="divider" style={{ margin: '0' }} />

          <div
            className="vstack gap-4"
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: 'var(--space-2)',
              paddingTop: 'var(--space-2)'
            }}
          >
            {data.interview_feedback.map((f: any, idx: number) => (
              <div 
                key={idx} 
                className="vstack gap-3"
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)'
                }}
              >
                <div className="hstack" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>
                    Subject ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{f.participant_uuid}</code>
                  </span>
                  <span className="badge badge-success">Verification Passed</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-3)',
                    fontSize: '0.75rem'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Flicker/Transitions:</strong>
                    <span style={{ color: 'var(--text-primary)' }}>{f.transitions_feedback || 'No comments'}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Color Fidelity:</strong>
                    <span style={{ color: 'var(--text-primary)' }}>{f.comfort_feedback || 'No comments'}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Wizard/Onboarding:</strong>
                    <span style={{ color: 'var(--text-primary)' }}>{f.wizard_feedback || 'No comments'}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-1)' }}>Frustrations:</strong>
                    <span style={{ color: 'var(--color-error)' }}>{f.frustrating || 'None'}</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 'var(--space-2)', fontSize: '0.75rem' }}>
                  <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: 'var(--space-1)' }}>Surprise Discoveries & Recommendations:</strong>
                  <span style={{ color: 'var(--color-success)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>"{f.general || 'No recommendations'}"</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Level 5: Table of Individual Participant UUIDs */}
        <div className="card vstack gap-4" style={{ width: '100%' }}>
          <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
            <FiSettings />
            <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Historical Telemetry Intake Registry</span>
          </div>

          <div className="divider" style={{ margin: '0' }} />

          {/* Search and Filter Row */}
          <div className="hstack gap-4" style={{ flexWrap: 'wrap', width: '100%', padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', margin: 'var(--space-4) 0' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search by UUID or occupation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <div>
              <select
                value={cvdFilter}
                onChange={(e) => setCvdFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  width: '180px'
                }}
              >
                <option value="all">All CVD Types</option>
                <option value="normal">Normal Vision</option>
                <option value="deuteran">Deuteran</option>
                <option value="protan">Protan</option>
                <option value="tritan">Tritan</option>
                <option value="unsure">Unsure / None</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                textAlign: 'left',
                fontSize: '0.875rem'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Participant UUID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Age</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Gender</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Occupation</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Education</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>CVD Type</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Diagnosed Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Prior Tool</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Mode</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontWeight: '700' }}>Intake Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p) => (
                  <tr 
                    key={p.uuid} 
                    style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background-color var(--transition-fast)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {p.uuid}
                      </code>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)' }}>{p.age}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.gender}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)' }}>{p.occupation || 'N/A'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)' }}>{p.education_level || 'N/A'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.cvd_type}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)' }}>{p.is_diagnosed}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.prior_tool_use}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-primary)' }}>
                      <span className={`badge ${p.selected_mode === 'sandbox' ? 'badge-secondary' : 'badge-primary'}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem', padding: '2px 6px' }}>
                        {p.selected_mode || 'study'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
