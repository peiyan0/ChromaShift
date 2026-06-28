import { useState, useRef, useEffect, type FC } from 'react';
import { FiTrendingUp, FiCheckCircle, FiPlay, FiRefreshCw, FiGrid, FiClock, FiActivity, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/profile';
import { mediaService } from '../services/media';
import { SurveyWizard } from './SurveyWizard';

// Types for testing state
interface TaskResult {
  accuracy: boolean;
  time: number; // in seconds
  clicks?: number;
  clickAccuracy?: number; // for video tracking
}

export const VisionTest: FC = () => {
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Vision Profile Matrix variables
  const [svgMatrixValues, setSvgMatrixValues] = useState<string>("1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");

  // Mode Selection: 'selection' | 'welcome' | 'research_pre' | 'test_original' | 'intermission' | 'test_corrected' | 'research_post' | 'results'
  const [testMode, setTestMode] = useState<'sandbox' | 'official'>('sandbox');
  const [testPhase, setTestPhase] = useState<'selection' | 'welcome' | 'research_pre' | 'test_original' | 'intermission' | 'test_corrected' | 'research_post' | 'results'>('selection');
  
  // Completed participant UUID for success display
  const [participantUuid, setParticipantUuid] = useState<string>('');

  // 5 Tasks: 0=Line, 1=Bar, 2=Heatmap, 3=Video Tracking, 4=PDF Document
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);

  // Timers
  const timerRef = useRef<number>(0);
  
  // Answers states
  const [selectedValue, setSelectedValue] = useState<string>("");

  // Results logs
  const [originalResults, setOriginalResults] = useState<TaskResult[]>([]);
  const [correctedResults, setCorrectedResults] = useState<TaskResult[]>([]);

  // ================= TASK 4 (FLOW DIAGRAM) STATE =================
  const [flowNodeColor, setFlowNodeColor] = useState<string>('#c62828'); // Initial color
  const [flowTransitionComplete, setFlowTransitionComplete] = useState<boolean>(false);
  
  // ================= TASK 5 (TABLE EXTRACTION) STATE =================
  const [selectedTableRows, setSelectedTableRows] = useState<number[]>([]);

  // ================= TASK 6 (ORCHARD PHOTO) STATE =================
  const [processedOrchardUrl, setProcessedOrchardUrl] = useState<string | null>(null);
  const [isProcessingOrchard, setIsProcessingOrchard] = useState<boolean>(false);

  const triggerNotification = (type: 'success' | 'error' | 'warning', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load Vision profile on mount to construct SVG Filter matrix
  useEffect(() => {
    const loadProfile = async () => {
      let activeProfile = null;
      const cached = localStorage.getItem('chromashift_cvd_profile');
      if (cached) {
        try {
          activeProfile = JSON.parse(cached);
        } catch (_) {}
      }
      
      if (!activeProfile) {
        try {
          activeProfile = await profileService.getProfile();
        } catch (_) {}
      }

      if (activeProfile) {
        const type = activeProfile.cvd_type || 'deuteranopia';
        const s = activeProfile.severity || 1.0;
        
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
        
        if (type === 'protanopia') {
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
        } else if (type === 'tritanopia') {
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
          // Deuteranopia
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
        
        const M_daltonize = Array(3).fill(0).map(() => Array(3).fill(0));
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            M_daltonize[i][j] = identity3x3[i][j] + s * M_err_remap[i][j];
          }
        }

        const valuesStr = `${M_daltonize[0][0]} ${M_daltonize[0][1]} ${M_daltonize[0][2]} 0 0  ${M_daltonize[1][0]} ${M_daltonize[1][1]} ${M_daltonize[1][2]} 0 0  ${M_daltonize[2][0]} ${M_daltonize[2][1]} ${M_daltonize[2][2]} 0 0  0 0 0 1 0`;
        setSvgMatrixValues(valuesStr);
      }
    };
    loadProfile();
  }, []);

  // Pre-process Orchard Image during Test or Intermission
  useEffect(() => {
    if ((testPhase === 'test_original' || testPhase === 'intermission') && !processedOrchardUrl && !isProcessingOrchard) {
      const processOrchard = async () => {
        setIsProcessingOrchard(true);
        try {
          let profile = null;
          const cached = localStorage.getItem('chromashift_cvd_profile');
          if (cached) {
            try { profile = JSON.parse(cached); } catch (e) {}
          }
          if (!profile) {
            try {
              profile = await profileService.getProfile();
            } catch (e) {
              console.warn("Could not fetch profile, using defaults");
            }
          }
          const type = profile?.cvd_type || profile?.type || 'deuteranopia';
          const severity = profile?.severity || 1.0;
          
          const imagePath = testMode === 'official' ? '/nature_orchard_2.jpg' : '/nature_orchard.png';
          const imageName = testMode === 'official' ? 'nature_orchard_2.jpg' : 'nature_orchard.png';
          const mimeType = testMode === 'official' ? 'image/jpeg' : 'image/png';
          
          const response = await fetch(imagePath);
          const blob = await response.blob();
          const file = new File([blob], imageName, { type: mimeType });
          
          const uploadRes = await mediaService.uploadMedia(file);
          const jobId = uploadRes.job_id;
          
          await mediaService.processMedia(jobId, { cvd_type: type, severity });
          
          let attempts = 0;
          while (attempts < 20) {
            const statusRes = await mediaService.getMediaStatus(jobId);
            if (statusRes.status === 'completed' && statusRes.download_url) {
              setProcessedOrchardUrl(statusRes.download_url);
              break;
            } else if (statusRes.status === 'error' || statusRes.status === 'failed') {
              console.error('Failed to process orchard image');
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
          }
        } catch (err) {
          console.error("Error processing orchard image:", err);
        } finally {
          setIsProcessingOrchard(false);
        }
      };
      processOrchard();
    }
  }, [testPhase, testMode, processedOrchardUrl, isProcessingOrchard]);

  // Timer helper utilities
  const startTimer = () => {
    timerRef.current = performance.now();
  };

  const stopTimer = (): number => {
    const end = performance.now();
    const elapsed = (end - timerRef.current) / 1000;
    return parseFloat(elapsed.toFixed(2));
  };

  // Flow diagram single transition task
  const startFlowDiagramTask = () => {
    setFlowTransitionComplete(false);
    setFlowNodeColor(testMode === 'official' ? '#ef6c00' : '#c62828'); // Start Orange / Red
    startTimer();
    
    // Animate a transition after 1.5 seconds
    setTimeout(() => {
      const isOriginal = testPhase === 'test_original';
      if (testMode === 'official') {
        setFlowNodeColor(isOriginal ? '#c62828' : '#2e7d32'); // Red / Green
      } else {
        setFlowNodeColor(isOriginal ? '#8d6e63' : '#2e7d32'); // Brown / Green
      }
      setFlowTransitionComplete(true);
    }, 1500);
  };

  const handleFlowDecision = (decision: 'accept' | 'reject') => {
    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    
    const isCorrect = isOriginal ? (decision === 'reject') : (decision === 'accept');
    
    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken,
      clicks: 1,
      clickAccuracy: isCorrect ? 1.0 : 0.0
    };

    if (isOriginal) {
      setOriginalResults(prev => [...prev, result]);
    } else {
      setCorrectedResults(prev => [...prev, result]);
    }

    // Advance to next task (Document task 5)
    setSelectedValue("");
    setSelectedTableRows([]);
    setCurrentTaskIndex(4);
    startTimer();
  };

  // Game action triggers
  const handleStartOriginalPhase = () => {
    setOriginalResults([]);
    setCorrectedResults([]);
    setProcessedOrchardUrl(null); // Reset pre-processed image URL
    setCurrentTaskIndex(0);
    setSelectedValue("");
    setTestPhase('test_original');
    startTimer();
  };

  const handleStartCorrectedPhase = () => {
    setCurrentTaskIndex(0);
    setSelectedValue("");
    setTestPhase('test_corrected');
    startTimer();
  };

  // Image Questions (Sandbox Mode)
  const sandboxTask1Data = {
    original: {
      question: "Examine the sales line chart. What is the value of the RED line in Quarter 3 (Q3)?",
      options: ["$20k", "$45k", "$30k", "$55k"],
      correct: "$45k"
    },
    corrected: {
      question: "Examine the sales line chart. What is the value of the GREEN line in Quarter 2 (Q2)?",
      options: ["$15k", "$30k", "$50k", "$25k"],
      correct: "$30k"
    }
  };

  const sandboxTask2Data = {
    original: {
      question: "Examine the project status board. Which phase is currently DELAYED (indicated by Red status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 2"
    },
    corrected: {
      question: "Examine the project status board. Which phase is currently ON TRACK (indicated by Green status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 1"
    }
  };

  const sandboxTask6Data = {
    original: {
      question: "Examine the orchard image. How many red apples can you spot in the tree foliage?",
      options: ["4", "5", "6", "8"],
      correct: "6"
    },
    corrected: {
      question: "Examine the orchard image. How many red apples can you spot in the tree foliage?",
      options: ["4", "5", "6", "8"],
      correct: "6"
    }
  };

  // Official Mode Datasets (Research Study)
  const officialTask1Data = {
    original: {
      question: "Examine the sales line chart. What is the value of the RED line in Quarter 2 (Q2)?",
      options: ["$15k", "$30k", "$45k", "$60k"],
      correct: "$15k"
    },
    corrected: {
      question: "Examine the sales line chart. What is the value of the GREEN line in Quarter 3 (Q3)?",
      options: ["$15k", "$30k", "$45k", "$60k"],
      correct: "$15k"
    }
  };

  const officialTask2Data = {
    original: {
      question: "Examine the project status board. Which phase is currently ON TRACK (indicated by Green status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 3"
    },
    corrected: {
      question: "Examine the project status board. Which phase is currently PAUSED (indicated by Yellow status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 2"
    }
  };

  const officialTask6Data = {
    original: {
      question: "Examine the citrus orchard image. How many orange tangerines can you spot on the branch?",
      options: ["5", "6", "7", "8"],
      correct: "6"
    },
    corrected: {
      question: "Examine the citrus orchard image. How many orange tangerines can you spot on the branch?",
      options: ["5", "6", "7", "8"],
      correct: "6"
    }
  };

  // Helper selectors
  const task1Data = testMode === 'official' ? officialTask1Data : sandboxTask1Data;
  const task2Data = testMode === 'official' ? officialTask2Data : sandboxTask2Data;
  const task6Data = testMode === 'official' ? officialTask6Data : sandboxTask6Data;

  // Task 3: Server Grid Click
  const handleHeatmapClick = (row: number, col: number) => {
    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    const isCorrect = testMode === 'official' ? (row === 0 && col === 3) : (row === 2 && col === 1);

    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken
    };

    if (isOriginal) {
      setOriginalResults(prev => [...prev, result]);
    } else {
      setCorrectedResults(prev => [...prev, result]);
    }

    // Move to Task 4: Flow Diagram game
    setCurrentTaskIndex(3);
    startFlowDiagramTask();
  };

  // Multiple Choice Submission (Tasks 1, 2, 5, and 6)
  const handleNextTaskMC = () => {
    if (currentTaskIndex === 4 && selectedTableRows.length === 0) {
      triggerNotification('warning', 'Please select at least one valid row.');
      return;
    }
    
    if ((currentTaskIndex < 2 || currentTaskIndex === 5) && !selectedValue) {
      triggerNotification('warning', 'Please select an option to submit your answer.');
      return;
    }

    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    
    // Check answer correctness
    let isCorrect = false;
    if (currentTaskIndex === 0) {
      isCorrect = isOriginal ? (selectedValue === task1Data.original.correct) : (selectedValue === task1Data.corrected.correct);
    } else if (currentTaskIndex === 1) {
      isCorrect = isOriginal ? (selectedValue === task2Data.original.correct) : (selectedValue === task2Data.corrected.correct);
    } else if (currentTaskIndex === 4) {
      const correctRows = testMode === 'official' ? [2, 5] : [1, 4];
      isCorrect = (selectedTableRows.length === correctRows.length) && 
                  correctRows.every(r => selectedTableRows.includes(r));
    } else if (currentTaskIndex === 5) {
      isCorrect = isOriginal ? (selectedValue === task6Data.original.correct) : (selectedValue === task6Data.corrected.correct);
    }

    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken
    };

    const compileMetrics = (orig: TaskResult[], corr: TaskResult[]) => {
      if (orig.length < 6 || corr.length < 6) return null;
      return {
        task1: {
          original_time: orig[0].time,
          original_correct: orig[0].accuracy,
          corrected_time: corr[0].time,
          corrected_correct: corr[0].accuracy
        },
        task2: {
          original_time: orig[1].time,
          original_correct: orig[1].accuracy,
          corrected_time: corr[1].time,
          corrected_correct: corr[1].accuracy
        },
        task3: {
          original_time: orig[2].time,
          original_correct: orig[2].accuracy,
          corrected_time: corr[2].time,
          corrected_correct: corr[2].accuracy
        },
        video: {
          original_time: orig[3].time,
          original_clicks: orig[3].clicks || 0,
          original_accuracy: orig[3].clickAccuracy || 0.0,
          corrected_time: corr[3].time,
          corrected_clicks: corr[3].clicks || 0,
          corrected_accuracy: corr[3].clickAccuracy || 0.0
        },
        document: {
          original_time: orig[4].time,
          original_correct: orig[4].accuracy,
          corrected_time: corr[4].time,
          corrected_correct: corr[4].accuracy
        },
        task6: {
          original_time: orig[5].time,
          original_correct: orig[5].accuracy,
          corrected_time: corr[5].time,
          corrected_correct: corr[5].accuracy
        }
      };
    };

    if (isOriginal) {
      const updated = [...originalResults, result];
      setOriginalResults(updated);
      
      if (currentTaskIndex === 5) {
        setTestPhase('intermission');
      } else {
        setSelectedValue("");
        setCurrentTaskIndex(prev => prev + 1);
        startTimer();
      }
    } else {
      const updated = [...correctedResults, result];
      setCorrectedResults(updated);
      if (currentTaskIndex === 5) {
        // Compile performance metrics for both modes and save to session storage
        const compiled = compileMetrics(originalResults, updated);
        if (compiled) {
          sessionStorage.setItem('chromashift_pending_performance_metrics', JSON.stringify(compiled));
          sessionStorage.setItem('chromashift_pending_test_mode', testMode);
          localStorage.setItem('chromashift_metrics_done', 'true');
          window.dispatchEvent(new Event('storage'));
        }
        setTestPhase('results');
        triggerNotification('success', 'Timed Tasks Completed! Loading Results Dashboard...');
      } else {
        setSelectedValue("");
        setCurrentTaskIndex(prev => prev + 1);
        startTimer();
      }
    }
  };

  // Compile unified research payload structure for the survey wizard submission
  const getCompiledPerformanceMetrics = () => {
    if (originalResults.length < 6 || correctedResults.length < 6) return null;
    return {
      task1: {
        original_time: originalResults[0].time,
        original_correct: originalResults[0].accuracy,
        corrected_time: correctedResults[0].time,
        corrected_correct: correctedResults[0].accuracy
      },
      task2: {
        original_time: originalResults[1].time,
        original_correct: originalResults[1].accuracy,
        corrected_time: correctedResults[1].time,
        corrected_correct: correctedResults[1].accuracy
      },
      task3: {
        original_time: originalResults[2].time,
        original_correct: originalResults[2].accuracy,
        corrected_time: correctedResults[2].time,
        corrected_correct: correctedResults[2].accuracy
      },
      video: {
        original_time: originalResults[3].time,
        original_clicks: originalResults[3].clicks || 0,
        original_accuracy: originalResults[3].clickAccuracy || 0.0,
        corrected_time: correctedResults[3].time,
        corrected_clicks: correctedResults[3].clicks || 0,
        corrected_accuracy: correctedResults[3].clickAccuracy || 0.0
      },
      document: {
        original_time: originalResults[4].time,
        original_correct: originalResults[4].accuracy,
        corrected_time: correctedResults[4].time,
        corrected_correct: correctedResults[4].accuracy
      },
      task6: {
        original_time: originalResults[5].time,
        original_correct: originalResults[5].accuracy,
        corrected_time: correctedResults[5].time,
        corrected_correct: correctedResults[5].accuracy
      }
    };
  };

  // Statistics calculation helpers
  const calculateAccuracy = (results: TaskResult[]): number => {
    if (results.length === 0) return 0;
    let totalScore = 0;
    results.forEach((r, idx) => {
      if (idx === 3) {
        totalScore += r.clickAccuracy || 0.0;
      } else {
        totalScore += r.accuracy ? 1.0 : 0.0;
      }
    });
    return Math.round((totalScore / results.length) * 100);
  };

  const calculateAvgTime = (results: TaskResult[]): number => {
    if (results.length === 0) return 0;
    const totalTime = results.reduce((acc, r) => acc + r.time, 0);
    return parseFloat((totalTime / results.length).toFixed(2));
  };

  const origAccuracy = calculateAccuracy(originalResults);
  const corrAccuracy = calculateAccuracy(correctedResults);
  const origTime = calculateAvgTime(originalResults);
  const corrTime = calculateAvgTime(correctedResults);

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`badge badge-${notification.type === 'error' ? 'error' : notification.type === 'warning' ? 'warning' : 'success'}`}
          style={{
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
            backgroundColor: notification.type === 'error' ? 'var(--color-error)' : notification.type === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
            color: '#ffffff',
            animation: 'slide-up 0.2s ease-out'
          }}
        >
          {notification.text}
        </div>
      )}

      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          margin: 'var(--space-6) auto',
          padding: '1px',
          background: 'var(--primary-gradient)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative'
        }}
      >
        {/* Dynamic GPU-accelerated FeColorMatrix Filter using calibration coefficients */}
        <svg width="0" height="0" style={{ position: 'absolute', zIndex: -100, pointerEvents: 'none' }}>
          <defs>
            <filter id="vision-daltonize-filter" colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={svgMatrixValues} />
            </filter>
          </defs>
        </svg>

      <div
        key={`${testPhase}-${currentTaskIndex}`}
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '23px',
          border: '1px solid var(--border-primary)'
        }}
        className="vstack gap-6"
      >
        
        {/* ================= STAGE 1: MODE SELECTION INTRO ================= */}
        {testPhase === 'selection' && (
          <div className="vstack gap-8" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-6) 0' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <FiActivity size={36} />
            </div>
            
            <div className="vstack gap-2">
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Visual Metrics
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                Test your color vision speed and accuracy. Choose a mode below to start.
              </p>
              <div 
                style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--primary)', 
                  fontWeight: '600', 
                  maxWidth: '600px', 
                  margin: 'var(--space-2) auto 0 auto', 
                  backgroundColor: 'var(--primary-glow)', 
                  padding: '10px 16px', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--primary)',
                  lineHeight: '1.4'
                }}
              >
                <strong>Recommendation:</strong> Play the <strong>Playground Sandbox</strong> first to get familiar with the tasks before starting the <strong>Official Usability Study</strong>.
              </div>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-6)',
                width: '100%',
                maxWidth: '700px'
              }}
            >
              {/* Option A: Sandbox Playground */}
              <div 
                className="card card-interactive vstack gap-4"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onClick={() => {
                  setTestMode('sandbox');
                  setTestPhase('welcome');
                }}
              >
                <div className="vstack gap-4">
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start', padding: '6px 12px' }}>Vision Playground</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>Playground Sandbox</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Practice the 6 visual tasks with immediate feedback. No data is saved on the server.
                  </p>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.85rem', marginTop: 'auto' }}>
                  Select Mode →
                </div>
              </div>

              {/* Option B: Guided Research Session */}
              <div 
                className="card card-interactive vstack gap-4"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onClick={() => {
                  setTestMode('official');
                  setTestPhase('welcome');
                }}
              >
                <div className="vstack gap-4">
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start', borderColor: 'var(--primary)', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '6px 12px' }}>Research Study Session</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>Official Usability Study</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    A guided testing session. Results are saved securely to help evaluate platform accessibility.
                  </p>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.85rem', marginTop: 'auto' }}>
                  Select Mode →
                </div>
              </div>
            </div>

            <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: 'var(--space-2)' }}>
              Return to Dashboard
            </button>
          </div>
        )}

        {/* ================= STAGE 2: DEMOGRAPHICS PRE-TASK SURV (OFFICIAL) ================= */}
        {testPhase === 'research_pre' && (
          <SurveyWizard 
            performanceMetrics={null} 
            onComplete={() => {}} 
            onBackToApp={() => setTestPhase('selection')}
          />
        )}

        {/* SurveyWizard Interop Hack for guided session: pre-task triggers step welcome */}
        {testPhase === 'research_pre' && (
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => setTestPhase('welcome')}
              style={{ padding: '0.75rem 2rem' }}
            >
              Start Timed Performance Tasks
            </button>
          </div>
        )}

        {/* ================= STAGE 3: WELCOME MODULE ================= */}
        {testPhase === 'welcome' && (
          <div className="vstack gap-8" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-6) 0' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <FiActivity size={36} />
            </div>

            <div className="vstack gap-2">
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                <span>{testMode === 'official' ? 'Visual Testing' : 'Visual Playground'}</span>
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                Complete the tasks in two phases: Phase 1 with <strong>Original Colors</strong>, and Phase 2 with <strong>Corrected Colors</strong>.
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 'var(--space-4)',
                width: '100%',
                maxWidth: '850px',
                textAlign: 'left'
              }}
            >
              <div className="card vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                  <FiTrendingUp />
                  <span style={{ fontSize: '0.85rem' }}>6 Visual Tasks</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Identify details in charts, tables, maps, videos, and scenes.
                </p>
              </div>

              <div className="card vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="hstack gap-2" style={{ color: 'var(--color-warning)', fontWeight: '700' }}>
                  <FiClock />
                  <span style={{ fontSize: '0.85rem' }}>Timed Exercises</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Measure your speed and accuracy under each color phase.
                </p>
              </div>

              <div className="card vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                  <FiCheckCircle />
                  <span style={{ fontSize: '0.85rem' }}>Performance Report</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Get a final report comparing original vs. corrected performance.
                </p>
              </div>
            </div>

            <div className="hstack gap-4" style={{ justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-ghost"
                style={{
                  padding: '1rem 2rem'
                }}
                onClick={() => setTestPhase('selection')}
              >
                Go Back
              </button>
              <button 
                className="btn btn-primary btn-lg"
                style={{
                  background: 'var(--primary-gradient)',
                  fontWeight: '800',
                  boxShadow: 'var(--shadow-md)',
                  padding: '1rem 2.5rem'
                }}
                onClick={handleStartOriginalPhase}
              >
                <FiPlay /> Start Phase 1 (Original Colors)
              </button>
            </div>
          </div>
        )}

        {/* ================= STAGE 4: RUN TIMED VISUAL TASKS ================= */}
        {(testPhase === 'test_original' || testPhase === 'test_corrected') && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            
            {/* Header progress bar */}
            <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div className="vstack gap-1">
                <span 
                  className={`badge ${testPhase === 'test_original' ? 'badge-warning' : 'badge-success'}`}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px' }}
                >
                  {testPhase === 'test_original' ? 'Phase 1: Original Colors' : 'Phase 2: Corrected Colors (Active)'}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                  {currentTaskIndex === 0 && <span>Task 1 of 6: Line Graph Legibility</span>}
                  {currentTaskIndex === 1 && <span>Task 2 of 6: Color-Dependent Bar Status</span>}
                  {currentTaskIndex === 2 && <span>Task 3 of 6: Interactive Server Node Alert</span>}
                  {currentTaskIndex === 3 && <span>Task 4 of 6: Dynamic Video Target Tracking</span>}
                  {currentTaskIndex === 4 && <span>Task 5 of 6: PDF Map Shading Comprehension</span>}
                  {currentTaskIndex === 5 && <span>Task 6 of 6: Natural Scene Fruit Spotting</span>}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                <span>Progress: </span><span>{Math.round(((currentTaskIndex) / 6) * 100)}</span><span>%</span>
              </span>
            </div>
            
            {/* Native progress bar */}
            <div
              style={{
                height: '6px',
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                marginBottom: 'var(--space-2)'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(currentTaskIndex / 6) * 100}%`,
                  backgroundColor: 'var(--primary)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width var(--transition-normal)'
                }}
              />
            </div>

            {/* Test Arena: Split Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: windowWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-8)',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <div 
                style={{
                  padding: 'var(--space-6)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-secondary)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* TASK 1: Line Chart */}
                {currentTaskIndex === 0 && (
                  <div style={{ height: '260px', width: '100%', position: 'relative', filter: (testPhase === 'test_corrected') ? 'url(#vision-daltonize-filter)' : 'none', transform: 'translate3d(0, 0, 0)', WebkitTransform: 'translate3d(0, 0, 0)', willChange: 'filter' }}>
                    <svg viewBox="0 0 400 200" width="100%" height="100%" style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                      <line x1="40" y1="20" x2="380" y2="20" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="60" x2="380" y2="60" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="100" x2="380" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="140" x2="380" y2="140" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="180" x2="380" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="40" y1="20" x2="40" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />

                      <text x="30" y="24" fill="#475569" fontSize="9" textAnchor="end">$60k</text>
                      <text x="30" y="64" fill="#475569" fontSize="9" textAnchor="end">$45k</text>
                      <text x="30" y="104" fill="#475569" fontSize="9" textAnchor="end">$30k</text>
                      <text x="30" y="144" fill="#475569" fontSize="9" textAnchor="end">$15k</text>
                      <text x="30" y="184" fill="#475569" fontSize="9" textAnchor="end">$0k</text>

                      <text x="90" y="195" fill="#475569" fontSize="9" textAnchor="middle">Q1</text>
                      <text x="180" y="195" fill="#475569" fontSize="9" textAnchor="middle">Q2</text>
                      <text x="270" y="195" fill="#475569" fontSize="9" textAnchor="middle">Q3</text>
                      <text x="350" y="195" fill="#475569" fontSize="9" textAnchor="middle">Q4</text>

                      {/* expenses line (Green) */}
                      {testMode === 'official' ? (
                        <>
                          <path d="M 90 100 L 180 60 L 270 140 L 350 20" fill="none" stroke="#2e7d32" strokeWidth="3" />
                          <circle cx="90" cy="100" r="4" fill="#2e7d32" />
                          <circle cx="180" cy="60" r="4" fill="#2e7d32" />
                          <circle cx="270" cy="140" r="4" fill="#2e7d32" />
                          <circle cx="350" cy="20" r="4" fill="#2e7d32" />
                        </>
                      ) : (
                        <>
                          <path d="M 90 140 L 180 100 L 270 100 L 350 60" fill="none" stroke="#2e7d32" strokeWidth="3" />
                          <circle cx="90" cy="140" r="4" fill="#2e7d32" />
                          <circle cx="180" cy="100" r="4" fill="#2e7d32" />
                          <circle cx="270" cy="100" r="4" fill="#2e7d32" />
                          <circle cx="350" cy="60" r="4" fill="#2e7d32" />
                        </>
                      )}

                      {/* Revenue line (Red) */}
                      {testMode === 'official' ? (
                        <>
                          <path d="M 90 60 L 180 140 L 270 100 L 350 100" fill="none" stroke="#c62828" strokeWidth="3" />
                          <circle cx="90" cy="60" r="4" fill="#c62828" />
                          <circle cx="180" cy="140" r="4" fill="#c62828" />
                          <circle cx="270" cy="100" r="4" fill="#c62828" />
                          <circle cx="350" cy="100" r="4" fill="#c62828" />
                        </>
                      ) : (
                        <>
                          <path d="M 90 100 L 180 140 L 270 60 L 350 20" fill="none" stroke="#c62828" strokeWidth="3" />
                          <circle cx="90" cy="100" r="4" fill="#c62828" />
                          <circle cx="180" cy="140" r="4" fill="#c62828" />
                          <circle cx="270" cy="60" r="4" fill="#c62828" />
                          <circle cx="350" cy="20" r="4" fill="#c62828" />
                        </>
                      )}

                      {/* Line 3: Budget - BROWN */}
                      {testMode === 'official' ? (
                        <>
                          <path d="M 90 140 L 180 100 L 270 20 L 350 60" fill="none" stroke="#8d6e63" strokeWidth="3" />
                          <circle cx="90" cy="140" r="4" fill="#8d6e63" />
                          <circle cx="180" cy="100" r="4" fill="#8d6e63" />
                          <circle cx="270" cy="20" r="4" fill="#8d6e63" />
                          <circle cx="350" cy="60" r="4" fill="#8d6e63" />
                        </>
                      ) : (
                        <>
                          <path d="M 90 60 L 180 60 L 270 140 L 350 100" fill="none" stroke="#8d6e63" strokeWidth="3" />
                          <circle cx="90" cy="60" r="4" fill="#8d6e63" />
                          <circle cx="180" cy="60" r="4" fill="#8d6e63" />
                          <circle cx="270" cy="140" r="4" fill="#8d6e63" />
                          <circle cx="350" cy="100" r="4" fill="#8d6e63" />
                        </>
                      )}

                      {/* Line 4: Projected - OLIVE */}
                      {testMode === 'official' ? (
                        <>
                          <path d="M 90 20 L 180 20 L 270 60 L 350 140" fill="none" stroke="#9e9d24" strokeWidth="3" />
                          <circle cx="90" cy="20" r="4" fill="#9e9d24" />
                          <circle cx="180" cy="20" r="4" fill="#9e9d24" />
                          <circle cx="270" cy="60" r="4" fill="#9e9d24" />
                          <circle cx="350" cy="140" r="4" fill="#9e9d24" />
                        </>
                      ) : (
                        <>
                          <path d="M 90 100 L 180 20 L 270 100 L 350 140" fill="none" stroke="#9e9d24" strokeWidth="3" />
                          <circle cx="90" cy="100" r="4" fill="#9e9d24" />
                          <circle cx="180" cy="20" r="4" fill="#9e9d24" />
                          <circle cx="270" cy="100" r="4" fill="#9e9d24" />
                          <circle cx="350" cy="140" r="4" fill="#9e9d24" />
                        </>
                      )}
                    </svg>
                  </div>
                )}

                {/* TASK 2: Bar Chart */}
                {currentTaskIndex === 1 && (
                  <div style={{ height: '260px', width: '100%', filter: (testPhase === 'test_corrected') ? 'url(#vision-daltonize-filter)' : 'none', transform: 'translate3d(0, 0, 0)', WebkitTransform: 'translate3d(0, 0, 0)', willChange: 'filter' }}>
                    <svg viewBox="0 0 400 200" width="100%" height="100%" style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                      <line x1="40" y1="40" x2="380" y2="40" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="75" x2="380" y2="75" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="110" x2="380" y2="110" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="145" x2="380" y2="145" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="40" y1="180" x2="380" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="40" y1="40" x2="40" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />

                      {testMode === 'official' ? (
                        <>
                          <rect x="45" y="12" width="8" height="8" fill="#d32f2f" rx="2" />
                          <text x="58" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">Delayed</text>
                          <rect x="125" y="12" width="8" height="8" fill="#fbc02d" rx="2" />
                          <text x="138" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">Paused</text>
                          <rect x="205" y="12" width="8" height="8" fill="#388e3c" rx="2" />
                          <text x="218" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">On Track</text>
                          <rect x="285" y="12" width="8" height="8" fill="#ef6c00" rx="2" />
                          <text x="298" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">At Risk</text>
                        </>
                      ) : (
                        <>
                          <rect x="45" y="12" width="8" height="8" fill="#388e3c" rx="2" />
                          <text x="58" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">On Track</text>
                          <rect x="125" y="12" width="8" height="8" fill="#d32f2f" rx="2" />
                          <text x="138" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">Delayed</text>
                          <rect x="205" y="12" width="8" height="8" fill="#ef6c00" rx="2" />
                          <text x="218" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">At Risk</text>
                          <rect x="285" y="12" width="8" height="8" fill="#fbc02d" rx="2" />
                          <text x="298" y="19" fill="#0f172a" fontSize="8" fontWeight="bold">Paused</text>
                        </>
                      )}

                      <text x="30" y="44" fill="#475569" fontSize="9" textAnchor="end">100%</text>
                      <text x="30" y="79" fill="#475569" fontSize="9" textAnchor="end">75%</text>
                      <text x="30" y="114" fill="#475569" fontSize="9" textAnchor="end">50%</text>
                      <text x="30" y="149" fill="#475569" fontSize="9" textAnchor="end">25%</text>
                      <text x="30" y="184" fill="#475569" fontSize="9" textAnchor="end">0%</text>

                      {testMode === 'official' ? (
                        <>
                          <rect x="70" y="40" width="40" height="140" fill="#d32f2f" rx="4" />
                          <text x="90" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 1</text>
                          <rect x="150" y="100" width="40" height="80" fill="#fbc02d" rx="4" />
                          <text x="170" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 2</text>
                          <rect x="230" y="20" width="40" height="160" fill="#388e3c" rx="4" />
                          <text x="250" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 3</text>
                          <rect x="310" y="70" width="40" height="110" fill="#ef6c00" rx="4" />
                          <text x="330" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 4</text>
                        </>
                      ) : (
                        <>
                          <rect x="70" y="60" width="40" height="120" fill="#388e3c" rx="4" />
                          <text x="90" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 1</text>
                          <rect x="150" y="60" width="40" height="120" fill="#d32f2f" rx="4" />
                          <text x="170" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 2</text>
                          <rect x="230" y="60" width="40" height="120" fill="#ef6c00" rx="4" />
                          <text x="250" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 3</text>
                          <rect x="310" y="60" width="40" height="120" fill="#fbc02d" rx="4" />
                          <text x="330" y="195" fill="#0f172a" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 4</text>
                        </>
                      )}
                    </svg>
                  </div>
                )}

                {/* TASK 3: Heatmap Server Nodes */}
                {currentTaskIndex === 2 && (
                  <div className="vstack gap-4" style={{ width: '100%', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>
                      Click the Node in Critical Alert (Red)
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '10px',
                        maxWidth: '260px',
                        width: '100%',
                        margin: '0 auto',
                        filter: (testPhase === 'test_corrected') ? 'url(#vision-daltonize-filter)' : 'none',
                        transform: 'translate3d(0, 0, 0)',
                        WebkitTransform: 'translate3d(0, 0, 0)',
                        willChange: 'filter'
                      }}
                    >
                      {Array.from({ length: 4 }).map((_, rIdx) => 
                        Array.from({ length: 4 }).map((_, cIdx) => {
                          const isAlert = testMode === 'official' ? (rIdx === 0 && cIdx === 3) : (rIdx === 2 && cIdx === 1);
                          const cellColor = isAlert 
                            ? '#c62828' 
                            : (testMode === 'official' 
                              ? ((rIdx * cIdx + 1) % 3 === 0 ? '#ef6c00' : '#2e7d32') 
                              : ((rIdx + cIdx) % 3 === 0 ? '#ef6c00' : '#2e7d32'));
                          return (
                            <div 
                              key={`${rIdx}-${cIdx}`}
                              style={{
                                aspectRatio: '1',
                                backgroundColor: cellColor,
                                borderRadius: 'var(--radius-md)',
                                border: '2px solid white',
                                boxShadow: 'var(--shadow-sm)',
                                cursor: 'pointer',
                                transition: 'transform var(--transition-fast)'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                              onClick={() => handleHeatmapClick(rIdx, cIdx)}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TASK 4: Chromatic Confusion Flow Diagram */}
                {currentTaskIndex === 3 && (
                  <div className="vstack gap-4" style={{ width: '100%' }}>
                    <div className="hstack gap-2" style={{ color: 'var(--color-error)' }}>
                      <FiActivity />
                      <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>State Transition Validation</span>
                    </div>

                    <div 
                      style={{
                        width: '100%',
                        height: '240px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        filter: (testPhase === 'test_corrected') ? 'url(#vision-daltonize-filter)' : 'none',
                        transform: 'translate3d(0, 0, 0)',
                        WebkitTransform: 'translate3d(0, 0, 0)',
                        willChange: 'filter'
                      }}
                    >
                      <div className="hstack gap-6" style={{ alignItems: 'center' }}>
                        {/* Fixed Initial Node (Red / Orange) */}
                        <div 
                          style={{
                            width: '60px',
                            height: '60px',
                            backgroundColor: testMode === 'official' ? '#ef6c00' : '#c62828',
                            borderRadius: 'var(--radius-full)',
                            boxShadow: 'var(--shadow-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700'
                          }}
                        >
                          A
                        </div>
                        
                        {/* Arrow */}
                        <div style={{ width: '60px', height: '4px', backgroundColor: 'var(--border-secondary)', position: 'relative' }}>
                          <div 
                            style={{
                              position: 'absolute',
                              right: '-2px',
                              top: '-6px',
                              borderLeft: '8px solid var(--border-secondary)',
                              borderTop: '8px solid transparent',
                              borderBottom: '8px solid transparent'
                            }}
                          />
                        </div>

                        {/* Transitioning Target Node */}
                        <div 
                          style={{
                            width: '60px',
                            height: '60px',
                            backgroundColor: flowNodeColor,
                            borderRadius: 'var(--radius-full)',
                            boxShadow: 'var(--shadow-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            transition: 'background-color 0.5s ease'
                          }}
                        >
                          B
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TASK 5: Data Extraction from Color-Coded Table */}
                {currentTaskIndex === 4 && (
                  <div className="vstack gap-4" style={{ width: '100%' }}>
                    <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
                      <FiFileText />
                      <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>Status Log Validation Table</span>
                    </div>
                    <div 
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                        overflow: 'hidden',
                        filter: (testPhase === 'test_corrected') ? 'url(#vision-daltonize-filter)' : 'none',
                        transform: 'translate3d(0, 0, 0)',
                        WebkitTransform: 'translate3d(0, 0, 0)',
                        willChange: 'filter'
                      }}
                    >
                      <div className="vstack" style={{ width: '100%' }}>
                        {/* Table Headers */}
                        <div 
                          className="hstack"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            padding: 'var(--space-2) var(--space-4)',
                            borderBottom: '1px solid var(--border-primary)',
                            width: '100%'
                          }}
                        >
                          <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>ID</span>
                          <span style={{ flex: 2, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>PROCESS</span>
                          <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textAlign: 'right' }}>STATUS</span>
                        </div>
                        {/* Table Rows (6 rows) */}
                        {Array.from({ length: 6 }).map((_, idx) => {
                          const isOfficial = testMode === 'official';
                          let rowBg = '#8d6e63'; // default noise
                          
                          if (isOfficial) {
                            if (idx === 2 || idx === 5) rowBg = '#c62828'; // Failure target
                            else if (idx === 1 || idx === 4) rowBg = '#2e7d32'; // Green noise
                          } else {
                            if (idx === 1 || idx === 4) rowBg = '#2e7d32'; // Success target
                            else if (idx === 0 || idx === 3) rowBg = '#c62828'; // Red noise
                          }

                          const isSelected = selectedTableRows.includes(idx);
                          const rowId = isOfficial ? 5000 + idx : 1000 + idx;
                          const processNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
                          const rowName = isOfficial ? `TASK_${processNames[idx]}` : `PROC_${String.fromCharCode(65 + idx)}`;

                          return (
                            <div 
                              key={idx}
                              className="hstack"
                              style={{
                                padding: 'var(--space-3) var(--space-4)',
                                backgroundColor: rowBg,
                                borderBottom: '1px solid rgba(255,255,255,0.15)',
                                cursor: 'pointer',
                                opacity: isSelected ? 1 : 0.85,
                                width: '100%',
                                transition: 'opacity var(--transition-fast)'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = isSelected ? '1' : '0.85'; }}
                              onClick={() => {
                                setSelectedTableRows(prev => 
                                  prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                );
                              }}
                            >
                              <span style={{ flex: 1, fontSize: '0.875rem', color: 'white', fontWeight: '700' }}><span>#</span><span>{rowId}</span></span>
                              <span style={{ flex: 2, fontSize: '0.875rem', color: 'white' }}><span>{rowName}</span></span>
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', color: 'white' }}>
                                {isSelected && <FiCheckCircle size={16} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TASK 6: Orchard Image */}
                {currentTaskIndex === 5 && (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    {testPhase === 'test_corrected' && isProcessingOrchard && (
                      <div style={{ position: 'absolute', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10, borderRadius: 'var(--radius-md)' }}>
                        <span style={{ color: 'white', fontWeight: 'bold' }}>Processing with AI Backend...</span>
                      </div>
                    )}
                    <img 
                      src={testPhase === 'test_corrected' && processedOrchardUrl ? processedOrchardUrl : (testMode === 'official' ? "/nature_orchard_2.jpg" : "/nature_orchard.png")} 
                      onLoad={() => {
                        if (currentTaskIndex === 5) {
                          startTimer();
                        }
                      }}
                      alt="Orchard Fruit Spotting" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '260px', 
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        objectFit: 'contain'
                      }} 
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Dynamic Question + User selection options */}
              <div className="vstack gap-6">
                <div className="card vstack gap-4">
                  <div className="hstack gap-2" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                    <FiGrid />
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Interactive Task Instructions
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {currentTaskIndex === 0 && <span>{testPhase === 'test_original' ? task1Data.original.question : task1Data.corrected.question}</span>}
                    {currentTaskIndex === 1 && <span>{testPhase === 'test_original' ? task2Data.original.question : task2Data.corrected.question}</span>}
                    {currentTaskIndex === 2 && <span>Click on the single status node in critical alert (Red).</span>}
                    {currentTaskIndex === 3 && <span>{testMode === 'official' 
                      ? "Transition Rule: Only Accept (Orange → Green) transitions. Evaluate the transition when it completes." 
                      : "Transition Rule: Only Accept (Red → Green) transitions. Evaluate the transition when it completes."}</span>}
                    {currentTaskIndex === 4 && <span>{testMode === 'official' 
                      ? "Select all rows indicating 'Failure' status (Red backgrounds)." 
                      : "Select all rows indicating 'Success' status (Green backgrounds)."}</span>}
                    {currentTaskIndex === 5 && <span>{testPhase === 'test_original' ? task6Data.original.question : task6Data.corrected.question}</span>}
                  </h4>
                </div>

                {/* Task Choice selections */}
                {(currentTaskIndex < 2 || currentTaskIndex === 5) && (
                  <div className="vstack gap-3" style={{ width: '100%' }}>
                    {(currentTaskIndex === 0 ? 
                      (testPhase === 'test_original' ? task1Data.original.options : task1Data.corrected.options) : 
                      currentTaskIndex === 1 ?
                      (testPhase === 'test_original' ? task2Data.original.options : task2Data.corrected.options) :
                      (testPhase === 'test_original' ? task6Data.original.options : task6Data.corrected.options)
                    ).map((opt) => {
                      const isSelected = selectedValue === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          className="btn btn-outline"
                          style={{
                            width: '100%',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-primary)',
                            backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            whiteSpace: 'normal',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)'
                          }}
                          onClick={() => setSelectedValue(opt)}
                        >
                          {/* Bullet indicator */}
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: 'var(--radius-full)',
                              border: '2px solid var(--border-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {isSelected && (
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'var(--primary)'
                                }}
                              />
                            )}
                          </div>
                          <span style={{ fontWeight: '600' }}><span>{opt}</span></span>
                        </button>
                      );
                    })}
                    <button 
                      className="btn btn-primary btn-lg" 
                      onClick={handleNextTaskMC} 
                      style={{ width: '100%', marginTop: 'var(--space-2)' }}
                    >
                      Submit Response
                    </button>
                  </div>
                )}

                {currentTaskIndex === 2 && (
                  <div 
                    className="card-solid vstack gap-2" 
                    style={{ 
                      border: '1px dashed var(--primary)', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: 'var(--primary-glow)',
                      textAlign: 'center',
                      padding: 'var(--space-4)',
                      alignItems: 'center'
                    }}
                  >
                    <FiActivity size={24} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>Find the critical node!</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click the node in red directly on the left grid matrix.</span>
                  </div>
                )}

                {currentTaskIndex === 3 && (
                  <div className="vstack gap-3" style={{ width: '100%' }}>
                    {!flowTransitionComplete ? (
                      <div 
                        className="card-solid vstack gap-2" 
                        style={{ 
                          border: '1px dashed var(--color-warning)', 
                          borderRadius: 'var(--radius-md)', 
                          backgroundColor: 'rgba(234, 88, 12, 0.05)',
                          textAlign: 'center',
                          padding: 'var(--space-4)',
                          alignItems: 'center'
                        }}
                      >
                        <FiClock size={24} style={{ color: 'var(--color-warning)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>Waiting for Transition...</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Observe Node B carefully.</span>
                      </div>
                    ) : (
                      <div className="vstack gap-3" style={{ width: '100%' }}>
                        <button 
                          className="btn btn-primary btn-lg" 
                          onClick={() => handleFlowDecision('accept')}
                          style={{ width: '100%', backgroundColor: 'var(--color-success)' }}
                        >
                          ACCEPT
                        </button>
                        <button 
                          className="btn btn-outline btn-lg" 
                          onClick={() => handleFlowDecision('reject')}
                          style={{ width: '100%', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                        >
                          REJECT
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentTaskIndex === 4 && (
                  <div className="vstack gap-3" style={{ width: '100%' }}>
                    <div 
                      className="card-solid vstack gap-2" 
                      style={{ 
                        border: '1px dashed var(--primary)', 
                        borderRadius: 'var(--radius-md)', 
                        backgroundColor: 'var(--primary-glow)',
                        textAlign: 'center',
                        padding: 'var(--space-4)',
                        alignItems: 'center'
                      }}
                    >
                      <FiFileText size={24} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>Multiple Row Selection</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click rows on the table to toggle selection. Click submit when ready.</span>
                    </div>
                    <button 
                      className="btn btn-primary btn-lg" 
                      onClick={handleNextTaskMC}
                      style={{ width: '100%' }}
                    >
                      Submit Table Selection
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ================= STAGE 5: INTERMISSION SCREEN ================= */}
        {testPhase === 'intermission' && (
          <div className="vstack gap-8" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-6) 0' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <FiCheckCircle size={36} />
            </div>

            <div className="vstack gap-2">
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Phase 1 Complete!
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
                You have finished all uncorrected tasks using <strong>Original Colors</strong>.
                <br /><br />
                Now, we will activate your <strong>personalized Daltonization filters</strong> and re-run similar tasks.
              </p>
            </div>
            
            <div className="divider" style={{ margin: '0' }} />
            
            <button
              className="btn btn-primary btn-lg"
              style={{
                background: 'linear-gradient(135deg, var(--color-success), #0f766e)',
                fontWeight: '800',
                boxShadow: 'var(--shadow-md)',
                padding: '1rem 2.5rem'
              }}
              onClick={handleStartCorrectedPhase}
            >
              Start Phase 2 (Corrected Colors)
            </button>
          </div>
        )}

        {/* ================= STAGE 6: POST-TASK SURVEY (OFFICIAL) ================= */}
        {testPhase === 'research_post' && (
          <SurveyWizard 
            performanceMetrics={getCompiledPerformanceMetrics()} 
            onComplete={(uuid) => {
              setParticipantUuid(uuid);
              setTestPhase('results');
            }}
            onBackToApp={() => setTestPhase('selection')}
          />
        )}

        {/* ================= STAGE 7: DETAILED COMPARATIVE DASHBOARD ================= */}
        {testPhase === 'results' && (
          <div className="vstack gap-8" style={{ width: '100%', padding: 'var(--space-2) 0' }}>
            
            <div className="hstack gap-4">
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <FiCheckCircle size={30} />
              </div>
              <div className="vstack gap-1">
                {testMode === 'official' ? (
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start', padding: '6px 12px' }}>
                    Official Study Submission Success
                  </span>
                ) : (
                  <span className="badge badge-primary" style={{ alignSelf: 'flex-start', padding: '6px 12px' }}>
                    Vision Playground Sandbox Mode
                  </span>
                )}
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                  Performance Efficiency Dashboard
                </h2>
              </div>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            {/* Display registered research uuid */}
            {testMode === 'official' && participantUuid && (
              <div 
                className="card-solid vstack gap-2"
                style={{
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)'
                }}
              >
                <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '700' }}>
                  <span>🔐 Participant ID Registered: </span><code style={{ fontFamily: 'var(--font-mono)' }}>{participantUuid}</code>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  All metrics, System Usability values, and NASA workloads have been securely locked in ChromaShift's central database for admin review.
                </span>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: windowWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-6)',
                width: '100%'
              }}
            >
              {/* Accuracy */}
              <div className="card vstack gap-4">
                <div 
                  className={windowWidth <= 480 ? "vstack gap-2" : "hstack"} 
                  style={{ 
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%' 
                  }}
                >
                  <span style={{ fontWeight: '800', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Overall Task Accuracy
                  </span>
                  <span className={`badge ${corrAccuracy >= origAccuracy ? 'badge-success' : 'badge-error'}`} style={{ padding: '6px 12px' }}>
                    <span>{corrAccuracy >= origAccuracy ? `+${corrAccuracy - origAccuracy}% Accuracy` : 'No improvement'}</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="card-solid vstack gap-1" style={{ backgroundColor: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.1)', padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Original Colors</span>
                    <span style={{ fontSize: '1.75rem', color: 'var(--color-warning)', fontWeight: '900' }}><span>{origAccuracy}</span><span>%</span></span>
                  </div>
                  <div className="card-solid vstack gap-1" style={{ backgroundColor: 'rgba(13, 148, 136, 0.05)', border: '1px solid rgba(13, 148, 136, 0.1)', padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Corrected Colors</span>
                    <span style={{ fontSize: '1.75rem', color: 'var(--color-success)', fontWeight: '900' }}><span>{corrAccuracy}</span><span>%</span></span>
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="card vstack gap-4">
                <div 
                  className={windowWidth <= 480 ? "vstack gap-2" : "hstack"} 
                  style={{ 
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%' 
                  }}
                >
                  <span style={{ fontWeight: '800', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Average Completion Speed
                  </span>
                  <span className={`badge ${origTime > corrTime ? 'badge-success' : 'badge-error'}`} style={{ padding: '6px 12px' }}>
                    <span>{origTime > corrTime ? `${Math.round((origTime / corrTime) * 10) / 10}x Faster` : 'No improvement'}</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="card-solid vstack gap-1" style={{ backgroundColor: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.1)', padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Original Colors</span>
                    <span style={{ fontSize: '1.75rem', color: 'var(--color-warning)', fontWeight: '900' }}><span>{origTime}</span><span>s</span></span>
                  </div>
                  <div className="card-solid vstack gap-1" style={{ backgroundColor: 'rgba(13, 148, 136, 0.05)', border: '1px solid rgba(13, 148, 136, 0.1)', padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Corrected Colors</span>
                    <span style={{ fontSize: '1.75rem', color: 'var(--color-success)', fontWeight: '900' }}><span>{corrTime}</span><span>s</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Core utility takeaway banner */}
            <div 
              className="card-solid vstack gap-2" 
              style={{ 
                backgroundColor: 'var(--primary-glow)', 
                border: '1px solid var(--primary)', 
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                padding: 'var(--space-5)'
              }}
            >
              <h4 style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: '800', margin: '0' }}>
                Utility Metrics Takeaway
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.4' }}>
                {corrAccuracy > origAccuracy && origTime > corrTime ? (
                  <span>Active color remapping successfully resolved color confusion! You achieved <span>{corrAccuracy}</span>% accuracy (<span>{corrAccuracy - origAccuracy}</span>% higher than original) while solving tasks <span>{Math.round((origTime / corrTime) * 10) / 10}</span>x faster.</span>
                ) : origTime > corrTime ? (
                  <span>Color correction significantly reduced visual strain! You completed tasks in <span>{corrTime}</span> seconds average, which is <span>{(origTime - corrTime).toFixed(1)}</span>s faster than standard colors.</span>
                ) : (
                  <span>Color remapping allows you to clearly identify intersecting lines, alert highlights, and bar statuses with absolute confidence!</span>
                )}
              </p>
            </div>

            {/* Bottom Actions */}
            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack gap-4"} 
              style={{ 
                justifyContent: 'center', 
                alignItems: 'stretch',
                marginTop: 'var(--space-4)',
                width: windowWidth <= 480 ? '100%' : 'auto',
                flexDirection: windowWidth <= 480 ? 'column' : 'row'
              }}
            >
              <button
                className="btn btn-primary btn-lg"
                style={{
                  background: 'var(--primary-gradient)',
                  fontWeight: '800',
                  padding: '1rem 2.5rem',
                  boxShadow: 'var(--shadow-lg)',
                  width: windowWidth <= 480 ? '100%' : 'auto',
                  whiteSpace: 'normal',
                  height: 'auto',
                  textAlign: 'center'
                }}
                onClick={() => navigate('/survey')}
              >
                Continue to Usability Survey & Feedback
              </button>
              <button 
                className="btn btn-outline btn-lg" 
                onClick={() => navigate('/')}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back to Dashboard
              </button>
              <button
                className="btn btn-outline btn-lg"
                onClick={() => setTestPhase('selection')}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                <FiRefreshCw /> Change Test Mode
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
};
export default VisionTest;
