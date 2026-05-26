import { useState, useEffect, useRef, type FC } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Divider,
  useToast,
  Heading,
  Card,
  CardBody,
  Progress,
  Grid,
  GridItem,
  Code,
  Badge,
  SimpleGrid
} from '@chakra-ui/react';
import { profileService, type VisionProfile } from '../services/profile';

// SVG Icons for clean, zero-dependency rendering

const CheckIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-green-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-yellow-500 animate-pulse">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const SuccessIcon = () => (
  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-green-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalibrationIcon = () => (
  <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-blue-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Mathematical Hypothesis Space definitions
const CVD_TYPES = ['protanopia', 'deuteranopia', 'tritanopia'];
const SEVERITY_LEVELS = [0.2, 0.5, 0.8, 1.1, 1.4];

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
    hypothesesSpace.push({ type, severity });
  }
}

export const CalibrationWizard: FC = () => {
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
  
  const canvasRefA = useRef<HTMLCanvasElement>(null);
  const canvasRefB = useRef<HTMLCanvasElement>(null);
  const canvasRefPreview = useRef<HTMLCanvasElement>(null);
  const toast = useToast();

  // Load existing profile on mount (for baseline defaults)
  useEffect(() => {
    // Try local storage first for quick restore
    const cachedProfile = localStorage.getItem('chromashift_cvd_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setCustomSeverity(parsed.severity || 1.0);
        setCustomContrast(parsed.contrast_multiplier || 1.0);
        setCustomSaturation(parsed.saturation_multiplier || 1.0);
        setCustomIntensity(parsed.intensity || 1.0);
        if (parsed.cvd_type) {
          setDiagnosedProfile({ type: parsed.cvd_type, severity: parsed.severity || 1.0, probability: 1.0 });
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
          setDiagnosedProfile({ type: data.cvd_type, severity: data.severity || 1.0, probability: 1.0 });
        }
      }
    }).catch(e => console.error("Could not load baseline profile", e));
  }, []);

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
    
    // Check if point x,y lies inside our vector letters E, C, O, X
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
        // Biased random distribution for tight visual packing
        const r = minR + Math.pow(Math.random(), 2.2) * (maxR - minR);
        const angle = Math.random() * Math.PI * 2;
        const distFromCenter = Math.random() * (outerR - r - 2);
        
        const x = cx + Math.cos(angle) * distFromCenter;
        const y = cy + Math.sin(angle) * distFromCenter;
        
        // Overlap query
        let collision = false;
        for (const c of packedCircles) {
          const dx = x - c.x;
          const dy = y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r + c.r + 2.0) { // 2px safe spacing
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
    
    // Draw Outer Container Shield
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a'; // Deep futuristic slate background
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    circlesList.forEach(c => {
      let baseR = 0;
      let baseG = 0;
      let baseB = 0;
      
      const noise = (Math.random() - 0.5) * 32; // Organic color noise
      
      if (hType === 'tritanopia') {
        // Tritan (Blue-Yellow confusion)
        if (c.isSymbol) {
          baseR = 195 + noise;
          baseG = 205 + noise;
          baseB = 35 + noise;
        } else {
          baseR = 45 + noise;
          baseG = 115 + noise;
          baseB = 175 + noise;
        }
      } else {
        // Protan/Deutan (Red-Green confusion)
        if (c.isSymbol) {
          baseR = 210 + noise;
          baseG = 75 + noise;
          baseB = 50 + noise;
        } else {
          baseR = 95 + noise;
          baseG = 140 + noise;
          baseB = 70 + noise;
        }
      }
      
      // Daltonization correction formula matching real-time TF.js preview
      let cr = baseR;
      let cg = baseG;
      let cb = baseB;
      
      if (hType === 'protanopia') {
        cr = baseR * (1.0 - 0.5 * hSeverity) + baseG * (0.5 * hSeverity);
      } else if (hType === 'deuteranopia') {
        cg = baseG * (1.0 - 0.5 * hSeverity) + baseR * (0.5 * hSeverity);
      } else if (hType === 'tritanopia') {
        cb = baseB * (1.0 - 0.5 * hSeverity) + baseG * (0.5 * hSeverity);
      }
      
      const finalR = Math.round(Math.max(0, Math.min(255, cr)));
      const finalG = Math.round(Math.max(0, Math.min(255, cg)));
      const finalB = Math.round(Math.max(0, Math.min(255, cb)));
      
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
      ctx.fill();
    });
  };

  const selectOptimalPair = (currHyps: Hypothesis[]): [Hypothesis, Hypothesis] => {
    // Sort by probability descending
    const sorted = [...currHyps].sort((a, b) => b.probability - a.probability);
    const top1 = sorted[0];
    
    // 70% top 1 vs top 2. 30% top 1 vs random lower half.
    if (Math.random() < 0.7) {
      return [top1, sorted[1]];
    } else {
      const startIdx = Math.floor(sorted.length / 2);
      const randomLower = sorted[startIdx + Math.floor(Math.random() * (sorted.length - startIdx))];
      return [top1, randomLower];
    }
  };

  // 4. Start Calibration Process
  const startCalibration = () => {
    const initialHyps = hypothesesSpace.map(h => ({
      ...h,
      probability: 1 / hypothesesSpace.length,
      alpha: 1.0 // Initial Dirichlet prior
    }));
    
    let maxH = 0;
    initialHyps.forEach(h => maxH -= h.probability * Math.log2(h.probability));
    
    setEntropyHistory([maxH]);
    setHypotheses(initialHyps);
    setSelections([]); // Reset trackers
    setStep('calibration');
    startNextRound(1, initialHyps);
  };

  // 5. Trigger transition to next round
  const startNextRound = (nextRound: number, currentHyps: Hypothesis[]) => {
    const symbols = ['E', 'C', 'O', 'X'];
    const nextSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    const packed = packCircles(250, 250, nextSymbol);
    setCircles(packed);
    
    const nextPair = selectOptimalPair(currentHyps);
    setCurrentPair(nextPair);
    setRound(nextRound);
  };

  // Render trigger on round state shifts
  useEffect(() => {
    if (step === 'calibration' && currentPair && circles.length > 0) {
      // Small timeout to allow canvas elements to paint in the DOM
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

  // Render trigger for Live Preview in Results
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

  // 6. Handle User Comparative Choice Update
  const handleSelection = (selected: 'A' | 'B' | 'both_clear' | 'neither') => {
    if (!currentPair) return;
    
    const newSelections = [...selections, selected];
    setSelections(newSelections);
    
    let updatedHyps: Hypothesis[];
    
    const getVisibility = (hTrue: Hypothesis, hTest: Hypothesis) => {
      if (hTrue.type === hTest.type) {
        return 1.0 - 0.5 * Math.abs(hTrue.severity - hTest.severity);
      }
      return 0.18;
    };

    if (selected === 'neither' || selected === 'both_clear') {
      updatedHyps = hypotheses.map(h => {
        const visA = getVisibility(h, currentPair[0]);
        const visB = getVisibility(h, currentPair[1]);
        const likelihood = selected === 'both_clear' ? (0.55 * (visA + visB)) : (1.0 - 0.55 * (visA + visB));
        return {
          ...h,
          alpha: h.alpha + likelihood
        };
      });
    } else {
      const beta = 3.5;
      updatedHyps = hypotheses.map(h => {
        const visA = getVisibility(h, currentPair[0]);
        const visB = getVisibility(h, currentPair[1]);
        const pA = 1.0 / (1.0 + Math.exp(-beta * (visA - visB)));
        const likelihood = selected === 'A' ? pA : 1.0 - pA;
        return {
          ...h,
          alpha: h.alpha + likelihood
        };
      });
    }

    // Recalculate probabilities based on new alphas
    const sumAlphas = updatedHyps.reduce((s, h) => s + h.alpha, 0);
    updatedHyps = updatedHyps.map(h => ({ ...h, probability: h.alpha / sumAlphas }));
    
    // Calculate new entropy
    let newEntropy = 0;
    updatedHyps.forEach(h => {
      if (h.probability > 1e-9) {
        newEntropy -= h.probability * Math.log2(h.probability);
      }
    });

    const newEntropyHistory = [...entropyHistory, newEntropy];
    setEntropyHistory(newEntropyHistory);
    setHypotheses(updatedHyps);

    // Early Stopping Check
    const prevEntropy = entropyHistory[entropyHistory.length - 1];
    const deltaH = Math.abs(prevEntropy - newEntropy);
    const hasConverged = round >= 5 && deltaH < 0.05;
    const hitHardLimit = round >= 10;

    if (hasConverged || hitHardLimit) {
      const allClear = newSelections.length === 5 && newSelections.every(s => s === 'both_clear');
      if (allClear && !hitHardLimit) {
        const normalProfile: Hypothesis = {
          type: 'normal',
          severity: 0.0,
          probability: 1.0,
          alpha: 1.0
        };
        setDiagnosedProfile(normalProfile);
        setCustomSeverity(0.0);
        setCustomContrast(1.0);
        setCustomSaturation(1.0);
        setCustomIntensity(1.0);
      } else {
        // Find the argmax hypothesis
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
        toast({
          title: "Confidence Limit Reached",
          description: "Reached maximum rounds—profile may need manual refinement.",
          status: "warning",
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: "Calibration Complete",
          description: "Successfully estimated your personalized color sensitivity profile.",
          status: "success",
          duration: 4000,
          isClosable: true
        });
      }
    } else {
      startNextRound(round + 1, updatedHyps);
    }
  };

  // 7. Dynamic 3x3 Remap Coefficient Solver
  const getMatrixCoefficients = () => {
    const type = diagnosedProfile?.type || 'deuteranopia';
    const s = customSeverity;
    
    // Matrix structure: rows of [R, G, B] remapping
    const mat = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0]
    ];
    
    if (type === 'protanopia') {
      mat[0][0] = 1.0 - 0.5 * s;
      mat[0][1] = 0.5 * s;
    } else if (type === 'deuteranopia') {
      mat[1][0] = 0.5 * s;
      mat[1][1] = 1.0 - 0.5 * s;
    } else if (type === 'tritanopia') {
      mat[2][1] = 0.5 * s;
      mat[2][2] = 1.0 - 0.5 * s;
    }
    
    return mat;
  };

  const matrix = getMatrixCoefficients();

  // 8. Push Diagnostic Results direct to DB
  const handleSaveProfile = async () => {
    setIsSaving(true);
    const payload: VisionProfile = {
      cvd_type: diagnosedProfile?.type || 'deuteranopia',
      severity: customSeverity,
      contrast_multiplier: customContrast,
      saturation_multiplier: customSaturation,
      intensity: customIntensity
    };
    
    try {
      await profileService.updateProfile(payload);
      localStorage.setItem('chromashift_cvd_profile', JSON.stringify(payload));
      toast({
        title: "Matrix Remapping Applied",
        description: "Your personalized active calibration coefficients are locked and synced.",
        status: "success",
        duration: 4000,
        isClosable: true
      });
    } catch (e) {
      // Create if it doesn't exist
      try {
        await profileService.createProfile(payload);
        localStorage.setItem('chromashift_cvd_profile', JSON.stringify(payload));
        toast({
          title: "Profile Created & Saved",
          status: "success",
          duration: 3000
        });
      } catch (err) {
        toast({
          title: "Synchronization Failed",
          description: "Could not save profile settings to the database.",
          status: "error"
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="w-full max-w-5xl mx-auto mt-6 p-1 bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-700 rounded-3xl shadow-2xl">
      <Box className="w-full h-full p-8 bg-white/95 backdrop-blur-xl rounded-[22px] border border-white/50">
        
        {/* ================= STAGE 1: WELCOME INTRO ================= */}
        {step === 'welcome' && (
          <VStack spacing={8} py={8} align="center">
            <CalibrationIcon />
            <VStack spacing={2} textAlign="center">
              <Heading fontSize="3xl" fontWeight="black" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text">
                Personalized Vision Calibration
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                An easy, interactive 5-round game that maps your color sensitivity to create a personalized color correction filter tailored just for you.
              </Text>
            </VStack>

            <Divider />

            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6} w="full" maxW="4xl">
              <GridItem>
                <Card variant="outline" borderRadius="xl" h="full" bg="gray.50/50">
                  <CardBody className="flex flex-col items-center text-center p-6 space-y-3">
                    <Box className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </Box>
                    <Text fontWeight="bold" color="gray.800">5-Round Anomaloscope</Text>
                    <Text fontSize="sm" color="gray.500">
                      Plays a short interactive game comparing two custom generated plates to pinpoint your exact visual deficiency.
                    </Text>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <Card variant="outline" borderRadius="xl" h="full" bg="gray.50/50">
                  <CardBody className="flex flex-col items-center text-center p-6 space-y-3">
                    <Box className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </Box>
                    <Text fontWeight="bold" color="gray.800">Active Learning</Text>
                    <Text fontSize="sm" color="gray.500">
                      Uses entropy minimization and Bayes theorem to dynamically choose queries that extract the most information.
                    </Text>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <Card variant="outline" borderRadius="xl" h="full" bg="gray.50/50">
                  <CardBody className="flex flex-col items-center text-center p-6 space-y-3">
                    <Box className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                    </Box>
                    <Text fontWeight="bold" color="gray.800">Custom 3x3 Matrices</Text>
                    <Text fontSize="sm" color="gray.500">
                      Calculates an individualized correction matrix to instantly Daltonize your real-time camera and media uploads.
                    </Text>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>

            <Button
              size="lg"
              px={10}
              py={7}
              fontSize="md"
              fontWeight="black"
              colorScheme="blue"
              bgGradient="linear(to-r, blue.500, indigo-600)"
              _hover={{ bgGradient: "linear(to-r, blue.600, indigo-700)" }}
              borderRadius="xl"
              onClick={startCalibration}
              shadow="lg"
            >
              Start Interactive Calibration
            </Button>
          </VStack>
        )}

        {/* ================= STAGE 2: ACTIVE COMPARISON GAME ================= */}
        {step === 'calibration' && currentPair && (
          <VStack spacing={8} align="stretch" py={2}>
            {/* Header Trackers */}
            <Box className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4">
              <VStack align="start" spacing={1}>
                <HStack>
                  <Badge colorScheme="blue" borderRadius="md" px={2} py={0.5} fontSize="xs" fontWeight="bold">
                    Active learning
                  </Badge>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.400">Bayesian Anomaloscope</Text>
                </HStack>
                <Heading fontSize="2xl" fontWeight="black" color="gray.800">
                  Select the clearer symbol
                </Heading>
              </VStack>
              <VStack align="end" spacing={1} w={{ base: "full", md: "250px" }}>
                <HStack justify="space-between" w="full" fontSize="sm" fontWeight="bold" color="gray.600">
                  <Text>Confidence</Text>
                  <Text>{entropyHistory.length > 0 ? Math.round((1 - (entropyHistory[entropyHistory.length - 1] / Math.log2(hypothesesSpace.length))) * 100) : 0}%</Text>
                </HStack>
                <Progress value={entropyHistory.length > 0 ? (1 - (entropyHistory[entropyHistory.length - 1] / Math.log2(hypothesesSpace.length))) * 100 : 0} size="sm" colorScheme="purple" borderRadius="full" w="full" />
                <Text fontSize="xs" color="gray.400">Round {round} (Max 10)</Text>
              </VStack>
            </Box>

            <Divider />

            {/* Canvas Pair Display */}
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={8} w="full">
              {/* Option A Canvas Card */}
              <GridItem>
                <Card
                  variant="outline"
                  borderRadius="2xl"
                  overflow="hidden"
                  borderWidth="2px"
                  borderColor="gray.100"
                >
                  <CardBody p={6} display="flex" flexDirection="column" gap={6} width="full" alignItems="center">
                    {/* Top Left Title/Badge */}
                    <Box alignSelf="flex-start">
                      <Badge colorScheme="blue" fontSize="md" px={3} py={1} borderRadius="full">Option A</Badge>
                    </Box>
                    
                    {/* Visual Indicator (Canvas display) */}
                    <Box 
                      className="relative p-2 bg-gray-900 rounded-3xl shadow-inner border border-gray-800"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <canvas ref={canvasRefA} width={250} height={250} className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-2xl" />
                    </Box>
                    
                    {/* Action Button: directly below the visual indicator, perfectly centered */}
                    <Button
                      w="full"
                      size="lg"
                      onClick={() => handleSelection('A')}
                      variant="solid"
                      bg="blue.50"
                      color="blue.700"
                      border="1px"
                      borderColor="blue.200"
                      _hover={{ bg: "blue.500", color: "white", transform: "translateY(-2px)", shadow: "md" }}
                      _active={{ bg: "blue.600" }}
                      transition="all 0.2s"
                    >
                      Option A is Clearer
                    </Button>
                  </CardBody>
                </Card>
              </GridItem>

              {/* Option B Canvas Card */}
              <GridItem>
                <Card
                  variant="outline"
                  borderRadius="2xl"
                  overflow="hidden"
                  borderWidth="2px"
                  borderColor="gray.100"
                >
                  <CardBody p={6} display="flex" flexDirection="column" gap={6} width="full" alignItems="center">
                    {/* Top Left Title/Badge */}
                    <Box alignSelf="flex-start">
                      <Badge colorScheme="purple" fontSize="md" px={3} py={1} borderRadius="full">Option B</Badge>
                    </Box>
                    
                    {/* Visual Indicator (Canvas display) */}
                    <Box 
                      className="relative p-2 bg-gray-900 rounded-3xl shadow-inner border border-gray-800"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <canvas ref={canvasRefB} width={250} height={250} className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-2xl" />
                    </Box>
                    
                    {/* Action Button: directly below the visual indicator, perfectly centered */}
                    <Button
                      w="full"
                      size="lg"
                      onClick={() => handleSelection('B')}
                      variant="solid"
                      bg="purple.50"
                      color="purple.700"
                      border="1px"
                      borderColor="purple.200"
                      _hover={{ bg: "purple.500", color: "white", transform: "translateY(-2px)", shadow: "md" }}
                      _active={{ bg: "purple.600" }}
                      transition="all 0.2s"
                    >
                      Option B is Clearer
                    </Button>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>

            {/* 4 Bayesian Anomaloscope Choice Options */}
            <VStack w="full" align="center" pt={4} spacing={4}>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={6} w="full" maxW="2xl">
                <Button
                  leftIcon={<CheckIcon />}
                  colorScheme="green"
                  variant="solid"
                  bg="green.50"
                  color="green.700"
                  border="1px"
                  borderColor="green.200"
                  _hover={{ bg: "green.100", transform: "translateY(-2px)", shadow: "md" }}
                  _active={{ bg: "green.200" }}
                  size="lg"
                  py={7}
                  borderRadius="2xl"
                  onClick={() => handleSelection('both_clear')}
                  fontWeight="bold"
                  transition="all 0.2s"
                >
                  Both look clear
                </Button>
                <Button
                  leftIcon={<CrossIcon />}
                  colorScheme="red"
                  variant="solid"
                  bg="red.50"
                  color="red.700"
                  border="1px"
                  borderColor="red.200"
                  _hover={{ bg: "red.100", transform: "translateY(-2px)", shadow: "md" }}
                  _active={{ bg: "red.200" }}
                  size="lg"
                  py={7}
                  borderRadius="2xl"
                  onClick={() => handleSelection('neither')}
                  fontWeight="bold"
                  transition="all 0.2s"
                >
                  Both look unclear
                </Button>
              </SimpleGrid>
              
              <Text fontSize="xs" color="gray.400" textAlign="center" maxW="lg">
                Pro-Tip: Select "Option A is Clearer" or "Option B is Clearer" by clicking on the action buttons above. Use "Both look clear" or "Both look unclear" if there's no visual difference.
              </Text>
            </VStack>
          </VStack>
        )}

        {/* ================= STAGE 3: CONVERGED DIAGNOSTIC RESULTS ================= */}
        {step === 'results' && diagnosedProfile && (
          <VStack spacing={8} align="stretch" py={2}>
            {/* Header Diagnostic Badge */}
            <HStack spacing={4} align="center">
              <Box className="p-3 bg-green-50 text-green-600 rounded-2xl">
                <SuccessIcon />
              </Box>
              <VStack align="start" spacing={1}>
                <HStack>
                  <Badge colorScheme="green" px={2} py={0.5} borderRadius="md" fontSize="xs" fontWeight="bold">
                    Calibration Complete
                  </Badge>
                </HStack>
                <Heading fontSize="3xl" fontWeight="black" color="gray.800">
                  Your Vision Diagnostic Profile
                </Heading>
              </VStack>
            </HStack>

            <Divider />

            {/* Results Two-Column Layout */}
            <Grid templateColumns={{ base: '1fr', lg: '1.2fr 0.8fr' }} gap={8} w="full">
              
              {/* Left Column: Diagnostics + Sliders */}
              <GridItem>
                <VStack spacing={6} align="stretch" h="full">
                  <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.100" bg="gray.50/30">
                    <CardBody className="space-y-4">
                      <Text fontSize="xs" color="gray.400" fontWeight="bold" letterSpacing="widest" textTransform="uppercase">
                        Detected Color Blindness / Color Sensitivity Type
                      </Text>
                      <Box className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <VStack align="start" spacing={0}>
                          <Text fontSize="2xl" fontWeight="extrabold" className="capitalize text-slate-800">
                            {diagnosedProfile.type === 'normal' ? 'Normal Color Vision' :
                             diagnosedProfile.type === 'protanopia' ? 'Red sensitivity reduced' :
                             diagnosedProfile.type === 'deuteranopia' ? 'Green sensitivity reduced' :
                             diagnosedProfile.type === 'tritanopia' ? 'Blue sensitivity reduced' :
                             diagnosedProfile.type.replace('opia', 'omaly')}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {diagnosedProfile.type === 'normal' && 'No color vision deficiency detected (Standard Vision)'}
                            {diagnosedProfile.type === 'protanopia' && 'Reduced sensitivity to Red colors (Protanopia)'}
                            {diagnosedProfile.type === 'deuteranopia' && 'Reduced sensitivity to Green colors (Deuteranopia)'}
                            {diagnosedProfile.type === 'tritanopia' && 'Reduced sensitivity to Blue colors (Tritanopia)'}
                          </Text>
                        </VStack>
                        <Badge
                          colorScheme={
                            diagnosedProfile.type === 'normal' ? 'teal' :
                            diagnosedProfile.type === 'protanopia' ? 'red' : 
                            diagnosedProfile.type === 'deuteranopia' ? 'green' : 'blue'
                          }
                          fontSize="lg"
                          px={4}
                          py={1.5}
                          borderRadius="xl"
                          className="capitalize"
                        >
                          {diagnosedProfile.type === 'normal' ? 'Standard' : diagnosedProfile.type.replace('opia', '')}
                        </Badge>
                      </Box>
                    </CardBody>
                  </Card>

                  {/* Manual adjustment sliders */}
                  <Card variant="outline" borderRadius="2xl" p={2}>
                    <CardBody className="space-y-6">
                      <HStack spacing={2} color="gray.700" fontWeight="bold" fontSize="sm">
                        <SparklesIcon />
                        <Text>Fine-tune Correction Coefficients</Text>
                      </HStack>

                      {/* Severity Slider */}
                      <Box>
                        <HStack justify="space-between" mb={2} fontSize="sm">
                          <Text fontWeight="bold" color="gray.600">Correction Strength (Severity)</Text>
                          <Text fontWeight="black" color="blue.600">{customSeverity.toFixed(2)}</Text>
                        </HStack>
                        <Slider
                          min={0.1}
                          max={1.5}
                          step={0.05}
                          value={customSeverity}
                          onChange={(v) => setCustomSeverity(v)}
                          colorScheme="blue"
                        >
                          <SliderTrack bg="gray.100" h="6px" borderRadius="full">
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={5} shadow="md" border="2px" borderColor="blue.500" />
                        </Slider>
                        <Text fontSize="xs" color="gray.400" mt={1}>
                          Determines how strongly colors are shifted to make red, green, and blue details stand out.
                        </Text>
                      </Box>

                      {/* Intensity Slider */}
                      <Box>
                        <HStack justify="space-between" mb={2} fontSize="sm">
                          <Text fontWeight="bold" color="gray.600">Overall Filter Intensity</Text>
                          <Text fontWeight="black" color="blue.600">{(customIntensity * 100).toFixed(0)}%</Text>
                        </HStack>
                        <Slider
                          min={0.5}
                          max={1.5}
                          step={0.05}
                          value={customIntensity}
                          onChange={(v) => setCustomIntensity(v)}
                          colorScheme="blue"
                        >
                          <SliderTrack bg="gray.100" h="6px" borderRadius="full">
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={5} shadow="md" border="2px" borderColor="blue.500" />
                        </Slider>
                      </Box>

                      {/* Contrast/Saturation modifiers */}
                      <Grid templateColumns="1fr 1fr" gap={4}>
                        <Box>
                          <HStack justify="space-between" mb={2} fontSize="xs">
                            <Text fontWeight="bold" color="gray.500">Contrast Boost</Text>
                            <Text fontWeight="black" color="blue.600">{(customContrast * 100).toFixed(0)}%</Text>
                          </HStack>
                          <Slider
                            min={0.5}
                            max={1.5}
                            step={0.05}
                            value={customContrast}
                            onChange={(v) => setCustomContrast(v)}
                            colorScheme="blue"
                          >
                            <SliderTrack bg="gray.100" h="4px" borderRadius="full"><SliderFilledTrack /></SliderTrack>
                            <SliderThumb boxSize={4} />
                          </Slider>
                        </Box>
                        <Box>
                          <HStack justify="space-between" mb={2} fontSize="xs">
                            <Text fontWeight="bold" color="gray.500">Saturation Boost</Text>
                            <Text fontWeight="black" color="blue.600">{(customSaturation * 100).toFixed(0)}%</Text>
                          </HStack>
                          <Slider
                            min={0.5}
                            max={1.5}
                            step={0.05}
                            value={customSaturation}
                            onChange={(v) => setCustomSaturation(v)}
                            colorScheme="blue"
                          >
                            <SliderTrack bg="gray.100" h="4px" borderRadius="full"><SliderFilledTrack /></SliderTrack>
                            <SliderThumb boxSize={4} />
                          </Slider>
                        </Box>
                      </Grid>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>

              {/* Right Column: Premium Matrix Visualizer */}
              <GridItem>
                <VStack spacing={6} align="stretch" h="full">
                  <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.100" className="flex-1">
                    <CardBody className="space-y-4 flex flex-col justify-between p-6">
                      <VStack align="stretch" spacing={3}>
                        <Text fontSize="xs" color="gray.400" fontWeight="bold" letterSpacing="widest" textTransform="uppercase">
                          Live Filter Preview
                        </Text>
                        <Box 
                          className="relative p-2 bg-gray-900 rounded-3xl shadow-inner border border-gray-800"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          overflow="hidden"
                        >
                          <canvas 
                            ref={canvasRefPreview} 
                            width={250} 
                            height={250} 
                            className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-2xl transition-all duration-75"
                            style={{
                              filter: `contrast(${customContrast}) saturate(${customSaturation}) brightness(${customIntensity})`
                            }}
                          />
                        </Box>
                        <Text fontSize="xs" color="gray.500" textAlign="center">
                          Adjust the sliders to see how they affect the color separation in real-time.
                        </Text>
                      </VStack>

                      <VStack align="stretch" spacing={3} pt={4}>
                        <Text fontSize="xs" color="gray.400" fontWeight="bold" letterSpacing="widest" textTransform="uppercase">
                          Personalized 3x3 Correction Matrix
                        </Text>
                        
                        {/* Mathematical Matrix visual block */}
                        <Box className="p-6 bg-slate-900 rounded-2xl shadow-inner border border-slate-800 text-center font-mono">
                          <VStack spacing={3} align="center" className="text-emerald-400 font-bold text-lg">
                            <HStack spacing={6}>
                              <Text className="w-16">[{matrix[0][0].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[0][1].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[0][2].toFixed(2)}]</Text>
                            </HStack>
                            <HStack spacing={6}>
                              <Text className="w-16">[{matrix[1][0].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[1][1].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[1][2].toFixed(2)}]</Text>
                            </HStack>
                            <HStack spacing={6}>
                              <Text className="w-16">[{matrix[2][0].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[2][1].toFixed(2)}]</Text>
                              <Text className="w-16">[{matrix[2][2].toFixed(2)}]</Text>
                            </HStack>
                          </VStack>
                        </Box>

                        <Text fontSize="xs" color="gray.400" textAlign="justify">
                          This calculated matrix shifts red, green, and blue pixels orthogonally in CIELAB/RGB space, resolving visual confusion with zero rendering latency in WebGL/GLSL shaders.
                        </Text>
                      </VStack>

                      {/* Code preview block */}
                      <VStack align="stretch" spacing={2} pt={4}>
                        <Text fontSize="xs" fontWeight="bold" color="gray.500">Profile Config Schema</Text>
                        <Code className="p-3 rounded-lg overflow-x-auto text-[10px] w-full" colorScheme="gray" variant="solid">
                          {JSON.stringify({
                            cvd_type: diagnosedProfile.type,
                            severity: parseFloat(customSeverity.toFixed(3)),
                            contrast_multiplier: parseFloat(customContrast.toFixed(2)),
                            saturation_multiplier: parseFloat(customSaturation.toFixed(2)),
                            intensity: parseFloat(customIntensity.toFixed(2))
                          }, null, 2)}
                        </Code>
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              </GridItem>
            </Grid>

            <Divider />

            {/* Save Buttons */}
            <HStack spacing={4} justify="end" pt={2}>
              <Button
                variant="outline"
                size="lg"
                colorScheme="blue"
                borderRadius="xl"
                onClick={() => setStep('welcome')}
              >
                Recalibrate
              </Button>
              <Button
                size="lg"
                px={8}
                colorScheme="blue"
                bgGradient="linear(to-r, blue.500, purple.500)"
                _hover={{ bgGradient: "linear(to-r, blue.600, purple.600)" }}
                borderRadius="xl"
                onClick={handleSaveProfile}
                isLoading={isSaving}
                shadow="md"
              >
                Save & Apply Profile
              </Button>
            </HStack>
          </VStack>
        )}

      </Box>
    </Box>
  );
};

