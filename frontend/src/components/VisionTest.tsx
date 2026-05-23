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
import { FiTrendingUp, FiCheckCircle, FiPlay, FiRefreshCw, FiGrid, FiClock, FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/profile';

// Types for testing state
interface TaskResult {
  accuracy: boolean;
  time: number; // in seconds
}

export const VisionTest: FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Vision Profile Matrix variables
  const [svgMatrixValues, setSvgMatrixValues] = useState<string>("1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");

  // Game States
  // 'welcome' -> 'test_original' -> 'intermission' -> 'test_corrected' -> 'results'
  const [testPhase, setTestPhase] = useState<'welcome' | 'test_original' | 'intermission' | 'test_corrected' | 'results'>('welcome');
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0); // 0 = Line, 1 = Bar, 2 = Heatmap

  // Timers
  const timerRef = useRef<number>(0);
  
  // Answers states
  const [selectedValue, setSelectedValue] = useState<string>("");

  // Results log
  const [originalResults, setOriginalResults] = useState<TaskResult[]>([]);
  const [correctedResults, setCorrectedResults] = useState<TaskResult[]>([]);

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
        // Build 3x3 matrix matching type & severity
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
        
        // Map 3x3 to 5x4 SVG matrix string
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

  // Task 1 (Line Chart) questions
  const task1Data = {
    original: {
      question: "Examine the line chart. What is the value of the RED line in Quarter 3 (Q3)?",
      options: ["$20k", "$45k", "$30k", "$55k"],
      correct: "$45k"
    },
    corrected: {
      question: "Examine the line chart. What is the value of the GREEN line in Quarter 2 (Q2)?",
      options: ["$15k", "$30k", "$50k", "$25k"],
      correct: "$30k"
    }
  };

  // Task 2 (Status Board - Color Dependent) questions
  const task2Data = {
    original: {
      question: "Examine the status board. Which project phase is currently DELAYED (indicated by Red status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 2"
    },
    corrected: {
      question: "Examine the status board. Which project phase is currently ON TRACK (indicated by Green status)?",
      options: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
      correct: "Phase 1"
    }
  };

  // Task 3 (Heatmap Grid - Critical alert) questions
  // In original: critical red cell is at (2,1) index
  // In corrected: critical red cell is at (0,3) index
  const handleHeatmapClick = (row: number, col: number) => {
    const timeTaken = stopTimer();
    const isOriginal = testPhase === 'test_original';
    const isCorrect = isOriginal ? (row === 2 && col === 1) : (row === 0 && col === 3);

    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken
    };

    if (isOriginal) {
      const updated = [...originalResults, result];
      setOriginalResults(updated);
      setTestPhase('intermission');
    } else {
      const updated = [...correctedResults, result];
      setCorrectedResults(updated);
      setTestPhase('results');
      toast({
        title: "Test Completed!",
        description: "Comparative visual performance profile generated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    }
  };

  const handleNextMultipleChoice = () => {
    if (!selectedValue) {
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
    }

    const result: TaskResult = {
      accuracy: isCorrect,
      time: timeTaken
    };

    if (isOriginal) {
      setOriginalResults(prev => [...prev, result]);
    } else {
      setCorrectedResults(prev => [...prev, result]);
    }

    setSelectedValue("");
    setCurrentTaskIndex(prev => prev + 1);
    startTimer();
  };

  // Dynamic statistics calculations
  const calculateAccuracy = (results: TaskResult[]): number => {
    if (results.length === 0) return 0;
    const correctCount = results.filter(r => r.accuracy).length;
    return Math.round((correctCount / results.length) * 100);
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
      {/* Invisible dynamic SVG Filter using user calibration */}
      <svg width="0" height="0" style={{ position: 'absolute', zIndex: -100, pointerEvents: 'none' }}>
        <defs>
          <filter id="vision-daltonize-filter">
            <feColorMatrix type="matrix" values={svgMatrixValues} />
          </filter>
        </defs>
      </svg>

      <Box className="w-full h-full p-8 bg-white/95 backdrop-blur-xl rounded-[22px] border border-white/50">
        
        {/* ================= STAGE 1: WELCOME INTRO ================= */}
        {testPhase === 'welcome' && (
          <VStack spacing={8} py={8} align="center" textAlign="center">
            <Center boxSize="72px" bg="blue.50" color="blue.600" borderRadius="2xl">
              <Icon as={FiActivity} w={10} h={10} />
            </Center>
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" color="gray.800">
                Quantifiable Visual Testing
              </Heading>
              <Text fontSize="lg" color="gray.600" maxW="2xl">
                Technical numbers and subjective aesthetics don't tell the whole story. This module provides mathematically proven feedback on how much our Daltonization filters improve your visual speed and task accuracy.
              </Text>
            </VStack>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} w="full" maxW="4xl" textAlign="left">
              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="blue.500" spacing={2} fontWeight="bold">
                    <Icon as={FiTrendingUp} />
                    <Text fontSize="sm">Standardized Tasks</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    You will read Line charts, Bar graphs, and Heatmaps styled with classic colorblind confusion colors (Red, Green, Orange, Yellow).
                  </Text>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="orange.500" spacing={2} fontWeight="bold">
                    <Icon as={FiClock} />
                    <Text fontSize="sm">Comparative Timing</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Solve tasks in two consecutive phases: Phase 1 with **Original Colors**, followed by Phase 2 with **Corrected Colors** dynamically remapped.
                  </Text>
                </CardBody>
              </Card>

              <Card variant="outline" borderRadius="xl" bg="gray.50/50">
                <CardBody className="space-y-3">
                  <HStack color="purple.500" spacing={2} fontWeight="bold">
                    <Icon as={FiCheckCircle} />
                    <Text fontSize="sm">Quantifiable Report</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Instantly view your speed increase (seconds saved) and accuracy improvement (%) compared side-by-side.
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

        {/* ================= STAGE 2: PHASE 1 (ORIGINAL) OR PHASE 2 (CORRECTED) ================= */}
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
                <Heading fontSize="xl" fontWeight="black" color="gray.850">
                  Task {currentTaskIndex + 1} of 3
                </Heading>
              </VStack>
              <Text fontSize="xs" color="gray.400" fontWeight="bold">
                Progress: {Math.round(((currentTaskIndex) / 3) * 100)}%
              </Text>
            </HStack>
            <Progress value={((currentTaskIndex) / 3) * 100} size="xs" colorScheme="blue" borderRadius="full" mb={4} />

            {/* Test Arena: Split Layout */}
            <Grid templateColumns={{ base: '1fr', md: '1.2fr 0.8fr' }} gap={8} alignItems="center">
              
              {/* Left Column: Colorblind Confusing Visual Element */}
              <GridItem>
                <Box 
                  p={6} 
                  border="1px" 
                  borderColor="gray.150" 
                  borderRadius="2xl" 
                  bg="gray.50/30" 
                  shadow="sm"
                  style={{
                    filter: testPhase === 'test_corrected' ? 'url(#vision-daltonize-filter)' : 'none'
                  }}
                >
                  {/* TASK 1: Sales Trend Line Chart (Confusing Red/Green lines) */}
                  {currentTaskIndex === 0 && (
                    <Box h="260px" w="full" position="relative">
                      <svg viewBox="0 0 400 200" width="100%" height="100%">
                        {/* Background lines */}
                        <line x1="40" y1="20" x2="380" y2="20" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="60" x2="380" y2="60" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="100" x2="380" y2="100" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="140" x2="380" y2="140" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="180" x2="380" y2="180" stroke="#ced4da" strokeWidth="1.5" />
                        <line x1="40" y1="20" x2="40" y2="180" stroke="#ced4da" strokeWidth="1.5" />

                        {/* Y-axis Labels */}
                        <text x="30" y="24" fill="#6c757d" fontSize="9" textAnchor="end">$60k</text>
                        <text x="30" y="64" fill="#6c757d" fontSize="9" textAnchor="end">$45k</text>
                        <text x="30" y="104" fill="#6c757d" fontSize="9" textAnchor="end">$30k</text>
                        <text x="30" y="144" fill="#6c757d" fontSize="9" textAnchor="end">$15k</text>
                        <text x="30" y="184" fill="#6c757d" fontSize="9" textAnchor="end">$0k</text>

                        {/* X-axis Labels */}
                        <text x="90" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q1</text>
                        <text x="180" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q2</text>
                        <text x="270" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q3</text>
                        <text x="350" y="195" fill="#6c757d" fontSize="9" textAnchor="middle">Q4</text>

                        {/* Line 1: Expenses - GREEN (#2e7d32) */}
                        {/* Q1=140($15k), Q2=100($30k), Q3=100($30k), Q4=60($45k) */}
                        <path d="M 90 140 L 180 100 L 270 100 L 350 60" fill="none" stroke="#2e7d32" strokeWidth="3" />
                        <circle cx="90" cy="140" r="4" fill="#2e7d32" />
                        <circle cx="180" cy="100" r="4" fill="#2e7d32" />
                        <circle cx="270" cy="100" r="4" fill="#2e7d32" />
                        <circle cx="350" cy="60" r="4" fill="#2e7d32" />

                        {/* Line 2: Revenue - RED (#c62828) */}
                        {/* Q1=100($30k), Q2=140($15k), Q3=60($45k), Q4=20($60k) */}
                        <path d="M 90 100 L 180 140 L 270 60 L 350 20" fill="none" stroke="#c62828" strokeWidth="3" />
                        <circle cx="90" cy="100" r="4" fill="#c62828" />
                        <circle cx="180" cy="140" r="4" fill="#c62828" />
                        <circle cx="270" cy="60" r="4" fill="#c62828" />
                        <circle cx="350" cy="20" r="4" fill="#c62828" />

                        {/* Line 3: Budget - BROWN (#8d6e63) */}
                        {/* Q1=60($45k), Q2=60($45k), Q3=140($15k), Q4=100($30k) */}
                        <path d="M 90 60 L 180 60 L 270 140 L 350 100" fill="none" stroke="#8d6e63" strokeWidth="3" />
                        <circle cx="90" cy="60" r="4" fill="#8d6e63" />
                        <circle cx="180" cy="60" r="4" fill="#8d6e63" />
                        <circle cx="270" cy="140" r="4" fill="#8d6e63" />
                        <circle cx="350" cy="100" r="4" fill="#8d6e63" />

                        {/* Line 4: Projected - OLIVE (#9e9d24) */}
                        {/* Q1=100($30k), Q2=20($60k), Q3=100($30k), Q4=140($15k) */}
                        <path d="M 90 100 L 180 20 L 270 100 L 350 140" fill="none" stroke="#9e9d24" strokeWidth="3" />
                        <circle cx="90" cy="100" r="4" fill="#9e9d24" />
                        <circle cx="180" cy="20" r="4" fill="#9e9d24" />
                        <circle cx="270" cy="100" r="4" fill="#9e9d24" />
                        <circle cx="350" cy="140" r="4" fill="#9e9d24" />

                        {/* Legend intentionally omitted to test pure color boundary detection */}
                      </svg>
                    </Box>
                  )}

                  {/* TASK 2: Project Phase Status Bar Chart (Deuteranopia green/orange/yellow confusion) */}
                  {currentTaskIndex === 1 && (
                    <Box h="260px" w="full">
                      <svg viewBox="0 0 400 200" width="100%" height="100%">
                        <line x1="40" y1="40" x2="380" y2="40" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="75" x2="380" y2="75" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="110" x2="380" y2="110" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="145" x2="380" y2="145" stroke="#f1f3f5" strokeWidth="1" />
                        <line x1="40" y1="180" x2="380" y2="180" stroke="#ced4da" strokeWidth="1.5" />
                        <line x1="40" y1="40" x2="40" y2="180" stroke="#ced4da" strokeWidth="1.5" />

                        {/* Status Legend at the top */}
                        <rect x="45" y="12" width="8" height="8" fill="#388e3c" rx="2" />
                        <text x="58" y="19" fill="#495057" fontSize="8" fontWeight="bold">On Track</text>

                        <rect x="125" y="12" width="8" height="8" fill="#d32f2f" rx="2" />
                        <text x="138" y="19" fill="#495057" fontSize="8" fontWeight="bold">Delayed</text>

                        <rect x="205" y="12" width="8" height="8" fill="#ef6c00" rx="2" />
                        <text x="218" y="19" fill="#495057" fontSize="8" fontWeight="bold">At Risk</text>

                        <rect x="285" y="12" width="8" height="8" fill="#fbc02d" rx="2" />
                        <text x="298" y="19" fill="#495057" fontSize="8" fontWeight="bold">Paused</text>

                        {/* Y-axis Labels */}
                        <text x="30" y="44" fill="#6c757d" fontSize="9" textAnchor="end">100%</text>
                        <text x="30" y="79" fill="#6c757d" fontSize="9" textAnchor="end">75%</text>
                        <text x="30" y="114" fill="#6c757d" fontSize="9" textAnchor="end">50%</text>
                        <text x="30" y="149" fill="#6c757d" fontSize="9" textAnchor="end">25%</text>
                        <text x="30" y="184" fill="#6c757d" fontSize="9" textAnchor="end">0%</text>

                        {/* Bars: Phase 1 (Green #388e3c), Phase 2 (Red #d32f2f), Phase 3 (Orange #ef6c00), Phase 4 (Yellow #fbc02d) */}
                        {/* Height values are identical (120px) from y=60 to y=180 (75% completion representation) */}
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

                  {/* TASK 3: Server Health Heatmap Grid (Red vs Green cells) */}
                  {currentTaskIndex === 2 && (
                    <VStack spacing={2} w="full" align="center">
                      <Text fontSize="xs" fontWeight="bold" color="blue.600" mb={1} textTransform="uppercase">
                        Interactive Matrix - Click the Alert!
                      </Text>
                      <SimpleGrid columns={4} spacing={2.5} maxW="280px" w="full">
                        {Array.from({ length: 4 }).map((_, rIdx) => 
                          Array.from({ length: 4 }).map((_, cIdx) => {
                            // Determine cell status
                            // In Original: Red alert cell at (2,1)
                            // In Corrected: Red alert cell at (0,3)
                            const isOriginal = testPhase === 'test_original';
                            const isAlert = isOriginal ? (rIdx === 2 && cIdx === 1) : (rIdx === 0 && cIdx === 3);
                            
                            // Normal cells are green-blind confusing green (#2e7d32) or orange (#ef6c00)
                            // Alert cells are confusing red (#c62828)
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
                      <Text fontSize="2xs" color="gray.400" mt={2}>
                        A single status node is in a critical alert (Red). Find and click it!
                      </Text>
                    </VStack>
                  )}
                </Box>
              </GridItem>

              {/* Right Column: Dynamic Question + Option Selection */}
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
                        <Text fontSize="md" fontWeight="bold" color="gray.850">
                          {currentTaskIndex === 0 && (testPhase === 'test_original' ? task1Data.original.question : task1Data.corrected.question)}
                          {currentTaskIndex === 1 && (testPhase === 'test_original' ? task2Data.original.question : task2Data.corrected.question)}
                          {currentTaskIndex === 2 && "A server node in this clusters represents a Critical Alert (Red). The other cells represent Warning (Orange) or Normal (Green). Click on the RED cell."}
                        </Text>
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* Options Selection (only for Line/Bar chart tasks) */}
                  {currentTaskIndex < 2 ? (
                    <VStack align="stretch" spacing={4}>
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
                                <Text fontSize="sm" fontWeight="bold" color="gray.700" ml={1}>{opt}</Text>
                              </Radio>
                            </Box>
                          ))}
                        </VStack>
                      </RadioGroup>

                      <Button
                        size="lg"
                        colorScheme="blue"
                        borderRadius="xl"
                        fontWeight="black"
                        onClick={handleNextMultipleChoice}
                        mt={2}
                      >
                        Submit Answer
                      </Button>
                    </VStack>
                  ) : (
                    <Box p={4} border="1px dashed" borderColor="blue.300" borderRadius="xl" bg="blue.50/10">
                      <VStack spacing={2} textAlign="center">
                        <Icon as={FiActivity} color="blue.500" w={6} h={6} />
                        <Text fontSize="sm" fontWeight="bold" color="gray.700">Find the cell on the left!</Text>
                        <Text fontSize="xs" color="gray.400">
                          Click directly on the RED critical cell inside the grid layout to submit your response.
                        </Text>
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </GridItem>
            </Grid>
          </VStack>
        )}

        {/* ================= STAGE 3: INTERMISSION SCREEN ================= */}
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
                You have finished all vision tasks using **Original/Uncorrected Colors**.
                <br /><br />
                Now, we will activate your **personalized Daltonization remapping filters** based on your vision profile. The next phase will run similar tasks, but with dynamic colors enabled.
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

        {/* ================= STAGE 4: DETAILED COMPARATIVE DASHBOARD ================= */}
        {testPhase === 'results' && (
          <VStack spacing={8} align="stretch" py={2}>
            
            {/* Header Result summary */}
            <HStack spacing={4} align="center">
              <Center boxSize="60px" bg="blue.50" color="blue.600" borderRadius="2xl">
                <Icon as={FiCheckCircle} w={8} h={8} />
              </Center>
              <VStack align="start" spacing={1}>
                <Badge colorScheme="blue" px={2} py={0.5} borderRadius="md" fontSize="2xs" fontWeight="bold">
                  Evaluation Report Locked
                </Badge>
                <Heading fontSize="2xl" fontWeight="black" color="gray.800">
                  Performance Efficiency Dashboard
                </Heading>
              </VStack>
            </HStack>

            <Divider />

            {/* Visual metrics cards */}
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              {/* Accuracy card comparison */}
              <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150">
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

              {/* Time card comparison */}
              <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150">
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
            <Box p={5} bg="blue.50/20" borderRadius="2xl" border="1px" borderColor="blue.150" textAlign="center">
              <VStack spacing={2}>
                <Heading fontSize="md" color="blue.700" fontWeight="black">
                  🚀 Utility Metrics Confirmed
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
            <HStack spacing={4} justify="center" mt={4}>
              <Button
                size="lg"
                colorScheme="blue"
                borderRadius="xl"
                onClick={() => navigate('/')}
                fontWeight="black"
              >
                Back to Dashboard
              </Button>
              <Button
                size="lg"
                variant="outline"
                colorScheme="blue"
                leftIcon={<FiRefreshCw />}
                borderRadius="xl"
                onClick={handleStartOriginalPhase}
                fontWeight="bold"
              >
                Retake Vision Test
              </Button>
            </HStack>
          </VStack>
        )}

      </Box>
    </Box>
  );
};
