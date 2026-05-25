import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Radio,
  RadioGroup,
  Stack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Textarea,
  SimpleGrid,
  Divider,
  Progress,
  Badge,
  useToast,
  Card,
  CardBody
} from '@chakra-ui/react';
import api from '../services/api';

// SVG Icons
const StudyIcon = () => (
  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-blue-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const SuccessIcon = () => (
  <svg width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-green-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface SurveyWizardProps {
  performanceMetrics: any;
  onComplete: (participantUuid: string) => void;
  onBackToApp?: () => void;
}

export const SurveyWizard: React.FC<SurveyWizardProps> = ({ performanceMetrics, onComplete, onBackToApp }) => {
  const [step, setStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const toast = useToast();

  // 1. Demographics States
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [occupation, setOccupation] = useState<string>('');
  const [education, setEducation] = useState<string>("Bachelor's");
  const [cvdType, setCvdType] = useState<string>('Deuteran');
  const [diagnosed, setDiagnosed] = useState<string>('Yes');
  const [priorTools, setPriorTools] = useState<string>('None');
  const [glassesFreq, setGlassesFreq] = useState<string>('Never');
  const [appComfort, setAppComfort] = useState<string>('Comf.');
  const [deviceFreq, setDeviceFreq] = useState<string>('15-30 hrs');

  // 2. SUS States (1 = Strongly Disagree, 5 = Strongly Agree)
  const [sus, setSus] = useState<Record<string, number>>({
    q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3, q8: 3, q9: 3, q10: 3
  });

  // 3. NASA TLX (0 to 20 scale)
  const [nasaMental, setNasaMental] = useState<number>(10);
  const [nasaPhysical, setNasaPhysical] = useState<number>(10);
  const [nasaTemporal, setNasaTemporal] = useState<number>(10);
  const [nasaPerformance, setNasaPerformance] = useState<number>(10);
  const [nasaEffort, setNasaEffort] = useState<number>(10);
  const [nasaFrustration, setNasaFrustration] = useState<number>(10);

  // 4. Custom Visual Comfort (1 to 5 scale)
  const [comfortQ1, setComfortQ1] = useState<number>(3);
  const [comfortQ2, setComfortQ2] = useState<number>(3);
  const [comfortQ3, setComfortQ3] = useState<number>(3);
  const [comfortQ4, setComfortQ4] = useState<number>(3);
  const [comfortQ5, setComfortQ5] = useState<number>(3);

  // 5. Qualitative Feedback
  const [visualTransitions, setVisualTransitions] = useState<string>('');
  const [naturalness, setNaturalness] = useState<string>('');
  const [onboardingWizard, setOnboardingWizard] = useState<string>('');
  const [frustratingAspects, setFrustratingAspects] = useState<string>('');
  const [helpfulAspects, setHelpfulAspects] = useState<string>('');
  const [openFeedback, setOpenFeedback] = useState<string>('');

  const totalSteps = 6;
  const progressPercent = (step / totalSteps) * 100;

  const handleSusChange = (question: string, val: number) => {
    setSus(prev => ({ ...prev, [question]: val }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const payload = {
      demographics: {
        age: age ? parseInt(age, 10) : null,
        gender,
        occupation,
        education_level: education,
        cvd_type: cvdType,
        is_diagnosed: diagnosed,
        prior_tool_use: priorTools,
        color_glasses_frequency: glassesFreq,
        web_app_comfort: appComfort,
        device_use_frequency: deviceFreq
      },
      performance: performanceMetrics || {
        task1: null,
        task2: null,
        task3: null,
        video: null,
        document: null
      },
      surveys: {
        sus_q1: sus.q1,
        sus_q2: sus.q2,
        sus_q3: sus.q3,
        sus_q4: sus.q4,
        sus_q5: sus.q5,
        sus_q6: sus.q6,
        sus_q7: sus.q7,
        sus_q8: sus.q8,
        sus_q9: sus.q9,
        sus_q10: sus.q10,
        
        nasa_mental: nasaMental,
        nasa_physical: nasaPhysical,
        nasa_temporal: nasaTemporal,
        nasa_performance: nasaPerformance,
        nasa_effort: nasaEffort,
        nasa_frustration: nasaFrustration,
        
        comfort_q1: comfortQ1,
        comfort_q2: comfortQ2,
        comfort_q3: comfortQ3,
        comfort_q4: comfortQ4,
        comfort_q5: comfortQ5,
        
        interview_visual_transitions: visualTransitions,
        interview_naturalness: naturalness,
        interview_wizard_onboarding: onboardingWizard,
        interview_frustrating_aspects: frustratingAspects,
        interview_helpful_aspects: helpfulAspects,
        interview_open_feedback: openFeedback
      }
    };

    try {
      // Direct call to research submit
      const res = await api.post('research/submit', payload);
      const participantUuid = res.data.participant_uuid;
      toast({
        title: "Session Submitted!",
        description: "Your survey and test results have been registered securely.",
        status: "success",
        duration: 4000
      });
      onComplete(participantUuid);
    } catch (e) {
      toast({
        title: "Submission Error",
        description: "Failed to upload study metrics to the central research database.",
        status: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const susQuestions = [
    { key: "q1", label: "I would use ChomaShift frequently." },
    { key: "q2", label: "I found the platform easy to use." },
    { key: "q3", label: "I was able to learn how to use the platform quickly." },
    { key: "q4", label: "The functions were well integrated." },
    { key: "q5", label: "I felt very confident using the platform." },
    { key: "q6", label: "The calibration wizard accurately captured how I see colors." },
    { key: "q7", label: "The remapped colors looked natural and believable." },
    { key: "q8", label: "The platform helped me distinguish colors that I normally cannot see." },
    { key: "q9", label: "I completed tasks faster with the remapped view vs. original." },
    { key: "q10", label: "I would need to learn a lot before using this platform effectively." }
  ];

  return (
    <Box className="w-full max-w-4xl mx-auto p-1 bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-700 rounded-3xl shadow-2xl mt-4">
      <Box className="w-full h-full p-8 bg-white/95 backdrop-blur-xl rounded-[22px] border border-white/50">
        
        {/* Navigation Step Header */}
        {step > 0 && (
          <Box mb={6}>
            <HStack justify="space-between" mb={2}>
              <Badge colorScheme="blue" borderRadius="lg" px={3} py={1} fontSize="xs" fontWeight="bold">
                Step {step} of {totalSteps}
              </Badge>
              <Text fontSize="xs" fontWeight="bold" color="gray.400">
                {step === 1 && "Demographics Intake"}
                {step === 2 && "System Usability Scale (SUS)"}
                {step === 3 && "NASA Task Load Index"}
                {step === 4 && "Visual Comfort Scale"}
                {step === 5 && "Open-Ended Interview Logs"}
                {step === 6 && "Summary & Verification"}
              </Text>
            </HStack>
            <Progress value={progressPercent} size="xs" colorScheme="blue" borderRadius="full" />
          </Box>
        )}

        {/* Step 0: Welcome and Consent */}
        {step === 0 && (
          <VStack spacing={8} py={6} align="center" textAlign="center">
            <StudyIcon />
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text">
                ChomaShift Usability & Research Study
              </Heading>
              <Text fontSize="md" color="gray.600" maxW="2xl">
                Thank you for participating! This study evaluates how real-time Daltonization remap filters affect visual strain, accuracy, and task-load speeds for users with Color Vision Deficiency (CVD).
              </Text>
            </VStack>

            <Card variant="outline" w="full" maxW="2xl" borderRadius="2xl" bg="gray.50/50">
              <CardBody className="text-left space-y-4 p-6" fontSize="sm" color="gray.600">
                <Text fontWeight="bold" color="gray.800">Research & Data Policy:</Text>
                <Text>• Your demographic profile, test stopwatch times, and questionnaire answers are saved to a secured database.</Text>
                <Text>• **Privacy First**: All survey outputs are strictly isolated. No regular users (including yourself) can read or query these logs. They are reserved entirely for administrator analysis.</Text>
                <Text>• It takes about 8–10 minutes to complete the official guided research session.</Text>
              </CardBody>
            </Card>

            <HStack spacing={4}>
              {onBackToApp && (
                <Button variant="outline" size="lg" borderRadius="xl" onClick={onBackToApp}>
                  Return to Dashboard
                </Button>
              )}
              <Button
                size="lg"
                px={10}
                colorScheme="blue"
                bgGradient="linear(to-r, blue.500, purple.600)"
                _hover={{ bgGradient: "linear(to-r, blue.600, purple.700)" }}
                borderRadius="xl"
                onClick={nextStep}
                shadow="lg"
              >
                Accept & Begin Study Session
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 1: Pre-Task Demographics & self-report */}
        {step === 1 && (
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading fontSize="xl" fontWeight="black" color="gray.800">
                Pre-Task Demographics Intake
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Provide brief baseline parameters before starting active vision tasks.
              </Text>
            </Box>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="bold">Age (years)</FormLabel>
                <Input
                  type="number"
                  placeholder="e.g. 25"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  borderRadius="xl"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Gender</FormLabel>
                <Select value={gender} onChange={e => setGender(e.target.value)} borderRadius="xl">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="bold">Occupation / Field of Study</FormLabel>
                <Input
                  placeholder="e.g. Design, Bio, Finance"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  borderRadius="xl"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Education Level</FormLabel>
                <Select value={education} onChange={e => setEducation(e.target.value)} borderRadius="xl">
                  <option value="High School">High School</option>
                  <option value="Bachelor's">Bachelor's</option>
                  <option value="Master's">Master's</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Color Blindness (CVD) Type</FormLabel>
                <Select value={cvdType} onChange={e => setCvdType(e.target.value)} borderRadius="xl">
                  <option value="Deuteran">Green-weak (Deuteran / Deuteranomaly)</option>
                  <option value="Protan">Red-weak (Protan / Protanopia)</option>
                  <option value="Tritan">Blue-weak (Tritan / Tritanopia)</option>
                  <option value="Unsure">Unsure / Not diagnosed</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Is this Formally Diagnosed?</FormLabel>
                <Select value={diagnosed} onChange={e => setDiagnosed(e.target.value)} borderRadius="xl">
                  <option value="Yes">Yes (By eye professional)</option>
                  <option value="No">No</option>
                  <option value="Strong Suspicion">Strong Suspicion / Family history</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Prior CVD Correction Tool Usage</FormLabel>
                <Select value={priorTools} onChange={e => setPriorTools(e.target.value)} borderRadius="xl">
                  <option value="None">None</option>
                  <option value="EnChroma">EnChroma Glasses</option>
                  <option value="Pilestone">Pilestone Glasses</option>
                  <option value="Other">Other digital filters / apps</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Do you regularly wear color glasses?</FormLabel>
                <Select value={glassesFreq} onChange={e => setGlassesFreq(e.target.value)} borderRadius="xl">
                  <option value="Never">Never</option>
                  <option value="Occasionally">Occasionally</option>
                  <option value="Regularly">Regularly / Every day</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Web Application Comfort Level</FormLabel>
                <Select value={appComfort} onChange={e => setAppComfort(e.target.value)} borderRadius="xl">
                  <option value="Very Uncomf.">Very Uncomfortable</option>
                  <option value="Uncomf.">Uncomfortable</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Comf.">Comfortable</option>
                  <option value="Very Comf.">Very Comfortable</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">Weekly Computer / Screen Use</FormLabel>
                <Select value={deviceFreq} onChange={e => setDeviceFreq(e.target.value)} borderRadius="xl">
                  <option value="<5 hrs/week">&lt; 5 hours/week</option>
                  <option value="5-15 hrs">5–15 hours/week</option>
                  <option value="15-30 hrs">15–30 hours/week</option>
                  <option value=">30 hrs">&gt; 30 hours/week</option>
                </Select>
              </FormControl>
            </SimpleGrid>

            <HStack justify="end" pt={6} spacing={4}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Back
              </Button>
              <Button
                colorScheme="blue"
                size="lg"
                borderRadius="xl"
                onClick={nextStep}
                isDisabled={!age || !occupation}
              >
                Proceed to Usability Scale
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 2: System Usability Scale (SUS) */}
        {step === 2 && (
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading fontSize="xl" fontWeight="black" color="gray.800">
                System Usability Scale (SUS)
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Rate your agreement with each statement. 1 = Strongly Disagree, 5 = Strongly Agree.
              </Text>
            </Box>

            <Divider />

            <VStack spacing={5} align="stretch" maxH="450px" overflowY="auto" pr={2}>
              {susQuestions.map((q, idx) => (
                <Box key={q.key} className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
                  <Text fontSize="sm" fontWeight="bold" color="gray.700" mb={3}>
                    {idx + 1}. {q.label}
                  </Text>
                  <RadioGroup 
                    value={sus[q.key].toString()} 
                    onChange={v => handleSusChange(q.key, parseInt(v, 10))}
                  >
                    <Stack direction="row" spacing={{ base: 4, sm: 8 }} justify="center">
                      <Radio value="1" colorScheme="blue"><Text fontSize="xs">1 (Strongly Disagree)</Text></Radio>
                      <Radio value="2" colorScheme="blue"><Text fontSize="xs">2</Text></Radio>
                      <Radio value="3" colorScheme="blue"><Text fontSize="xs">3</Text></Radio>
                      <Radio value="4" colorScheme="blue"><Text fontSize="xs">4</Text></Radio>
                      <Radio value="5" colorScheme="blue"><Text fontSize="xs">5 (Strongly Agree)</Text></Radio>
                    </Stack>
                  </RadioGroup>
                </Box>
              ))}
            </VStack>

            <HStack justify="space-between" pt={6}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Back
              </Button>
              <Button colorScheme="blue" size="lg" borderRadius="xl" onClick={nextStep}>
                Proceed to Task Load Index
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 3: NASA Task Load Index */}
        {step === 3 && (
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading fontSize="xl" fontWeight="black" color="gray.800">
                NASA Task Load Index (Workload Metrics)
              </Heading>
              <Text fontSize="sm" color="gray.500">
                For each dimension, rate your experience from 0 (Very Low) to 20 (Very High).
              </Text>
            </Box>

            <Divider />

            <VStack spacing={6} align="stretch">
              {/* Mental Demand */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Mental Demand</Text>
                  <Text fontWeight="black" color="blue.600">{nasaMental} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How mentally demanding were the tasks? (e.g. complex thinking, color problem-solving, legend mapping)
                </Text>
                <Slider min={0} max={20} step={1} value={nasaMental} onChange={setNasaMental} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Physical Demand */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Physical Demand (Eye Strain)</Text>
                  <Text fontWeight="black" color="blue.600">{nasaPhysical} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How physically demanding were the tasks? (specifically squinting, focusing effort, headache development)
                </Text>
                <Slider min={0} max={20} step={1} value={nasaPhysical} onChange={setNasaPhysical} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Temporal Demand */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Temporal Demand</Text>
                  <Text fontWeight="black" color="blue.600">{nasaTemporal} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How hurried or rushed did you feel while performing the tasks under the stopwatch?
                </Text>
                <Slider min={0} max={20} step={1} value={nasaTemporal} onChange={setNasaTemporal} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Performance */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Successful Performance</Text>
                  <Text fontWeight="black" color="blue.600">{nasaPerformance} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How successful do you think you were in completing the tasks? (accuracy of legend identification and tracking)
                </Text>
                <Slider min={0} max={20} step={1} value={nasaPerformance} onChange={setNasaPerformance} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Effort */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Overall Effort</Text>
                  <Text fontWeight="black" color="blue.600">{nasaEffort} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How hard did you have to work (both mentally and physically) to achieve your level of performance?
                </Text>
                <Slider min={0} max={20} step={1} value={nasaEffort} onChange={setNasaEffort} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Frustration */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm" color="gray.700">Frustration Level</Text>
                  <Text fontWeight="black" color="blue.600">{nasaFrustration} / 20</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mb={2}>
                  How insecure, discouraged, irritated, or annoyed did you feel during the tasks?
                </Text>
                <Slider min={0} max={20} step={1} value={nasaFrustration} onChange={setNasaFrustration} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>
            </VStack>

            <HStack justify="space-between" pt={6}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Back
              </Button>
              <Button colorScheme="blue" size="lg" borderRadius="xl" onClick={nextStep}>
                Proceed to Comfort Scale
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 4: Custom Visual Comfort Scale */}
        {step === 4 && (
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading fontSize="xl" fontWeight="black" color="gray.800">
                Visual Comfort Assessment
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Rate your agreement with each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).
              </Text>
            </Box>

            <Divider />

            <VStack spacing={6}>
              {/* Comfort Q1 */}
              <Box w="full">
                <HStack justify="space-between" mb={1} fontSize="sm">
                  <Text fontWeight="bold" color="gray.700">My eyes felt comfortable throughout the session.</Text>
                  <Text fontWeight="black" color="blue.600">{comfortQ1} / 5</Text>
                </HStack>
                <Slider min={1} max={5} step={1} value={comfortQ1} onChange={setComfortQ1} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Comfort Q2 */}
              <Box w="full">
                <HStack justify="space-between" mb={1} fontSize="sm">
                  <Text fontWeight="bold" color="gray.700">I experienced eye strain, dry eyes, or ocular fatigue.</Text>
                  <Text fontWeight="black" color="blue.600">{comfortQ2} / 5</Text>
                </HStack>
                <Slider min={1} max={5} step={1} value={comfortQ2} onChange={setComfortQ2} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Comfort Q3 */}
              <Box w="full">
                <HStack justify="space-between" mb={1} fontSize="sm">
                  <Text fontWeight="bold" color="gray.700">I developed a headache during or after the comparative rounds.</Text>
                  <Text fontWeight="black" color="blue.600">{comfortQ3} / 5</Text>
                </HStack>
                <Slider min={1} max={5} step={1} value={comfortQ3} onChange={setComfortQ3} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Comfort Q4 */}
              <Box w="full">
                <HStack justify="space-between" mb={1} fontSize="sm">
                  <Text fontWeight="bold" color="gray.700">The remapped media (Daltonized view) looked more comfortable to view than the original.</Text>
                  <Text fontWeight="black" color="blue.600">{comfortQ4} / 5</Text>
                </HStack>
                <Slider min={1} max={5} step={1} value={comfortQ4} onChange={setComfortQ4} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>

              {/* Comfort Q5 */}
              <Box w="full">
                <HStack justify="space-between" mb={1} fontSize="sm">
                  <Text fontWeight="bold" color="gray.700">I would use these active remapping settings for long screen/reading sessions.</Text>
                  <Text fontWeight="black" color="blue.600">{comfortQ5} / 5</Text>
                </HStack>
                <Slider min={1} max={5} step={1} value={comfortQ5} onChange={setComfortQ5} colorScheme="blue">
                  <SliderTrack><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={5} />
                </Slider>
              </Box>
            </VStack>

            <HStack justify="space-between" pt={6}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Back
              </Button>
              <Button colorScheme="blue" size="lg" borderRadius="xl" onClick={nextStep}>
                Proceed to Interview Notes
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 5: Qualitative Interview notes */}
        {step === 5 && (
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading fontSize="xl" fontWeight="black" color="gray.800">
                Self-Reported Interview & Feedback Logs
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Help us capture qualitative observations on transition delays, visual artifacts, or general utility.
              </Text>
            </Box>

            <Divider />

            <VStack spacing={5} align="stretch" maxH="450px" overflowY="auto" pr={2}>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  1. Did you experience any flickering, lag, or visual latency during transitions?
                </FormLabel>
                <Textarea
                  placeholder="Describe transition smooth/abrupt triggers"
                  value={visualTransitions}
                  onChange={e => setVisualTransitions(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  2. Was the remapped color contrast correction natural, wrong, or oversaturated?
                </FormLabel>
                <Textarea
                  placeholder="e.g. natural, looks weird, shifts are realistic"
                  value={naturalness}
                  onChange={e => setNaturalness(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  3. Was the 5-round Anomaloscope Calibration Wizard easy to understand?
                </FormLabel>
                <Textarea
                  placeholder="Wizard feedback, length in rounds, complexity"
                  value={onboardingWizard}
                  onChange={e => setOnboardingWizard(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  4. What was the most frustrating part of using the ChomaShift platform?
                </FormLabel>
                <Textarea
                  placeholder="Aspects that caused friction or confusion"
                  value={frustratingAspects}
                  onChange={e => setFrustratingAspects(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  5. What was the most helpful or surprising feature you discovered?
                </FormLabel>
                <Textarea
                  placeholder="Vibrant colors, line tracking speed improvement"
                  value={helpfulAspects}
                  onChange={e => setHelpfulAspects(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="bold">
                  6. Open-Ended Comments / Recommendations
                </FormLabel>
                <Textarea
                  placeholder="Suggestions for features, options, or changes"
                  value={openFeedback}
                  onChange={e => setOpenFeedback(e.target.value)}
                  borderRadius="xl"
                  rows={2}
                />
              </FormControl>
            </VStack>

            <HStack justify="space-between" pt={6}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Back
              </Button>
              <Button colorScheme="blue" size="lg" borderRadius="xl" onClick={nextStep}>
                Proceed to Verification
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Step 6: Summary & Verification */}
        {step === 6 && (
          <VStack spacing={8} py={6} align="center" textAlign="center">
            <SuccessIcon />
            <VStack spacing={3}>
              <Heading fontSize="3xl" fontWeight="black" color="green.600">
                Ready to Complete Study!
              </Heading>
              <Text fontSize="md" color="gray.600" maxW="2xl">
                All demographic fields, comparative performance stopwatch logs, and workload surveys have been successfully assembled.
              </Text>
            </VStack>

            <Divider />

            <VStack spacing={3} align="start" w="full" maxW="md" className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-left">
              <Text fontSize="sm" color="gray.600">**Age**: {age}</Text>
              <Text fontSize="sm" color="gray.600">**CVD Type**: {cvdType}</Text>
              <Text fontSize="sm" color="gray.600">**Formally Diagnosed**: {diagnosed}</Text>
              <Text fontSize="sm" color="gray.600">**Average SUS Confidence**: Rating registered</Text>
              <Text fontSize="sm" color="gray.600">**NASA Workload Score**: Rating registered</Text>
            </VStack>

            <HStack spacing={4}>
              <Button variant="outline" size="lg" borderRadius="xl" onClick={prevStep}>
                Verify Answers
              </Button>
              <Button
                size="lg"
                px={10}
                colorScheme="green"
                bgGradient="linear(to-r, green.500, teal.600)"
                _hover={{ bgGradient: "linear(to-r, green.600, teal.700)" }}
                borderRadius="xl"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                shadow="lg"
              >
                Submit Survey Results to Admin DB
              </Button>
            </HStack>
          </VStack>
        )}

      </Box>
    </Box>
  );
};
