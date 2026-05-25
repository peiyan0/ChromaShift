import { useState, useRef, useEffect, type FC } from 'react';
import { 
  Box, 
  Text, 
  Button, 
  VStack, 
  HStack, 
  Heading, 
  SimpleGrid, 
  Card, 
  CardBody, 
  Icon, 
  useToast, 
  Radio, 
  RadioGroup, 
  Progress,
  Badge,
  Divider,
  Center,
  Grid,
  GridItem
} from '@chakra-ui/react';
import { FiTrendingUp, FiCheckCircle, FiPlay, FiRefreshCw, FiGrid, FiClock, FiActivity, FiVideo, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/profile';
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
  const toast = useToast();

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
        
        const valuesStr = `${mat[0][0]} ${mat[0][1]} ${mat[0][2]} 0 0  ${mat[1][0]} ${mat[1][1]} ${mat[1][2]} 0 0  ${mat[2][0]} ${mat[2][1]} ${mat[2][2]} 0 0  0 0 0 1 0`;
        setSvgMatrixValues(valuesStr);
      }
    };
    loadProfile();
  }, []);

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
    setFlowNodeColor('#c62828'); // Start Red
    startTimer();
    
    // Animate a transition after 1.5 seconds
    setTimeout(() => {
      // Phase 1 (Original): Red -> Brown (Invalid). Correct answer: Reject.
      // Phase 2 (Corrected): Red -> Green (Valid). Correct answer: Accept.
      const isOriginal = testPhase === 'test_original';
      setFlowNodeColor(isOriginal ? '#8d6e63' : '#2e7d32');
      setFlowTransitionComplete(true);
    }, 1500);
  };

  const handleFlowDecision = (decision: 'accept' | 'reject') => {
    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    
    // Correct logic: Original (Red->Brown) = Reject. Corrected (Red->Green) = Accept.
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

  // Image Questions
  const task1Data = {
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

  const task2Data = {
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

  // Task 3: Server Grid Click
  const handleHeatmapClick = (row: number, col: number) => {
    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    const isCorrect = isOriginal ? (row === 2 && col === 1) : (row === 0 && col === 3);

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

  // Multiple Choice Submission (Tasks 1, 2, and 5)
  const handleNextTaskMC = () => {
    if (currentTaskIndex === 4 && selectedTableRows.length === 0) {
      toast({
        title: "Row Selection Required",
        description: "Please select at least one valid row.",
        status: "warning",
        duration: 2000
      });
      return;
    }
    
    if (currentTaskIndex < 2 && !selectedValue) {
      toast({
        title: "Selection Required",
        description: "Please select an option to submit your answer.",
        status: "warning",
        duration: 2000
      });
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
      // Table test:
      // Phase 1 valid color is Green (#2e7d32). Valid rows are 1 and 4 (0-indexed).
      // Phase 2 valid color is Red (#c62828). Valid rows are 2 and 5 (0-indexed).
      const correctRows = isOriginal ? [1, 4] : [2, 5];
      isCorrect = (selectedTableRows.length === correctRows.length) && 
                  correctRows.every(r => selectedTableRows.includes(r));
    }

    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken
    };

    if (isOriginal) {
      const updated = [...originalResults, result];
      setOriginalResults(updated);
      
      if (currentTaskIndex === 4) {
        // End of Phase 1
        setTestPhase('intermission');
      } else {
        // Advance standard task index
        setSelectedValue("");
        setCurrentTaskIndex(prev => prev + 1);
        startTimer();
      }
    } else {
      const updated = [...correctedResults, result];
      setCorrectedResults(updated);

      if (currentTaskIndex === 4) {
        // End of Phase 2
        setTestPhase('results');
        toast({
          title: testMode === 'official' ? "Timed Tasks Completed!" : "Playground Phase Complete!",
          description: testMode === 'official' ? "Please review your comparative speedups below." : "",
          status: "success",
          duration: 3000
        });
      } else {
        // Advance standard task index
        setSelectedValue("");
        setCurrentTaskIndex(prev => prev + 1);
        startTimer();
      }
    }
  };

  // Compile unified research payload structure for the survey wizard submission
  const getCompiledPerformanceMetrics = () => {
    if (originalResults.length < 5 || correctedResults.length < 5) return null;
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
      }
    };
  };

  // Statistics calculation helpers
  const calculateAccuracy = (results: TaskResult[]): number => {
    if (results.length === 0) return 0;
    // Calculate total accuracies (standard standard tasks accuracy + video tracking accuracies aggregated)
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
    <Box className="w-full max-w-5xl mx-auto mt-6 p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl">
      {/* Dynamic GPU-accelerated FeColorMatrix Filter using calibration coefficients */}
      <svg width="0" height="0" style={{ position: 'absolute', zIndex: -100, pointerEvents: 'none' }}>
        <defs>
          <filter id="vision-daltonize-filter">
            <feColorMatrix type="matrix" values={svgMatrixValues} />
          </filter>
        </defs>
      </svg>

      <Box className="w-full h-full p-8 bg-white/95 backdrop-blur-xl rounded-[22px] border border-white/50">
        
        {/* ================= STAGE 1: MODE SELECTION INTRO ================= */}
        {testPhase === 'selection' && (
          <VStack spacing={8} py={8} align="center" textAlign="center">
            <Center boxSize="72px" bg="blue.50" color="blue.600" borderRadius="2xl">
              <Icon as={FiActivity} w={10} h={10} />
            </Center>
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" color="gray.800">
                ChomaShift Visual Analytics
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                Measure how our real-time color remapping filters increase your visual speed and target accuracy. Choose between Playground Sandbox or Official Research Session.
              </Text>
            </VStack>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} w="full" maxW="3xl">
              {/* Option A: Sandbox Playground */}
              <Card 
                variant="outline" 
                borderRadius="2xl" 
                cursor="pointer"
                _hover={{ borderColor: 'blue.400', transform: 'translateY(-3px)', shadow: 'lg' }}
                onClick={() => {
                  setTestMode('sandbox');
                  setTestPhase('welcome');
                }}
                transition="all 0.2s"
              >
                <CardBody className="p-6 space-y-4">
                  <Badge colorScheme="blue" borderRadius="lg" px={3} py={1}>Vision Playground</Badge>
                  <Heading fontSize="lg" fontWeight="black">Playground Sandbox</Heading>
                  <Text fontSize="xs" color="gray.500">
                    A free sandbox session to test yourself on Line graphs, Heatmaps, Video Tracking, and PDF Documents. Records stopwatch completion speeds locally without saving data to the backend.
                  </Text>
                </CardBody>
              </Card>

              {/* Option B: Guided Research Session */}
              <Card 
                variant="outline" 
                borderRadius="2xl" 
                cursor="pointer"
                _hover={{ borderColor: 'purple.400', transform: 'translateY(-3px)', shadow: 'lg' }}
                onClick={() => {
                  setTestMode('official');
                  setTestPhase('welcome');
                }}
                transition="all 0.2s"
              >
                <CardBody className="p-6 space-y-4">
                  <Badge colorScheme="purple" borderRadius="lg" px={3} py={1}>Research Study Session</Badge>
                  <Heading fontSize="lg" fontWeight="black">Official Usability Study</Heading>
                  <Text fontSize="xs" color="gray.500">
                    A structured testing session. Guides you through demographics intake, interactive calibration, visual timed tests, and SUS/NASA-TLX usability forms. Saves results securely in the admin database.
                  </Text>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Button variant="ghost" colorScheme="blue" onClick={() => navigate('/')}>
              Return to Dashboard
            </Button>
          </VStack>
        )}

        {/* ================= STAGE 2: DEMOGRAPHICS PRE-TASK SURV (OFFICIAL) ================= */}
        {testPhase === 'research_pre' && (
          <SurveyWizard 
            performanceMetrics={null} 
            onComplete={() => {}} 
            onBackToApp={() => setTestPhase('selection')}
            // Interop trigger: SurveyWizard demog complete triggers wizard step 2 (we hijack to run tests)
            // By overriding wizard onComplete or just custom handling, we let them proceed to welcome task.
            // Let's pass a dummy callback and handle step switching manually.
          />
        )}

        {/* SurveyWizard Interop Hack for guided session: pre-task triggers step welcome */}
        {testPhase === 'research_pre' && (
          <Box mt={4} textAlign="center">
            <Button 
              size="lg" 
              colorScheme="purple" 
              onClick={() => {
                setTestPhase('welcome');
              }}
              borderRadius="xl"
              px={8}
            >
              Start Timed Performance Tasks
            </Button>
          </Box>
        )}

        {/* ================= STAGE 3: WELCOME MODULE ================= */}
        {testPhase === 'welcome' && (
          <VStack spacing={8} py={8} align="center" textAlign="center">
            <Center boxSize="72px" bg="blue.50" color="blue.600" borderRadius="2xl">
              <Icon as={FiActivity} w={10} h={10} />
            </Center>
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" color="gray.800">
                {testMode === 'official' ? 'Official Vision Test' : 'Visual Testing Playground'}
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                Solve tasks in two consecutive phases: Phase 1 with **Original Colors**, followed by Phase 2 with **Corrected Colors** dynamically remapped by the GPU.
              </Text>
            </VStack>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} w="full" maxW="4xl" textAlign="left">
              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="blue.500" spacing={2} fontWeight="bold">
                    <Icon as={FiTrendingUp} />
                    <Text fontSize="sm">5 Multi-Media Tasks</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Examine static line charts, project status dashboards, 4x4 heatmaps, moving target video canvases, and academic maps.
                  </Text>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="orange.500" spacing={2} fontWeight="bold">
                    <Icon as={FiClock} />
                    <Text fontSize="sm">Interactive Stopwatch</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    High-resolution stopwatch timing captures response speeds and reaction offsets automatically.
                  </Text>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="purple.500" spacing={2} fontWeight="bold">
                    <Icon as={FiCheckCircle} />
                    <Text fontSize="sm">Visual Efficiency Report</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Displays side-by-side McKinsey graphs mapping speedups and accuracy improvements instantly.
                  </Text>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Button 
              size="lg" 
              colorScheme="blue" 
              bgGradient="linear(to-r, blue.600, purple.600)"
              onClick={handleStartOriginalPhase} 
              leftIcon={<FiPlay />}
              borderRadius="xl"
              fontWeight="black"
              shadow="md"
              px={10}
            >
              Start Phase 1 (Original Colors)
            </Button>
          </VStack>
        )}

        {/* ================= STAGE 4: RUN TIMED VISUAL TASKS ================= */}
        {(testPhase === 'test_original' || testPhase === 'test_corrected') && (
          <VStack spacing={6} align="stretch">
            {/* Header progress bar */}
            <HStack justify="space-between">
              <VStack align="start" spacing={0.5}>
                <HStack>
                  <Badge colorScheme={testPhase === 'test_original' ? 'orange' : 'green'} borderRadius="md" px={2} py={0.5}>
                    {testPhase === 'test_original' ? 'Phase 1: Original Colors' : 'Phase 2: Corrected Colors (Active)'}
                  </Badge>
                </HStack>
                <Heading fontSize="xl" fontWeight="black" color="gray.800">
                  {currentTaskIndex === 0 && "Task 1 of 5: Line Graph Legibility"}
                  {currentTaskIndex === 1 && "Task 2 of 5: Color-Dependent Bar Status"}
                  {currentTaskIndex === 2 && "Task 3 of 5: Interactive Server Node Alert"}
                  {currentTaskIndex === 3 && "Task 4 of 5: Dynamic Video Target Tracking"}
                  {currentTaskIndex === 4 && "Task 5 of 5: PDF Map Shading Comprehension"}
                </Heading>
              </VStack>
              <Text fontSize="xs" color="gray.400" fontWeight="bold">
                Progress: {Math.round(((currentTaskIndex) / 5) * 100)}%
              </Text>
            </HStack>
            <Progress value={((currentTaskIndex) / 5) * 100} size="xs" colorScheme="blue" borderRadius="full" mb={4} />

            {/* Test Arena: Split Layout */}
            <Grid templateColumns={{ base: '1fr', lg: '1.2fr 0.8fr' }} gap={8} alignItems="center">
              
              {/* Left Column: Confusion Visual element (remaps with GPU daltonize filter) */}
              <GridItem>
                <Box 
                  p={6} 
                  border="1px" 
                  borderColor="gray.200" 
                  borderRadius="2xl" 
                  bg="gray.50/30" 
                  shadow="sm"
                  style={{
                    filter: testPhase === 'test_corrected' ? 'url(#vision-daltonize-filter)' : 'none'
                  }}
                >
                  {/* TASK 1: Line Chart */}
                  {currentTaskIndex === 0 && (
                    <Box h="260px" w="full" position="relative">
                      <svg viewBox="0 0 400 200" width="100%" height="100%">
                        <line x1="40" y1="20" x2="380" y2="20" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="60" x2="380" y2="60" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="100" x2="380" y2="100" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="140" x2="380" y2="140" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="180" x2="380" y2="180" stroke="#ced4da" strokeWidth="1.5" />
                        <line x1="40" y1="20" x2="40" y2="180" stroke="#ced4da" strokeWidth="1.5" />

                        <text x="30" y="24" fill="#6c757d" fontSize="9" textAnchor="end">$60k</text>
                        <text x="30" y="64" fill="#6c757d" fontSize="9" textAnchor="end">$45k</text>
                        <text x="30" y="104" fill="#6c757d" fontSize="9" textAnchor="end">$30k</text>
                        <text x="30" y="144" fill="#6c757d" fontSize="9" textAnchor="end">$15k</text>
                        <text x="30" y="184" fill="#6c757d" fontSize="9" textAnchor="end">$0k</text>

                        <text x="90" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q1</text>
                        <text x="180" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q2</text>
                        <text x="270" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q3</text>
                        <text x="350" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q4</text>

                        {/* expenses line (Green) */}
                        <path d="M 90 140 L 180 100 L 270 100 L 350 60" fill="none" stroke="#2e7d32" strokeWidth="3" />
                        <circle cx="90" cy="140" r="4" fill="#2e7d32" />
                        <circle cx="180" cy="100" r="4" fill="#2e7d32" />
                        <circle cx="270" cy="100" r="4" fill="#2e7d32" />
                        <circle cx="350" cy="60" r="4" fill="#2e7d32" />

                        {/* Revenue line (Red) */}
                        <path d="M 90 100 L 180 140 L 270 60 L 350 20" fill="none" stroke="#c62828" strokeWidth="3" />
                        <circle cx="90" cy="100" r="4" fill="#c62828" />
                        <circle cx="180" cy="140" r="4" fill="#c62828" />
                        <circle cx="270" cy="60" r="4" fill="#c62828" />
                        <circle cx="350" cy="20" r="4" fill="#c62828" />

                        {/* Line 3: Budget - BROWN */}
                        <path d="M 90 60 L 180 60 L 270 140 L 350 100" fill="none" stroke="#8d6e63" strokeWidth="3" />
                        <circle cx="90" cy="60" r="4" fill="#8d6e63" />
                        <circle cx="180" cy="60" r="4" fill="#8d6e63" />
                        <circle cx="270" cy="140" r="4" fill="#8d6e63" />
                        <circle cx="350" cy="100" r="4" fill="#8d6e63" />

                        {/* Line 4: Projected - OLIVE */}
                        <path d="M 90 100 L 180 20 L 270 100 L 350 140" fill="none" stroke="#9e9d24" strokeWidth="3" />
                        <circle cx="90" cy="100" r="4" fill="#9e9d24" />
                        <circle cx="180" cy="20" r="4" fill="#9e9d24" />
                        <circle cx="270" cy="100" r="4" fill="#9e9d24" />
                        <circle cx="350" cy="140" r="4" fill="#9e9d24" />
                      </svg>
                    </Box>
                  )}

                  {/* TASK 2: Bar Chart */}
                  {currentTaskIndex === 1 && (
                    <Box h="260px" w="full">
                      <svg viewBox="0 0 400 200" width="100%" height="100%">
                        <line x1="40" y1="40" x2="380" y2="40" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="75" x2="380" y2="75" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="110" x2="380" y2="110" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="145" x2="380" y2="145" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="180" x2="380" y2="180" stroke="#ced4da" strokeWidth="1.5" />
                        <line x1="40" y1="40" x2="40" y2="180" stroke="#ced4da" strokeWidth="1.5" />

                        <rect x="45" y="12" width="8" height="8" fill="#388e3c" rx="2" />
                        <text x="58" y="19" fill="#495057" fontSize="8" fontWeight="bold">On Track</text>
                        <rect x="125" y="12" width="8" height="8" fill="#d32f2f" rx="2" />
                        <text x="138" y="19" fill="#495057" fontSize="8" fontWeight="bold">Delayed</text>
                        <rect x="205" y="12" width="8" height="8" fill="#ef6c00" rx="2" />
                        <text x="218" y="19" fill="#495057" fontSize="8" fontWeight="bold">At Risk</text>
                        <rect x="285" y="12" width="8" height="8" fill="#fbc02d" rx="2" />
                        <text x="298" y="19" fill="#495057" fontSize="8" fontWeight="bold">Paused</text>

                        <text x="30" y="44" fill="#6c757d" fontSize="9" textAnchor="end">100%</text>
                        <text x="30" y="79" fill="#6c757d" fontSize="9" textAnchor="end">75%</text>
                        <text x="30" y="114" fill="#6c757d" fontSize="9" textAnchor="end">50%</text>
                        <text x="30" y="149" fill="#6c757d" fontSize="9" textAnchor="end">25%</text>
                        <text x="30" y="184" fill="#6c757d" fontSize="9" textAnchor="end">0%</text>

                        <rect x="70" y="60" width="40" height="120" fill="#388e3c" rx="4" />
                        <text x="90" y="195" fill="#495057" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 1</text>
                        <rect x="150" y="60" width="40" height="120" fill="#d32f2f" rx="4" />
                        <text x="170" y="195" fill="#495057" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 2</text>
                        <rect x="230" y="60" width="40" height="120" fill="#ef6c00" rx="4" />
                        <text x="250" y="195" fill="#495057" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 3</text>
                        <rect x="310" y="60" width="40" height="120" fill="#fbc02d" rx="4" />
                        <text x="330" y="195" fill="#495057" fontSize="9" textAnchor="middle" fontWeight="bold">Phase 4</text>
                      </svg>
                    </Box>
                  )}

                  {/* TASK 3: Heatmap Server Nodes */}
                  {currentTaskIndex === 2 && (
                    <VStack spacing={2} w="full" align="center">
                      <Text fontSize="xs" fontWeight="bold" color="blue.600" mb={1} textTransform="uppercase">
                        Click the Node in Critical Alert (Red)
                      </Text>
                      <SimpleGrid columns={4} spacing={2.5} maxW="280px" w="full">
                        {Array.from({ length: 4 }).map((_, rIdx) => 
                          Array.from({ length: 4 }).map((_, cIdx) => {
                            const isOriginal = testPhase === 'test_original';
                            const isAlert = isOriginal ? (rIdx === 2 && cIdx === 1) : (rIdx === 0 && cIdx === 3);
                            const cellColor = isAlert ? '#c62828' : ((rIdx + cIdx) % 3 === 0 ? '#ef6c00' : '#2e7d32');
                            return (
                              <Box 
                                key={`${rIdx}-${cIdx}`}
                                boxSize="55px" 
                                bg={cellColor}
                                borderRadius="xl"
                                border="2px"
                                borderColor="white"
                                shadow="md"
                                cursor="pointer"
                                transition="transform 0.15s"
                                _hover={{ transform: 'scale(1.08)' }}
                                onClick={() => handleHeatmapClick(rIdx, cIdx)}
                              />
                            );
                          })
                        )}
                      </SimpleGrid>
                    </VStack>
                  )}

                  {/* TASK 4: Chromatic Confusion Flow Diagram */}
                  {currentTaskIndex === 3 && (
                    <VStack spacing={3} w="full" align="stretch">
                      <HStack justify="space-between" px={2}>
                        <HStack color="red.500">
                          <Icon as={FiActivity} />
                          <Text fontSize="xs" fontWeight="bold">State Transition Validation</Text>
                        </HStack>
                      </HStack>

                      <Center 
                        w="full"
                        h="240px"
                        bg="gray.50"
                        borderRadius="2xl"
                        border="1px"
                        borderColor="gray.200"
                        position="relative"
                        overflow="hidden"
                      >
                        <HStack spacing={8} align="center">
                          {/* Fixed Initial Node (Red) */}
                          <Center boxSize="60px" bg="#c62828" borderRadius="full" shadow="md">
                            <Text color="white" fontWeight="bold" fontSize="sm">A</Text>
                          </Center>
                          
                          {/* Arrow */}
                          <Box w="60px" h="4px" bg="gray.300" position="relative">
                            <Box position="absolute" right="-2px" top="-6px" borderLeft="8px solid" borderTop="8px solid transparent" borderBottom="8px solid transparent" borderLeftColor="gray.300" />
                          </Box>

                          {/* Transitioning Target Node */}
                          <Center 
                            boxSize="60px" 
                            bg={flowNodeColor} 
                            borderRadius="full" 
                            shadow="md"
                            transition="background-color 0.5s ease"
                          >
                            <Text color="white" fontWeight="bold" fontSize="sm">B</Text>
                          </Center>
                        </HStack>
                      </Center>
                    </VStack>
                  )}

                  {/* TASK 5: Data Extraction from Color-Coded Table */}
                  {currentTaskIndex === 4 && (
                    <VStack spacing={3} w="full" align="stretch">
                      <HStack color="purple.600" px={2}>
                        <Icon as={FiFileText} />
                        <Text fontSize="xs" fontWeight="bold">Status Log Validation Table</Text>
                      </HStack>
                      <Box 
                        w="full"
                        bg="white"
                        borderRadius="xl"
                        border="1px"
                        borderColor="gray.200"
                        overflow="hidden"
                      >
                        <VStack spacing={0} w="full" align="stretch">
                          {/* Table Headers */}
                          <HStack bg="gray.100" px={4} py={2} borderBottom="1px" borderColor="gray.200">
                            <Text flex={1} fontSize="xs" fontWeight="bold" color="gray.600">ID</Text>
                            <Text flex={2} fontSize="xs" fontWeight="bold" color="gray.600">PROCESS</Text>
                            <Text flex={1} fontSize="xs" fontWeight="bold" color="gray.600" textAlign="right">STATUS</Text>
                          </HStack>
                          {/* Table Rows (6 rows) */}
                          {Array.from({ length: 6 }).map((_, idx) => {
                            const isOriginal = testPhase === 'test_original';
                            // Valid rows: Phase 1 -> 1, 4 (Green #2e7d32). Phase 2 -> 2, 5 (Red #c62828).
                            // Noise rows: Brown (#8d6e63), Red (in Phase 1), Green (in Phase 2)
                            let rowBg = '#8d6e63'; // default noise
                            if (isOriginal) {
                              if (idx === 1 || idx === 4) rowBg = '#2e7d32'; // valid
                              else if (idx === 0 || idx === 3) rowBg = '#c62828'; // noise
                            } else {
                              if (idx === 2 || idx === 5) rowBg = '#c62828'; // valid
                              else if (idx === 1 || idx === 4) rowBg = '#2e7d32'; // noise
                            }

                            const isSelected = selectedTableRows.includes(idx);

                            return (
                              <HStack 
                                key={idx}
                                px={4} 
                                py={3} 
                                bg={rowBg}
                                borderBottom="1px" 
                                borderColor="whiteAlpha.300"
                                cursor="pointer"
                                opacity={isSelected ? 1 : 0.85}
                                _hover={{ opacity: 1 }}
                                onClick={() => {
                                  setSelectedTableRows(prev => 
                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                  );
                                }}
                              >
                                <Text flex={1} fontSize="sm" color="white" fontWeight="bold">#{1000 + idx}</Text>
                                <Text flex={2} fontSize="sm" color="white">PROC_{String.fromCharCode(65 + idx)}</Text>
                                <Box flex={1} display="flex" justifyContent="flex-end">
                                  {isSelected && <Icon as={FiCheckCircle} color="white" />}
                                </Box>
                              </HStack>
                            );
                          })}
                        </VStack>
                      </Box>
                    </VStack>
                  )}
                </Box>
              </GridItem>

              {/* Right Column: Dynamic Question + User selection options */}
              <GridItem>
                <VStack align="stretch" spacing={5}>
                  <Card size="sm" variant="outline" borderRadius="xl">
                    <CardBody p={5}>
                      <VStack align="start" spacing={4}>
                        <HStack spacing={2} color="blue.500" fontWeight="bold">
                          <Icon as={FiGrid} />
                          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider">
                            Interactive Task Instructions
                          </Text>
                        </HStack>
                        <Text fontSize="md" fontWeight="bold" color="gray.800">
                          {currentTaskIndex === 0 && (testPhase === 'test_original' ? task1Data.original.question : task1Data.corrected.question)}
                          {currentTaskIndex === 1 && (testPhase === 'test_original' ? task2Data.original.question : task2Data.corrected.question)}
                          {currentTaskIndex === 2 && "Click on the single status node in critical alert (Red). Warning (Orange) and normal (Green) nodes surround it."}
                          {currentTaskIndex === 3 && "Transition Rule: Only Accept (Red → Green) transitions. Evaluate the transition when it completes."}
                          {currentTaskIndex === 4 && (testPhase === 'test_original' 
                            ? "Select all rows indicating 'Success' status (Green backgrounds)." 
                            : "Select all rows indicating 'Failure' status (Red backgrounds).")}
                        </Text>
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* Task Choice selections */}
                  {currentTaskIndex < 2 && (
                    <RadioGroup onChange={setSelectedValue} value={selectedValue}>
                      <VStack align="stretch" spacing={3}>
                        {(currentTaskIndex === 0 ? 
                          (testPhase === 'test_original' ? task1Data.original.options : task1Data.corrected.options) : 
                          (testPhase === 'test_original' ? task2Data.original.options : task2Data.corrected.options)
                        ).map((opt) => (
                          <Box 
                            key={opt}
                            border="1px" 
                            borderColor={selectedValue === opt ? 'blue.400' : 'gray.200'} 
                            bg={selectedValue === opt ? 'blue.50/20' : 'white'}
                            p={3.5} 
                            borderRadius="xl"
                            cursor="pointer"
                            onClick={() => setSelectedValue(opt)}
                            transition="all 0.15s"
                            _hover={{ borderColor: 'blue.300' }}
                          >
                            <Radio value={opt} colorScheme="blue">
                              <Text fontSize="sm" fontWeight="bold" color="gray.750" ml={1}>{opt}</Text>
                            </Radio>
                          </Box>
                        ))}
                        <Button size="lg" colorScheme="blue" borderRadius="xl" fontWeight="black" onClick={handleNextTaskMC} mt={2}>
                          Submit Response
                        </Button>
                      </VStack>
                    </RadioGroup>
                  )}

                  {currentTaskIndex === 2 && (
                    <Box p={4} border="1px dashed" borderColor="blue.300" borderRadius="xl" bg="blue.50/10">
                      <VStack spacing={2} textAlign="center">
                        <Icon as={FiActivity} color="blue.500" w={6} h={6} />
                        <Text fontSize="sm" fontWeight="bold" color="gray.700">Find the critical node!</Text>
                        <Text fontSize="xs" color="gray.400">Click the node in red directly on the left grid matrix.</Text>
                      </VStack>
                    </Box>
                  )}

                  {currentTaskIndex === 3 && (
                    <VStack align="stretch" spacing={3}>
                      {!flowTransitionComplete ? (
                        <Box p={4} border="1px dashed" borderColor="orange.300" borderRadius="xl" bg="orange.50/10">
                          <VStack spacing={1} textAlign="center">
                            <Icon as={FiClock} color="orange.500" w={6} h={6} />
                            <Text fontSize="sm" fontWeight="bold" color="gray.700">Waiting for Transition...</Text>
                            <Text fontSize="xs" color="gray.400">Observe Node B carefully.</Text>
                          </VStack>
                        </Box>
                      ) : (
                        <VStack spacing={3} align="stretch">
                          <Button size="lg" colorScheme="green" borderRadius="xl" fontWeight="black" onClick={() => handleFlowDecision('accept')}>
                            ACCEPT (Valid Rule)
                          </Button>
                          <Button size="lg" colorScheme="red" borderRadius="xl" fontWeight="black" onClick={() => handleFlowDecision('reject')}>
                            REJECT (Invalid Rule)
                          </Button>
                        </VStack>
                      )}
                    </VStack>
                  )}

                  {currentTaskIndex === 4 && (
                    <VStack align="stretch" spacing={3}>
                      <Box p={4} border="1px dashed" borderColor="purple.300" borderRadius="xl" bg="purple.50/10">
                        <VStack spacing={1} textAlign="center">
                          <Icon as={FiFileText} color="purple.500" w={6} h={6} />
                          <Text fontSize="sm" fontWeight="bold" color="gray.700">Multiple Row Selection</Text>
                          <Text fontSize="xs" color="gray.400">Click rows on the table to toggle selection. Click submit when ready.</Text>
                        </VStack>
                      </Box>
                      <Button size="lg" colorScheme="purple" borderRadius="xl" fontWeight="black" onClick={handleNextTaskMC}>
                        Submit Table Selection
                      </Button>
                    </VStack>
                  )}

                </VStack>
              </GridItem>
            </Grid>
          </VStack>
        )}

        {/* ================= STAGE 5: INTERMISSION SCREEN ================= */}
        {testPhase === 'intermission' && (
          <VStack spacing={8} py={8} align="center" textAlign="center">
            <Center boxSize="72px" bg="green.50" color="green.600" borderRadius="2xl">
              <Icon as={FiCheckCircle} w={10} h={10} />
            </Center>
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" color="gray.800">
                Phase 1 Complete!
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                You have finished all uncorrected tasks using **Original Colors**.
                <br /><br />
                Now, we will activate your **personalized Daltonization filters** and re-run similar tasks.
              </Text>
            </VStack>
            <Divider />
            <Button
              size="lg"
              colorScheme="green"
              bgGradient="linear(to-r, green.600, teal.500)"
              onClick={handleStartCorrectedPhase}
              borderRadius="xl"
              fontWeight="black"
              shadow="md"
              px={10}
            >
              Start Phase 2 (Corrected Colors)
            </Button>
          </VStack>
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
          <VStack spacing={8} align="stretch" py={2}>
            
            <HStack spacing={4} align="center">
              <Center boxSize="60px" bg="blue.50" color="blue.600" borderRadius="2xl">
                <Icon as={FiCheckCircle} w={8} h={8} />
              </Center>
              <VStack align="start" spacing={1}>
                {testMode === 'official' ? (
                  <Badge colorScheme="purple" px={2} py={0.5} borderRadius="md" fontSize="2xs" fontWeight="bold">
                    Official Study Submission Success
                  </Badge>
                ) : (
                  <Badge colorScheme="blue" px={2} py={0.5} borderRadius="md" fontSize="2xs" fontWeight="bold">
                    Vision Playground Sandbox Mode
                  </Badge>
                )}
                <Heading fontSize="2xl" fontWeight="black" color="gray.800">
                  Performance Efficiency Dashboard
                </Heading>
              </VStack>
            </HStack>

            <Divider />

            {/* Display registered research uuid */}
            {testMode === 'official' && participantUuid && (
              <Box className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl">
                <Text fontSize="sm" color="purple.800" fontWeight="bold">
                  🔐 Participant ID Registered: `{participantUuid}`
                </Text>
                <Text fontSize="xs" color="purple.600" mt={1}>
                  All metrics, System Usability values, and NASA workloads have been securely locked in ChomaShift's central database for admin review.
                </Text>
              </Box>
            )}

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              {/* Accuracy */}
              <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.200">
                <CardBody className="space-y-4 p-6">
                  <HStack justify="space-between">
                    <Text fontWeight="black" color="gray.700" fontSize="sm" textTransform="uppercase">
                      Overall Task Accuracy
                    </Text>
                    <Badge colorScheme={corrAccuracy >= origAccuracy ? 'green' : 'red'} borderRadius="md">
                      {corrAccuracy >= origAccuracy ? `+${corrAccuracy - origAccuracy}% Accuracy` : 'No improvement'}
                    </Badge>
                  </HStack>
                  <SimpleGrid columns={2} spacing={4}>
                    <VStack align="start" p={3} bg="orange.50/20" borderRadius="xl" border="1px" borderColor="orange.100">
                      <Text fontSize="xs" color="gray.400" fontWeight="bold">Original Colors</Text>
                      <Heading fontSize="3xl" color="orange.600" fontWeight="black">{origAccuracy}%</Heading>
                    </VStack>
                    <VStack align="start" p={3} bg="green.50/20" borderRadius="xl" border="1px" borderColor="green.100">
                      <Text fontSize="xs" color="gray.400" fontWeight="bold">Corrected Colors</Text>
                      <Heading fontSize="3xl" color="green.600" fontWeight="black">{corrAccuracy}%</Heading>
                    </VStack>
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Time */}
              <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.200">
                <CardBody className="space-y-4 p-6">
                  <HStack justify="space-between">
                    <Text fontWeight="black" color="gray.700" fontSize="sm" textTransform="uppercase">
                      Average Completion Speed
                    </Text>
                    <Badge colorScheme={origTime > corrTime ? 'green' : 'red'} borderRadius="md">
                      {origTime > corrTime ? `${Math.round((origTime / corrTime) * 10) / 10}x Faster` : 'No improvement'}
                    </Badge>
                  </HStack>
                  <SimpleGrid columns={2} spacing={4}>
                    <VStack align="start" p={3} bg="orange.50/20" borderRadius="xl" border="1px" borderColor="orange.100">
                      <Text fontSize="xs" color="gray.400" fontWeight="bold">Original Colors</Text>
                      <Heading fontSize="3xl" color="orange.600" fontWeight="black">{origTime}s</Heading>
                    </VStack>
                    <VStack align="start" p={3} bg="green.50/20" borderRadius="xl" border="1px" borderColor="green.100">
                      <Text fontSize="xs" color="gray.400" fontWeight="bold">Corrected Colors</Text>
                      <Heading fontSize="3xl" color="green.600" fontWeight="black">{corrTime}s</Heading>
                    </VStack>
                  </SimpleGrid>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Core utility takeaway banner */}
            <Box p={5} bg="blue.50/20" borderRadius="2xl" border="1px" borderColor="blue.200" textAlign="center">
              <VStack spacing={2}>
                <Heading fontSize="md" color="blue.700" fontWeight="black">
                  🚀 Utility Metrics Takeaway
                </Heading>
                <Text fontSize="sm" color="gray.600" maxW="2xl">
                  {corrAccuracy > origAccuracy && origTime > corrTime ? (
                    `Active color remapping successfully resolved color confusion! You achieved ${corrAccuracy}% accuracy (${corrAccuracy - origAccuracy}% higher than original) while solving tasks ${Math.round((origTime / corrTime) * 10) / 10}x faster.`
                  ) : origTime > corrTime ? (
                    `Color correction significantly reduced visual strain! You completed tasks in ${corrTime} seconds average, which is ${(origTime - corrTime).toFixed(1)}s faster than standard colors.`
                  ) : (
                    `Color remapping allows you to clearly identify intersecting lines, alert highlights, and bar statuses with absolute confidence!`
                  )}
                </Text>
              </VStack>
            </Box>

            {/* Bottom Actions */}
            {testMode === 'official' && !participantUuid ? (
              <HStack spacing={4} justify="center" mt={4}>
                <Button
                  size="lg"
                  colorScheme="purple"
                  bgGradient="linear(to-r, purple.500, indigo.600)"
                  _hover={{ bgGradient: "linear(to-r, purple.600, indigo.700)" }}
                  borderRadius="xl"
                  onClick={() => setTestPhase('research_post')}
                  fontWeight="black"
                  px={10}
                  shadow="lg"
                >
                  Continue to Usability Survey & Feedback
                </Button>
              </HStack>
            ) : (
              <HStack spacing={4} justify="center" mt={4}>
                <Button size="lg" colorScheme="blue" borderRadius="xl" onClick={() => navigate('/')} fontWeight="black">
                  Back to Dashboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  colorScheme="blue"
                  leftIcon={<FiRefreshCw />}
                  borderRadius="xl"
                  onClick={() => setTestPhase('selection')}
                  fontWeight="bold"
                >
                  Change Test Mode
                </Button>
              </HStack>
            )}
          </VStack>
        )}

      </Box>
    </Box>
  );
};
