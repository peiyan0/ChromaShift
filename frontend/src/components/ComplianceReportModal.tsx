import { useEffect, useState, type FC } from 'react';
import { complianceService, type ComplianceReportResponse } from '../services/compliance';
import api from '../services/api';
import { FiX, FiAlertTriangle, FiAlertCircle, FiArrowDown } from 'react-icons/fi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

export const ComplianceReportModal: FC<Props> = ({ isOpen, onClose, jobId }) => {
  const [report, setReport] = useState<ComplianceReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchReport();
    } else {
      setReport(null);
      setErrorMsg(null);
    }
  }, [isOpen, jobId]);

  const fetchReport = async () => {
    if (!jobId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await complianceService.getReport(jobId);
      setReport(data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Report doesn't exist yet, we will show the "Run Check" button
        setReport(null);
      } else {
        setErrorMsg('Error fetching report from server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCheck = async () => {
    if (!jobId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const data = await complianceService.runCheck(jobId);
      setReport(data);
    } catch (error) {
      setErrorMsg('Audit generation failed.');
    } finally {
      setIsGenerating(false);
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
      setErrorMsg('Export failed.');
    }
  };

  if (!isOpen) return null;

  return (
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
      padding: '16px',
      animation: 'fade-in 0.2s ease-out'
    }}>
      <div 
        className="card-solid animate-scale-in"
        style={{
          width: '100%',
          maxWidth: '640px',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: '1px solid var(--border-primary)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>WCAG 2.1 Accessibility Audit</h3>
          <button 
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ padding: '6px', borderRadius: '50%' }}
            aria-label="Close report"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Modal content body */}
        <div style={{ padding: '24px', maxHeight: '65vh', overflowY: 'auto' }} className="vstack gap-4">
          
          {errorMsg && (
            <div className="badge badge-error" style={{ width: '100%', padding: '10px', textTransform: 'none', borderRadius: 'var(--radius-sm)' }}>
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '16px' }}>
              <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Analyzing accessibility markers...</span>
            </div>
          ) : !report ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center', gap: '16px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No compliance report exists for this file yet.</p>
              <button 
                onClick={handleRunCheck}
                disabled={isGenerating}
                className="btn btn-primary"
              >
                {isGenerating ? 'Running Automated Audit...' : 'Run WCAG Compliance Check'}
              </button>
            </div>
          ) : (
            <div className="vstack gap-6" style={{ width: '100%' }}>
              
              {/* Score header card */}
              <div 
                className="hstack" 
                style={{
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px'
                }}
              >
                <div className="vstack gap-1" style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)' }}>Audit Status</span>
                  <span className={`badge badge-${report.status === 'pass' ? 'success' : report.status === 'fail' ? 'error' : 'warning'}`} style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                    {report.status.toUpperCase()}
                  </span>
                </div>

                <div className="vstack gap-1" style={{ flex: 1, maxWidth: '240px', alignItems: 'stretch' }}>
                  <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)' }}>Compliance Score</span>
                    <strong style={{ color: report.score >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>{report.score}/100</strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-primary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${report.score}%`,
                      height: '100%',
                      backgroundColor: report.score >= 90 ? 'var(--color-success)' : report.score >= 70 ? 'var(--color-warning)' : 'var(--color-error)',
                      transition: 'width 0.3s ease-out'
                    }} />
                  </div>
                </div>
              </div>

              {/* Issues listing */}
              <div className="vstack gap-4" style={{ alignItems: 'stretch' }}>
                <h4 style={{ fontFamily: 'var(--font-heading)' }}>Identified Issues ({report.issues.length})</h4>
                
                {report.issues.length === 0 ? (
                  <div className="badge badge-success" style={{ width: '100%', padding: '16px', textTransform: 'none', display: 'block', borderRadius: 'var(--radius-md)' }}>
                    Great job! No WCAG 2.1 color contrast violations detected.
                  </div>
                ) : (
                  <div className="vstack gap-4" style={{ alignItems: 'stretch' }}>
                    {report.issues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className="card-solid"
                        style={{
                          borderLeft: `4px solid ${issue.severity === 'Error' ? 'var(--color-error)' : 'var(--color-warning)'}`,
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div className="hstack" style={{ justifyContent: 'space-between' }}>
                          <div className="hstack gap-2">
                            {issue.severity === 'Error' ? <FiAlertCircle size={16} style={{ color: 'var(--color-error)' }} /> : <FiAlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />}
                            <strong style={{ fontSize: '0.85rem' }}>Success Criterion {issue.sc_id}</strong>
                          </div>
                          <span className={`badge badge-${issue.severity === 'Error' ? 'error' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                            {issue.severity}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                          {issue.description}
                        </p>
                        
                        {/* Suggestion box */}
                        <div style={{
                          backgroundColor: 'var(--primary-light)',
                          padding: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(79, 70, 229, 0.15)'
                        }} className="vstack gap-1">
                          <strong style={{ fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actionable Suggestion</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0 }}>{issue.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          borderTop: '1px solid var(--border-primary)',
          padding: '16px 24px',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button onClick={onClose} className="btn btn-sm btn-ghost">Close</button>
          {report && (
            <>
              <button onClick={handleExportReport} className="btn btn-sm btn-outline">
                <FiArrowDown size={14} />
                <span>Export Report (JSON)</span>
              </button>
              <button 
                onClick={handleRunCheck}
                disabled={isGenerating}
                className="btn btn-sm btn-primary"
              >
                {isGenerating ? 'Analyzing...' : 'Re-Run Audit'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
