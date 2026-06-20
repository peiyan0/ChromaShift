import { useState, useEffect, useRef, type FC } from 'react';
import { profileService, type VisionProfile } from '../services/profile';
import { FiSliders, FiCheckCircle, FiTrash2, FiPlay } from 'react-icons/fi';

// SVG Icons for clean, zero-dependency rendering
const CheckIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--color-error)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Mathematical Hypothesis Space definitions
const CVD_TYPES = ['protanopia', 'deuteranopia', 'tritanopia'];
const SEVERITY_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

interface Hypothesis {
  type: string;
  severity: number;
  probability: number;
  alpha: number;
}

interface Circle {
  x: number;
  y: number;
  r: number;
  isSymbol: boolean;
}

const hypothesesSpace: Omit<Hypothesis, 'probability'>[] = [];
for (const type of CVD_TYPES) {
  for (const severity of SEVERITY_LEVELS) {
    hypothesesSpace.push({ type, severity, alpha: 1.0 });
  }
}

export const CalibrationWizard: FC = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [step, setStep] = useState<'welcome' | 'calibration' | 'results'>('welcome');
  const [round, setRound] = useState<number>(1);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [currentPair, setCurrentPair] = useState<[Hypothesis, Hypothesis] | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [entropyHistory, setEntropyHistory] = useState<number[]>([]);
  
  // Converged Diagnostic Profile
  const [diagnosedProfile, setDiagnosedProfile] = useState<Hypothesis | null>(null);
  const [selections, setSelections] = useState<string[]>([]);

  // Manual adjustment settings for the results stage
  const [customSeverity, setCustomSeverity] = useState<number>(1.0);
  const [customContrast, setCustomContrast] = useState<number>(1.0);
  const [customSaturation, setCustomSaturation] = useState<number>(1.0);
  const [customIntensity, setCustomIntensity] = useState<number>(1.0);

  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const canvasRefA = useRef<HTMLCanvasElement>(null);
  const canvasRefB = useRef<HTMLCanvasElement>(null);
  const canvasRefPreview = useRef<HTMLCanvasElement>(null);
  const hasAutoSaved = useRef(false);

  // Load existing profile on mount (for baseline defaults)
  useEffect(() => {
    const cachedProfile = localStorage.getItem('chromashift_cvd_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setCustomSeverity(parsed.severity || 1.0);
        setCustomContrast(parsed.contrast_multiplier || 1.0);
        setCustomSaturation(parsed.saturation_multiplier || 1.0);
        setCustomIntensity(parsed.intensity || 1.0);
        if (parsed.cvd_type) {
          setDiagnosedProfile({ type: parsed.cvd_type, severity: parsed.severity || 1.0, probability: 1.0, alpha: 1.0 });
        }
      } catch (err) {
        console.error("Error parsing cached profile", err);
      }
    }
    
    profileService.getProfile().then(data => {
      if (data) {
        setCustomSeverity(data.severity || 1.0);
        setCustomContrast(data.contrast_multiplier || 1.0);
        setCustomSaturation(data.saturation_multiplier || 1.0);
        setCustomIntensity(data.intensity || 1.0);
        
        const payload = {
          cvd_type: data.cvd_type,
          severity: data.severity,
          contrast_multiplier: data.contrast_multiplier,
          saturation_multiplier: data.saturation_multiplier,
          intensity: data.intensity
        };
        localStorage.setItem('chromashift_cvd_profile', JSON.stringify(payload));
        
        if (data.cvd_type) {
          setDiagnosedProfile({ type: data.cvd_type, severity: data.severity || 1.0, probability: 1.0, alpha: 1.0 });
        }
      }
    }).catch(e => console.error("Could not load baseline profile", e));
  }, []);

  const triggerNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Pack circles inside a container dynamically
  const packCircles = (width: number, height: number, symbol: string): Circle[] => {
    const packedCircles: Circle[] = [];
    const cx = width / 2;
    const cy = height / 2;
    const outerR = Math.min(width, height) * 0.45; // bounds limit
    
    const minR = 4;
    const maxR = 9;
    const maxCircles = 350;
    const maxAttempts = 120;
    
    const checkSymbol = (x: number, y: number): boolean => {
      const nx = (x - cx) / outerR;
      const ny = (y - cy) / outerR;
      
      if (symbol === 'E') {
        if (nx < -0.65 || nx > 0.65 || ny < -0.7 || ny > 0.7) return false;
        if (nx >= -0.65 && nx <= -0.25) return true; // spine
        if (ny >= -0.7 && ny <= -0.42 && nx <= 0.65) return true; // top
        if (ny >= -0.14 && ny <= 0.14 && nx <= 0.45) return true; // middle
        if (ny >= 0.42 && ny <= 0.7 && nx <= 0.65) return true; // bottom
        return false;
      } else if (symbol === 'C') {
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist < 0.38 || dist > 0.75) return false;
        const angle = Math.atan2(ny, nx);
        if (angle > -0.65 && angle < 0.65) return false; // right side gap
        return true;
      } else if (symbol === 'O') {
        const dist = Math.sqrt(nx * nx + ny * ny);
        return dist >= 0.38 && dist <= 0.75;
      } else if (symbol === 'X') {
        if (Math.abs(nx) > 0.7 || Math.abs(ny) > 0.7) return false;
        const thickness = 0.22;
        return Math.abs(nx - ny) < thickness || Math.abs(nx + ny) < thickness;
      }
      return false;
    };

    for (let i = 0; i < maxCircles; i++) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const r = minR + Math.pow(Math.random(), 2.2) * (maxR - minR);
        const angle = Math.random() * Math.PI * 2;
        const distFromCenter = Math.random() * (outerR - r - 2);
        
        const x = cx + Math.cos(angle) * distFromCenter;
        const y = cy + Math.sin(angle) * distFromCenter;
        
        let collision = false;
        for (const c of packedCircles) {
          const dx = x - c.x;
          const dy = y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r + c.r + 2.0) {
            collision = true;
            break;
          }
        }
        
        if (!collision) {
          packedCircles.push({
            x,
            y,
            r,
            isSymbol: checkSymbol(x, y)
          });
          break;
        }
      }
    }
    return packedCircles;
  };

  // 2. Mathematically Draw the Plate on Canvas
  const drawPlate = (
    canvas: HTMLCanvasElement,
    circlesList: Circle[],
    hType: string,
    hSeverity: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const rOuter = Math.min(canvas.width, canvas.height) * 0.47;
    
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a'; // Deep slate background
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    let M_daltonize: number[][] | null = null;
    
    if (!hType.startsWith('triage_')) {
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
      
      if (hType === 'protanopia') {
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
      } else if (hType === 'tritanopia') {
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
      
      M_daltonize = Array(3).fill(0).map(() => Array(3).fill(0));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          M_daltonize[i][j] = identity3x3[i][j] + hSeverity * M_err_remap[i][j];
        }
      }
    }

    circlesList.forEach(c => {
      let baseR = 0;
      let baseG = 0;
      let baseB = 0;
      
      const noise = (Math.random() - 0.5) * 32; // Organic color noise
      
      if (hType.startsWith('triage_')) {
        if (hType === 'triage_protan_A') {
          baseR = c.isSymbol ? 200 : 20; baseG = c.isSymbol ? 0 : 20; baseB = c.isSymbol ? 0 : 20;
        } else if (hType === 'triage_protan_B') {
          baseR = c.isSymbol ? 255 : 20; baseG = c.isSymbol ? 255 : 20; baseB = c.isSymbol ? 255 : 20;
        } else if (hType === 'triage_deutan_A') {
          baseR = c.isSymbol ? 180 : 50; baseG = c.isSymbol ? 40 : 150; baseB = c.isSymbol ? 40 : 50;
        } else if (hType === 'triage_deutan_B') {
          baseR = c.isSymbol ? 255 : 50; baseG = c.isSymbol ? 255 : 150; baseB = c.isSymbol ? 255 : 50;
        } else if (hType === 'triage_tritan_A') {
          baseR = c.isSymbol ? 100 : 150; baseG = c.isSymbol ? 200 : 150; baseB = c.isSymbol ? 255 : 150;
        } else if (hType === 'triage_tritan_B') {
          baseR = c.isSymbol ? 255 : 150; baseG = c.isSymbol ? 255 : 150; baseB = c.isSymbol ? 255 : 150;
        }
        
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
        ctx.fill();
        return;
      }

      if (hType === 'tritanopia') {
        if (c.isSymbol) {
          baseR = 195 + noise; baseG = 205 + noise; baseB = 35 + noise;
        } else {
          baseR = 45 + noise; baseG = 115 + noise; baseB = 175 + noise;
        }
      } else {
        if (c.isSymbol) {
          baseR = 210 + noise; baseG = 75 + noise; baseB = 50 + noise;
        } else {
          baseR = 95 + noise; baseG = 140 + noise; baseB = 70 + noise;
        }
      }
      
      let finalR = baseR;
      let finalG = baseG;
      let finalB = baseB;
      
      if (M_daltonize) {
        const rNorm = baseR / 255.0;
        const gNorm = baseG / 255.0;
        const bNorm = baseB / 255.0;
        
        const rLinear = rNorm <= 0.04045 ? rNorm / 12.92 : Math.pow((rNorm + 0.055) / 1.055, 2.4);
        const gLinear = gNorm <= 0.04045 ? gNorm / 12.92 : Math.pow((gNorm + 0.055) / 1.055, 2.4);
        const bLinear = bNorm <= 0.04045 ? bNorm / 12.92 : Math.pow((bNorm + 0.055) / 1.055, 2.4);
        
        const rCorr = M_daltonize[0][0] * rLinear + M_daltonize[0][1] * gLinear + M_daltonize[0][2] * bLinear;
        const gCorr = M_daltonize[1][0] * rLinear + M_daltonize[1][1] * gLinear + M_daltonize[1][2] * bLinear;
        const bCorr = M_daltonize[2][0] * rLinear + M_daltonize[2][1] * gLinear + M_daltonize[2][2] * bLinear;
        
        const rClipped = Math.max(0.0, Math.min(1.0, rCorr));
        const gClipped = Math.max(0.0, Math.min(1.0, gCorr));
        const bClipped = Math.max(0.0, Math.min(1.0, bCorr));
        
        const rSRGB = rClipped <= 0.0031308 ? rClipped * 12.92 : 1.055 * Math.pow(rClipped, 1.0 / 2.4) - 0.055;
        const gSRGB = gClipped <= 0.0031308 ? gClipped * 12.92 : 1.055 * Math.pow(gClipped, 1.0 / 2.4) - 0.055;
        const bSRGB = bClipped <= 0.0031308 ? bClipped * 12.92 : 1.055 * Math.pow(bClipped, 1.0 / 2.4) - 0.055;
        
        finalR = Math.round(Math.max(0, Math.min(255, rSRGB * 255.0)));
        finalG = Math.round(Math.max(0, Math.min(255, gSRGB * 255.0)));
        finalB = Math.round(Math.max(0, Math.min(255, bSRGB * 255.0)));
      }
      
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
      ctx.fill();
    });
  };

  const selectOptimalPair = (currHyps: Hypothesis[]): [Hypothesis, Hypothesis] => {
    const sorted = [...currHyps].sort((a, b) => b.probability - a.probability);
    const top1 = sorted[0];
    
    // Filter to same CVD type to prevent cross-type color layout diagnostic bias
    const sameTypeHyps = sorted.filter(h => h.type === top1.type);
    
    if (Math.random() < 0.7 && sameTypeHyps.length > 1) {
      return [top1, sameTypeHyps[1]];
    } else {
      const startIdx = Math.floor(sameTypeHyps.length / 2);
      const randomLower = sameTypeHyps[startIdx + Math.floor(Math.random() * (sameTypeHyps.length - startIdx))];
      return [top1, randomLower || top1];
    }
  };

  const startCalibration = () => {
    const initialHyps = hypothesesSpace.map(h => ({
      ...h,
      probability: 1 / hypothesesSpace.length,
      alpha: 1.0
    }));
    
    let maxH = 0;
    initialHyps.forEach(h => maxH -= h.probability * Math.log2(h.probability));
    
    setEntropyHistory([maxH]);
    setHypotheses(initialHyps);
    setSelections([]);
    setStep('calibration');
    startNextRound(1, initialHyps);
  };

  const startNextRound = (nextRound: number, currentHyps: Hypothesis[]) => {
    const symbols = ['E', 'C', 'O', 'X'];
    const nextSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    const packed = packCircles(250, 250, nextSymbol);
    setCircles(packed);
    
    if (nextRound === 1) {
      setCurrentPair([{ type: 'triage_protan_A', severity: 0, probability: 0, alpha: 0 }, { type: 'triage_protan_B', severity: 0, probability: 0, alpha: 0 }]);
    } else if (nextRound === 2) {
      setCurrentPair([{ type: 'triage_deutan_A', severity: 0, probability: 0, alpha: 0 }, { type: 'triage_deutan_B', severity: 0, probability: 0, alpha: 0 }]);
    } else if (nextRound === 3) {
      setCurrentPair([{ type: 'triage_tritan_A', severity: 0, probability: 0, alpha: 0 }, { type: 'triage_tritan_B', severity: 0, probability: 0, alpha: 0 }]);
    } else {
      const nextPair = selectOptimalPair(currentHyps);
      setCurrentPair(nextPair);
    }
    setRound(nextRound);
  };

  useEffect(() => {
    if (step === 'calibration' && currentPair && circles.length > 0) {
      const timer = setTimeout(() => {
        if (canvasRefA.current) {
          drawPlate(canvasRefA.current, circles, currentPair[0].type, currentPair[0].severity);
        }
        if (canvasRefB.current) {
          drawPlate(canvasRefB.current, circles, currentPair[1].type, currentPair[1].severity);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step, round, currentPair, circles]);

  useEffect(() => {
    if (step === 'results' && diagnosedProfile) {
      if (circles.length === 0) {
         setCircles(packCircles(250, 250, 'E'));
      }
      const timer = setTimeout(() => {
        if (canvasRefPreview.current && circles.length > 0) {
          drawPlate(canvasRefPreview.current, circles, diagnosedProfile.type, customSeverity);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step, diagnosedProfile, customSeverity, circles]);

  const handleSelection = (selected: 'A' | 'B' | 'both_clear' | 'neither') => {
    if (!currentPair) return;
    
    const newSelections = [...selections, selected];
    setSelections(newSelections);
    
    let updatedHyps: Hypothesis[] = [...hypotheses];
    
    if (round <= 3) {
      const boostType = round === 1 ? 'protanopia' : round === 2 ? 'deuteranopia' : 'tritanopia';
      
      updatedHyps = updatedHyps.map(h => {
        let newAlpha = h.alpha;
        if (h.type === boostType) {
          if (selected === 'B' || selected === 'neither') {
            newAlpha += 10.0; 
          } else if (selected === 'both_clear' || selected === 'A') {
            newAlpha *= 0.1;
          }
        }
        return { ...h, alpha: newAlpha };
      });
    } else {
      const getVisibility = (hTrue: Hypothesis, hTest: Hypothesis) => {
        if (hTrue.type === hTest.type) {
          return 1.0 - 0.5 * Math.abs(hTrue.severity - hTest.severity);
        }
        return 0.18;
      };

      if (selected === 'neither' || selected === 'both_clear') {
        updatedHyps = hypotheses.map(h => {
          const visA = getVisibility(h, currentPair![0]);
          const visB = getVisibility(h, currentPair![1]);
          const likelihood = selected === 'both_clear' ? (0.55 * (visA + visB)) : (1.0 - 0.55 * (visA + visB));
          return { ...h, alpha: h.alpha * likelihood };
        });
      } else {
        const beta = 3.5;
        updatedHyps = hypotheses.map(h => {
          const visA = getVisibility(h, currentPair![0]);
          const visB = getVisibility(h, currentPair![1]);
          const pA = 1.0 / (1.0 + Math.exp(-beta * (visA - visB)));
          const likelihood = selected === 'A' ? pA : 1.0 - pA;
          return { ...h, alpha: h.alpha * likelihood };
        });
      }
    }

    const sumAlphas = updatedHyps.reduce((s, h) => s + h.alpha, 0);
    updatedHyps = updatedHyps.map(h => ({ ...h, probability: h.alpha / sumAlphas }));
    
    let newEntropy = 0;
    updatedHyps.forEach(h => {
      if (h.probability > 1e-9) {
        newEntropy -= h.probability * Math.log2(h.probability);
      }
    });

    const newEntropyHistory = [...entropyHistory, newEntropy];
    setEntropyHistory(newEntropyHistory);
    setHypotheses(updatedHyps);

    const prevEntropy = entropyHistory[entropyHistory.length - 1];
    const deltaH = Math.abs(prevEntropy - newEntropy);
    const hasConverged = round >= 5 && deltaH < 0.05;
    const hitHardLimit = round >= 10;
    
    const perfectTriage = round === 3 && newSelections.length === 3 && newSelections.every(s => s === 'both_clear');

    if (hasConverged || hitHardLimit || perfectTriage) {
      const allClear = perfectTriage || newSelections.every(s => s === 'both_clear');
      if (allClear) {
        const normalProfile: Hypothesis = { type: 'normal', severity: 0.0, probability: 1.0, alpha: 1.0 };
        setDiagnosedProfile(normalProfile);
        setCustomSeverity(0.0);
        setCustomContrast(1.0);
        setCustomSaturation(1.0);
        setCustomIntensity(1.0);
      } else {
        let bestHyp = updatedHyps[0];
        for (const h of updatedHyps) {
          if (h.probability > bestHyp.probability) {
            bestHyp = h;
          }
        }
        setDiagnosedProfile(bestHyp);
        setCustomSeverity(bestHyp.severity);
      }
      setStep('results');
      
      if (hitHardLimit && !hasConverged) {
        triggerNotification('info', 'Confidence limit reached. Calibration complete.');
      } else {
        triggerNotification('success', 'Estimate complete. Personalized profile resolved.');
      }
    } else {
      startNextRound(round + 1, updatedHyps);
    }
  };

  const getMatrixCoefficients = () => {
    const type = diagnosedProfile?.type || 'deuteranopia';
    const s = customSeverity;
    const mat = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0]
    ];
    if (type === 'protanopia') {
      mat[0][0] = 1.0 - 0.5 * s; mat[0][1] = 0.5 * s;
    } else if (type === 'deuteranopia') {
      mat[1][0] = 0.5 * s; mat[1][1] = 1.0 - 0.5 * s;
    } else if (type === 'tritanopia') {
      mat[2][1] = 0.5 * s; mat[2][2] = 1.0 - 0.5 * s;
    }
    return mat;
  };

  const matrix = getMatrixCoefficients();

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const payload: VisionProfile = {
      cvd_type: diagnosedProfile?.type || 'deuteranopia',
      severity: customSeverity,
      contrast_multiplier: customContrast,
      saturation_multiplier: customSaturation,
      intensity: customIntensity
    };
    
    // Always store locally first to guarantee guest session / offline compatibility works
    localStorage.setItem('chromashift_cvd_profile', JSON.stringify(payload));
    window.dispatchEvent(new Event('chromashift_calibrated'));
    
    try {
      await profileService.updateProfile(payload);
      triggerNotification('success', 'Vision profile applied and locked.');
    } catch (e) {
      try {
        await profileService.createProfile(payload);
        triggerNotification('success', 'Profile Created & Saved');
      } catch (err) {
        // Sync failure is now non-blocking for Guest/Local operations
        triggerNotification('info', 'Profile saved locally (Offline mode).');
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (step === 'welcome' || step === 'calibration') {
      hasAutoSaved.current = false;
    }
    if (step === 'results' && diagnosedProfile && !hasAutoSaved.current) {
      hasAutoSaved.current = true;
      const autoSave = async () => {
        setIsSaving(true);
        const payload: VisionProfile = {
          cvd_type: diagnosedProfile.type || 'deuteranopia',
          severity: customSeverity,
          contrast_multiplier: customContrast,
          saturation_multiplier: customSaturation,
          intensity: customIntensity
        };
        localStorage.setItem('chromashift_cvd_profile', JSON.stringify(payload));
        try {
          await profileService.updateProfile(payload);
          triggerNotification('success', 'Calibration completed and auto-saved!');
        } catch (e) {
          try {
            await profileService.createProfile(payload);
            triggerNotification('success', 'Calibration completed and auto-saved!');
          } catch (err) {
            triggerNotification('info', 'Calibration auto-saved locally.');
          }
        } finally {
          setIsSaving(false);
        }
      };
      autoSave();
    }
  }, [step, diagnosedProfile, customSeverity, customContrast, customSaturation, customIntensity]);

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

      <div 
        className="card-solid animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '960px',
          margin: '0 auto',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-primary)',
          position: 'relative'
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: '3px', background: 'var(--primary-gradient)' }} />

      <div style={{ padding: '32px' }} className="vstack gap-6">

        {/* ================= STAGE 1: WELCOME INTRO ================= */}
        {step === 'welcome' && (
          <div className="vstack gap-8" style={{ alignItems: 'center', padding: '24px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: 'var(--shadow-md)'
            }}>
              <FiSliders size={28} />
            </div>

            <div className="vstack gap-2" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 className="text-gradient">Calibrate Vision</h2>
              <p style={{ maxWidth: '600px', fontSize: '0.95rem' }}>
                A quick, interactive test that adapts to how you see color, creating a custom filter tailored perfectly to your eyes.
              </p>
            </div>

            <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

            {/* Explanation grid */}
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', width: '100%' }}>
              <div className="card-solid vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)', alignItems: 'center', textAlign: 'center' }}>
                <span className="badge badge-primary" style={{ padding: '8px' }}>
                  Step 1
                </span>
                <strong>Compare Color Patterns</strong>
                <p style={{ fontSize: '0.85rem' }}>
                  Look at two patterns side-by-side and choose the one that looks clearest or most natural.
                </p>
              </div>

              <div className="card-solid vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)', alignItems: 'center', textAlign: 'center' }}>
                <span className="badge badge-primary" style={{ padding: '8px', color: 'var(--primary-violet)', backgroundColor: 'rgba(124, 58, 237, 0.1)' }}>
                  Step 2
                </span>
                <strong>Smart Adaptation</strong>
                <p style={{ fontSize: '0.85rem' }}>
                  The test adapts after each choice, saving your time and finding your profile in just 5 rounds.
                </p>
              </div>

              <div className="card-solid vstack gap-3" style={{ backgroundColor: 'var(--bg-secondary)', alignItems: 'center', textAlign: 'center' }}>
                <span className="badge badge-primary" style={{ padding: '8px', color: 'var(--color-success)', backgroundColor: 'rgba(13, 148, 136, 0.1)' }}>
                  Step 3
                </span>
                <strong>Enjoy Clearer Colors</strong>
                <p style={{ fontSize: '0.85rem' }}>
                  Use your customized filters to automatically correct images and videos on the platform.
                </p>
              </div>
            </div>

            {diagnosedProfile && (
              <div className="badge badge-primary" style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-md)', textTransform: 'none', textAlign: 'left', display: 'block' }}>
                <div className="vstack gap-1" style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Vision Profile</span>
                  <strong style={{ fontSize: '1.1rem', textTransform: 'capitalize', color: 'var(--primary)' }}>
                    {diagnosedProfile.type.replace('_', ' ')}
                  </strong>
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Severity strength: <strong>{(customSeverity * 100).toFixed(0)}%</strong> | Contrast: <strong>{(customContrast * 100).toFixed(0)}%</strong>
                  </span>
                </div>
              </div>
            )}

            <button 
              onClick={startCalibration}
              className="btn btn-lg btn-primary"
              style={{ marginTop: '16px', padding: '14px 40px' }}
            >
              <FiPlay size={16} />
              <span>{diagnosedProfile ? 'Recalibrate Vision Profile' : 'Start Diagnostic Calibration'}</span>
            </button>
          </div>
        )}

        {/* ================= STAGE 2: ACTIVE COMPARISON GAME ================= */}
        {step === 'calibration' && currentPair && (
          <div className="vstack gap-6" style={{ width: '100%', alignItems: 'stretch' }}>
            
            {/* Round Tracker header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div className="vstack gap-1" style={{ alignItems: 'flex-start' }}>
                <div className="hstack gap-2">
                  <span className={`badge ${round <= 3 ? 'badge-primary' : 'badge-success'}`} style={{ padding: '4px 8px' }}>
                    {round <= 3 ? 'Triage Phase' : 'Active Optimization'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {round <= 3 ? 'CVD Group Testing' : 'Bayesian Anomaloscope'}
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)' }}>Select clearer symbol</h3>
              </div>

              {/* Confidence progress */}
              <div className="vstack gap-1" style={{ width: '220px', alignItems: 'stretch' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Diagnostic confidence</span>
                  <strong>{entropyHistory.length > 0 ? Math.round((1 - (entropyHistory[entropyHistory.length - 1] / Math.log2(hypothesesSpace.length))) * 100) : 0}%</strong>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${entropyHistory.length > 0 ? Math.max(0, Math.min(100, (1 - (entropyHistory[entropyHistory.length - 1] / Math.log2(hypothesesSpace.length))) * 100)) : 0}%`,
                    height: '100%',
                    background: 'var(--primary-gradient)',
                    transition: 'width 0.4s ease-out'
                  }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>Round {round} of 10</span>
              </div>
            </div>

            <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

            {/* Canvas Cards Pair */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: windowWidth <= 480 ? 'var(--space-2)' : 'var(--space-6)' }}>
              
              {/* Option A */}
              <div className="card-solid vstack gap-4" style={{ alignItems: 'center', padding: windowWidth <= 480 ? '8px' : '24px' }}>
                <span className="badge badge-primary" style={{ alignSelf: 'flex-start', padding: '4px 8px', fontSize: windowWidth <= 480 ? '0.65rem' : '0.75rem' }}>Option A</span>
                
                <div style={{
                  padding: windowWidth <= 480 ? '4px' : '8px',
                  backgroundColor: '#0f172a',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #1e293b',
                  boxShadow: 'var(--shadow-inner)'
                }}>
                  <canvas ref={canvasRefA} width={250} height={250} style={{ display: 'block', width: '100%', maxWidth: '220px', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)' }} />
                </div>

                <button onClick={() => handleSelection('A')} className="btn btn-outline" style={{ width: '100%', padding: windowWidth <= 480 ? '8px' : '12px', fontSize: windowWidth <= 480 ? '0.75rem' : '0.9rem' }}>
                  Select A
                </button>
              </div>

              {/* Option B */}
              <div className="card-solid vstack gap-4" style={{ alignItems: 'center', padding: windowWidth <= 480 ? '8px' : '24px' }}>
                <span className="badge badge-primary" style={{ alignSelf: 'flex-start', color: 'var(--primary-violet)', backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: '4px 8px', fontSize: windowWidth <= 480 ? '0.65rem' : '0.75rem' }}>Option B</span>
                
                <div style={{
                  padding: windowWidth <= 480 ? '4px' : '8px',
                  backgroundColor: '#0f172a',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #1e293b',
                  boxShadow: 'var(--shadow-inner)'
                }}>
                  <canvas ref={canvasRefB} width={250} height={250} style={{ display: 'block', width: '100%', maxWidth: '220px', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)' }} />
                </div>

                <button onClick={() => handleSelection('B')} className="btn btn-outline" style={{ width: '100%', padding: windowWidth <= 480 ? '8px' : '12px', fontSize: windowWidth <= 480 ? '0.75rem' : '0.9rem' }}>
                  Select B
                </button>
              </div>

            </div>

            {/* Auxiliary actions */}
            <div className="vstack gap-4" style={{ alignItems: 'center', marginTop: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '480px' }}>
                <button onClick={() => handleSelection('both_clear')} className="btn btn-sm btn-outline">
                  <CheckIcon />
                  <span>Both look clear</span>
                </button>
                <button onClick={() => handleSelection('neither')} className="btn btn-sm btn-outline">
                  <CrossIcon />
                  <span>Both look unclear</span>
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click Option A or B directly. Choose "Both clear" or "Both unclear" if colors appear identical.
              </p>
            </div>

          </div>
        )}

        {/* ================= STAGE 3: CONVERGED DIAGNOSTIC RESULTS ================= */}
        {step === 'results' && diagnosedProfile && (
          <div className="vstack gap-6" style={{ width: '100%', alignItems: 'stretch' }}>
            
            <div className="hstack gap-3">
              <FiCheckCircle size={32} style={{ color: 'var(--color-success)' }} />
              <div className="vstack" style={{ alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Calibration Complete</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated active remapping variables.</span>
              </div>
            </div>

            <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

            {/* Results layout */}
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', width: '100%' }}>
              
              {/* Left Column: settings sliders */}
              <div className="vstack gap-4" style={{ alignItems: 'stretch' }}>
                <div className="card-solid vstack gap-2" style={{ padding: '20px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deficiency Classification</span>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '1.25rem', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {diagnosedProfile.type === 'normal' ? 'Standard Vision' : diagnosedProfile.type.replace('_', ' ')}
                    </strong>
                    <span className="badge badge-success" style={{ padding: '4px 12px' }}>
                      {diagnosedProfile.type === 'normal' ? 'Normal' : diagnosedProfile.type.replace('opia', '')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {diagnosedProfile.type === 'normal' && 'No color vision deficiency detected.'}
                    {diagnosedProfile.type === 'protanopia' && 'Estimating reduced sensitivity to red pigments.'}
                    {diagnosedProfile.type === 'deuteranopia' && 'Estimating reduced sensitivity to green pigments.'}
                    {diagnosedProfile.type === 'tritanopia' && 'Estimating reduced sensitivity to blue pigments.'}
                  </p>
                </div>

                <div className="card-solid vstack gap-5" style={{ padding: '20px' }}>
                  <div className="hstack gap-2">
                    <strong style={{ fontSize: '0.85rem' }}>Fine-tune Daltonization Coefficients</strong>
                  </div>

                  <div className="form-group">
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <label className="label">Photo Severity</label>
                      <strong style={{ color: 'var(--primary)' }}>{customSeverity.toFixed(2)}</strong>
                    </div>
                    <div className="slider-container">
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={customSeverity}
                        onChange={e => setCustomSeverity(parseFloat(e.target.value))}
                        className="slider"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <label className="label">Text Clarity multiplier</label>
                      <strong style={{ color: 'var(--primary)' }}>{Math.round(customIntensity * 100)}%</strong>
                    </div>
                    <div className="slider-container">
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={customIntensity}
                        onChange={e => setCustomIntensity(parseFloat(e.target.value))}
                        className="slider"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                      <div className="hstack" style={{ justifyContent: 'space-between' }}>
                        <label className="label">Contrast</label>
                        <span style={{ fontSize: '0.75rem' }}>{Math.round(customContrast * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={customContrast}
                        onChange={e => setCustomContrast(parseFloat(e.target.value))}
                        className="slider"
                      />
                    </div>

                    <div className="form-group">
                      <div className="hstack" style={{ justifyContent: 'space-between' }}>
                        <label className="label">Saturation</label>
                        <span style={{ fontSize: '0.75rem' }}>{Math.round(customSaturation * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={customSaturation}
                        onChange={e => setCustomSaturation(parseFloat(e.target.value))}
                        className="slider"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: preview & matrix values */}
              <div className="vstack gap-4" style={{ alignItems: 'stretch' }}>
                <div className="card-solid vstack gap-4" style={{ padding: '20px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
                    Live Color Separation Preview
                  </span>

                  <div style={{
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #1e293b'
                  }}>
                    <canvas 
                      ref={canvasRefPreview} 
                      width={250} 
                      height={250} 
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '180px',
                        aspectRatio: '1/1',
                        borderRadius: 'var(--radius-sm)',
                        filter: `contrast(${customContrast}) saturate(${customSaturation}) brightness(${customIntensity})`
                      }} 
                    />
                  </div>
                </div>

                <details className="card-solid" style={{ padding: '16px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', outline: 'none' }}>
                    View Engineering Specs & Matrix
                  </summary>
                  <div style={{ marginTop: '16px', cursor: 'default' }} className="vstack gap-3" onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Personalized 3x3 Transform Matrix
                    </span>

                    <div style={{
                      backgroundColor: '#0f172a',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      color: '#10b981',
                      textAlign: 'center',
                      border: '1px solid #1e293b'
                    }} className="vstack gap-2">
                      <div>[{matrix[0][0].toFixed(2)}] [{matrix[0][1].toFixed(2)}] [{matrix[0][2].toFixed(2)}]</div>
                      <div>[{matrix[1][0].toFixed(2)}] [{matrix[1][1].toFixed(2)}] [{matrix[1][2].toFixed(2)}]</div>
                      <div>[{matrix[2][0].toFixed(2)}] [{matrix[2][1].toFixed(2)}] [{matrix[2][2].toFixed(2)}]</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>Profile config schema</span>
                      <button 
                        onClick={() => {
                          const payload = JSON.stringify({
                            cvd_type: diagnosedProfile.type,
                            severity: parseFloat(customSeverity.toFixed(3)),
                            contrast_multiplier: parseFloat(customContrast.toFixed(2)),
                            saturation_multiplier: parseFloat(customSaturation.toFixed(2)),
                            intensity: parseFloat(customIntensity.toFixed(2))
                          }, null, 2);
                          navigator.clipboard?.writeText(payload);
                          triggerNotification('success', 'Config copied to clipboard!');
                        }}
                        className="btn-ghost"
                        style={{ fontWeight: 'bold', color: 'var(--primary)' }}
                      >
                        Copy JSON
                      </button>
                    </div>
                  </div>
                </details>
              </div>

            </div>

            <span style={{ height: '1px', backgroundColor: 'var(--border-primary)', width: '100%' }} />

            {/* Action buttons */}
            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack gap-3"} 
              style={{ 
                justifyContent: 'flex-end', 
                alignItems: 'stretch',
                width: '100%',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                onClick={() => setStep('welcome')} 
                className="btn btn-outline"
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Recalibrate
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ 
                  padding: '10px 24px',
                  width: windowWidth <= 480 ? '100%' : 'auto' 
                }}
              >
                {isSaving ? 'Saving...' : 'Save & Apply Vision Profile'}
              </button>
            </div>

          </div>
        )}

        {/* Account Delete Danger area */}
        <div className="card-solid vstack gap-3" style={{ border: '1px solid rgba(185, 28, 28, 0.25)', backgroundColor: 'rgba(185, 28, 28, 0.02)', marginTop: '24px', padding: '20px' }}>
          <h4 style={{ color: 'var(--color-error)', fontFamily: 'var(--font-heading)', margin: 0 }}>Danger Zone</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Wipe all visual calibration datasets, stored media, and telemetry reports. Account deletion is permanent.
          </p>
          <button 
            onClick={async () => {
              if (window.confirm("ARE YOU SURE? This will permanently delete your account, calibration files, and stored media. This cannot be undone.")) {
                try {
                  const { default: api } = await import('../services/api');
                  await api.delete('/auth/me');
                  triggerNotification('success', 'Account wiped.');
                  localStorage.clear();
                  setTimeout(() => { window.location.href = '/'; }, 1000);
                } catch (e) {
                  triggerNotification('error', 'Deletion failed.');
                }
              }
            }}
            className="btn btn-sm btn-primary" 
            style={{ backgroundColor: 'var(--color-error)', alignSelf: 'flex-start', display: 'flex', gap: '6px', alignItems: 'center' }}
          >
            <FiTrash2 size={12} />
            <span>Delete Account</span>
          </button>
        </div>

      </div>
    </div>
    </>
  );
};
