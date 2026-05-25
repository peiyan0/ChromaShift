import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  Divider,
  Progress,
  Badge,
  Spinner,
  Button,
  useToast,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Alert,
  AlertIcon,
  Center,
  Code
} from '@chakra-ui/react';
import { FiRefreshCw, FiUsers, FiClock, FiHeart, FiSettings, FiActivity, FiSmile, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';
import api from '../services/api';

// SVG Icons
const AnalyticsIcon = () => (
  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-purple-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v16.5A2.25 2.25 0 006 21.75h16.5M9 7.5l3 3 6-6M18 12v.008H18V12zm0 3v.008H18V15zm0 3v.008H18V18z" />
  </svg>
);

export const AdminAnalytics: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const toast = useToast();

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, participantsRes] = await Promise.all([
        api.get('research/analytics'),
        api.get('research/participants')
      ]);
      setData(analyticsRes.data);
      setParticipants(participantsRes.data);
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || 'Failed to fetch administrator research data.');
      toast({
        title: "Access Denied",
        description: "Only authenticated administrators can view these analytics.",
        status: "error",
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <Center minH="450px" w="full">
        <VStack spacing={4}>
          <Spinner size="xl" color="purple.500" thickness="4px" />
          <Text fontSize="sm" color="gray.500" fontWeight="bold">Assembling Research Analytics...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center minH="400px" w="full">
        <VStack spacing={5} maxW="md" textAlign="center" p={6}>
          <Icon as={FiAlertCircle} w={12} h={12} color="red.500" />
          <Heading fontSize="xl" fontWeight="black" color="gray.800">Administrator Credentials Required</Heading>
          <Text fontSize="sm" color="gray.500">
            This workspace section stores protected medical, demographics, and workload performance research data. It is restricted strictly to root developers.
          </Text>
          <Alert status="error" borderRadius="xl">
            <AlertIcon />
            {error}
          </Alert>
          <Button colorScheme="blue" borderRadius="xl" onClick={fetchAnalytics}>
            Retry Authentication
          </Button>
        </VStack>
      </Center>
    );
  }

  if (!data || data.total_participants === 0) {
    return (
      <Center minH="400px" w="full">
        <VStack spacing={4} p={8} textAlign="center">
          <Icon as={FiUsers} w={12} h={12} color="gray.400" />
          <Heading fontSize="xl" fontWeight="black" color="gray.700">No Research Data Logged Yet</Heading>
          <Text fontSize="sm" color="gray.500" maxW="sm">
            Once participants complete the official Guided Study Session, telemetry metrics and usability indexes will appear here automatically.
          </Text>
          <Button colorScheme="purple" borderRadius="xl" onClick={fetchAnalytics} leftIcon={<FiRefreshCw />}>
            Check for Entries
          </Button>
        </VStack>
      </Center>
    );
  }

  const sus = data.avg_sus_score;
  const susGrade = sus >= 80.3 ? 'A (Excellent)' : sus >= 68.0 ? 'C (Acceptable / Good)' : 'F (Needs Improvement)';
  const susColor = sus >= 80.3 ? 'green' : sus >= 68.0 ? 'blue' : 'red';

  return (
    <Box className="w-full max-w-6xl mx-auto mt-6 p-1 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 rounded-3xl shadow-2xl">
      <Box className="w-full h-full p-8 bg-white/98 backdrop-blur-xl rounded-[22px] border border-white/50 space-y-8">
        
        {/* Dashboard Header */}
        <HStack justify="space-between" align="center">
          <HStack spacing={4}>
            <Center boxSize="60px" bg="purple.50" color="purple.600" borderRadius="2xl shadow-inner">
              <AnalyticsIcon />
            </Center>
            <VStack align="start" spacing={0.5}>
              <Badge colorScheme="purple" px={2} py={0.5} borderRadius="md" fontSize="2xs" fontWeight="bold">
                Admin Control Panel
              </Badge>
              <Heading fontSize="2xl" fontWeight="black" color="gray.850">
                Research & Telemetry Analytics
              </Heading>
            </VStack>
          </HStack>
          <Button variant="outline" colorScheme="purple" onClick={fetchAnalytics} leftIcon={<FiRefreshCw />} borderRadius="xl">
            Sync Telemetry
          </Button>
        </HStack>

        <Divider />

        {/* Level 1: Overview Scorecards */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          {/* Card 1: Total Subjects */}
          <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" bg="purple.50/5">
            <CardBody className="space-y-2 p-6">
              <HStack color="purple.600">
                <Icon as={FiUsers} />
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Total Participants</Text>
              </HStack>
              <Heading fontSize="4xl" fontWeight="black" color="purple.600">
                {data.total_participants}
              </Heading>
              <Text fontSize="2xs" color="gray.400">Total verified logged subjects in PostgreSQL</Text>
            </CardBody>
          </Card>

          {/* Card 2: System Usability Scale (SUS) */}
          <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" bg="blue.50/5">
            <CardBody className="space-y-2 p-6">
              <HStack justify="space-between">
                <HStack color="blue.600">
                  <Icon as={FiSmile} />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">System Usability (SUS)</Text>
                </HStack>
                <Badge colorScheme={susColor} borderRadius="md">{susGrade}</Badge>
              </HStack>
              <Heading fontSize="4xl" fontWeight="black" color="blue.600">
                {sus.toFixed(1)} <Text as="span" fontSize="lg" fontWeight="normal" color="gray.400">/ 100</Text>
              </Heading>
              <Text fontSize="2xs" color="gray.400">Industry benchmark: 68.0 average usability</Text>
            </CardBody>
          </Card>

          {/* Card 3: Visual Comfort Delta */}
          <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" bg="green.50/5">
            <CardBody className="space-y-2 p-6">
              <HStack color="green.600">
                <Icon as={FiHeart} />
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Comfort Index</Text>
              </HStack>
              <Heading fontSize="4xl" fontWeight="black" color="green.600">
                {data.visual_comfort.remapped_comfort?.toFixed(1)} <Text as="span" fontSize="lg" fontWeight="normal" color="gray.400">/ 5.0</Text>
              </Heading>
              <Text fontSize="2xs" color="gray.400">Average remapped media comfort level rating</Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Level 2: Performance Delta (Stopwatch speedups) */}
        <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" p={2}>
          <CardBody className="space-y-6">
            <HStack spacing={2} color="indigo.600" fontWeight="bold">
              <Icon as={FiClock} />
              <Text fontSize="sm" textTransform="uppercase">Programmatic Speed & Accuracy Gains (Original vs. Corrected)</Text>
            </HStack>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 5 }} spacing={4}>
              {Object.keys(data.task_performance).map((taskKey) => {
                const task = data.task_performance[taskKey];
                const speedup = task.avg_original_time > 0 ? (task.avg_original_time / task.avg_corrected_time).toFixed(1) : '1.0';
                
                return (
                  <Box 
                    key={taskKey} 
                    className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between space-y-4"
                  >
                    <Badge colorScheme="indigo" alignSelf="flex-start" className="capitalize">
                      {taskKey === 'task1' && "Line Graph"}
                      {taskKey === 'task2' && "Bar Status"}
                      {taskKey === 'task3' && "Node Alerts"}
                      {taskKey === 'video' && "Video Tracking"}
                      {taskKey === 'document' && "PDF Shading"}
                    </Badge>

                    <VStack align="start" spacing={1}>
                      <Text fontSize="2xs" color="gray.400">Time (Orig vs Corr)</Text>
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">
                        {task.avg_original_time?.toFixed(1)}s <Text as="span" fontWeight="normal" color="gray.400">➔</Text> {task.avg_corrected_time?.toFixed(1)}s
                      </Text>
                    </VStack>

                    <VStack align="start" spacing={1}>
                      <Text fontSize="2xs" color="gray.400">Accuracy (Orig vs Corr)</Text>
                      <Text fontSize="sm" fontWeight="bold" color="gray.700">
                        {Math.round(task.avg_original_accuracy * 100)}% <Text as="span" fontWeight="normal" color="gray.400">➔</Text> {Math.round(task.avg_corrected_accuracy * 100)}%
                      </Text>
                    </VStack>

                    <Badge colorScheme="green" variant="solid" alignSelf="center" w="full" textAlign="center" borderRadius="md" py={0.5} fontSize="xs">
                      {speedup}x Faster
                    </Badge>
                  </Box>
                );
              })}
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Level 3: Workloads (NASA TLX) & Demographics Splits */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* NASA TLX Card */}
          <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" p={2}>
            <CardBody className="space-y-4">
              <HStack spacing={2} color="orange.600" fontWeight="bold">
                <Icon as={FiActivity} />
                <Text fontSize="xs" textTransform="uppercase">Average NASA Task Load workload (0 to 20)</Text>
              </HStack>
              
              <Divider />

              <VStack spacing={4} align="stretch" pt={2}>
                <Box>
                  <HStack justify="space-between" fontSize="xs" mb={1}>
                    <Text fontWeight="bold" color="gray.600">Mental Demand (Problem Solving)</Text>
                    <Text fontWeight="black" color="orange.600">{data.nasa_tlx.mental?.toFixed(1)} / 20</Text>
                  </HStack>
                  <Progress value={(data.nasa_tlx.mental / 20) * 100} size="sm" colorScheme="orange" borderRadius="full" />
                </Box>

                <Box>
                  <HStack justify="space-between" fontSize="xs" mb={1}>
                    <Text fontWeight="bold" color="gray.600">Physical Demand (Eye Strain)</Text>
                    <Text fontWeight="black" color="orange.600">{data.nasa_tlx.physical?.toFixed(1)} / 20</Text>
                  </HStack>
                  <Progress value={(data.nasa_tlx.physical / 20) * 100} size="sm" colorScheme="orange" borderRadius="full" />
                </Box>

                <Box>
                  <HStack justify="space-between" fontSize="xs" mb={1}>
                    <Text fontWeight="bold" color="gray.600">Temporal Demand (Rushed Feeling)</Text>
                    <Text fontWeight="black" color="orange.600">{data.nasa_tlx.temporal?.toFixed(1)} / 20</Text>
                  </HStack>
                  <Progress value={(data.nasa_tlx.temporal / 20) * 100} size="sm" colorScheme="orange" borderRadius="full" />
                </Box>

                <Box>
                  <HStack justify="space-between" fontSize="xs" mb={1}>
                    <Text fontWeight="bold" color="gray.600">Overall Effort</Text>
                    <Text fontWeight="black" color="orange.600">{data.nasa_tlx.effort?.toFixed(1)} / 20</Text>
                  </HStack>
                  <Progress value={(data.nasa_tlx.effort / 20) * 100} size="sm" colorScheme="orange" borderRadius="full" />
                </Box>

                <Box>
                  <HStack justify="space-between" fontSize="xs" mb={1}>
                    <Text fontWeight="bold" color="gray.600">Frustration Level</Text>
                    <Text fontWeight="black" color="orange.600">{data.nasa_tlx.frustration?.toFixed(1)} / 20</Text>
                  </HStack>
                  <Progress value={(data.nasa_tlx.frustration / 20) * 100} size="sm" colorScheme="red" borderRadius="full" />
                </Box>
              </VStack>
            </CardBody>
          </Card>

          {/* Demographics table */}
          <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" p={2}>
            <CardBody className="space-y-4">
              <HStack spacing={2} color="blue.600" fontWeight="bold">
                <Icon as={FiUsers} />
                <Text fontSize="xs" textTransform="uppercase">CVD Demographics Distributions</Text>
              </HStack>

              <Divider />

              <SimpleGrid columns={2} spacing={4} pt={2}>
                <Box className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                  <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={3} textTransform="uppercase">Color Blindness Types</Text>
                  <VStack align="stretch" spacing={2.5}>
                    {Object.keys(data.demographics.cvd_types).map(cvd => (
                      <HStack key={cvd} justify="space-between" fontSize="sm">
                        <Text className="capitalize" color="gray.700" fontWeight="semibold">{cvd}</Text>
                        <Badge colorScheme="blue" borderRadius="lg" px={2}>{data.demographics.cvd_types[cvd]}</Badge>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                <Box className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                  <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={3} textTransform="uppercase">Genders</Text>
                  <VStack align="stretch" spacing={2.5}>
                    {Object.keys(data.demographics.genders).map(gen => (
                      <HStack key={gen} justify="space-between" fontSize="sm">
                        <Text className="capitalize" color="gray.700" fontWeight="semibold">{gen}</Text>
                        <Badge colorScheme="blue" borderRadius="lg" px={2}>{data.demographics.genders[gen]}</Badge>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Level 4: Scrollable list of Qualitative feedback */}
        <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" p={2}>
          <CardBody className="space-y-4">
            <HStack spacing={2} color="purple.600" fontWeight="bold">
              <Icon as={FiMessageSquare} />
              <Text fontSize="xs" textTransform="uppercase">Participant self-reported qualitative interview notes</Text>
            </HStack>
            
            <Divider />

            <VStack spacing={4} align="stretch" maxH="300px" overflowY="auto" pr={2}>
              {data.interview_feedback.map((f: any, idx: number) => (
                <Box key={idx} className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-3 font-sans border border-slate-800">
                  <HStack justify="space-between" borderBottom="1px solid" borderColor="slate.700" pb={2}>
                    <Text fontSize="xs" fontWeight="bold" color="purple.400">Subject `{f.participant_uuid}`</Text>
                    <Badge colorScheme="purple">Verification Passed</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} fontSize="xs">
                    <Box><Text color="slate.400" fontWeight="bold" mb={0.5}>Flicker/Transitions:</Text> <Text color="slate.200">{f.wizard_feedback || 'No comments'}</Text></Box>
                    <Box><Text color="slate.400" fontWeight="bold" mb={0.5}>Color Fidelity:</Text> <Text color="slate.200">{f.comfort_feedback || 'No comments'}</Text></Box>
                    <Box><Text color="slate.400" fontWeight="bold" mb={0.5}>Wizard/Onboarding:</Text> <Text color="slate.200">{f.wizard_feedback || 'No comments'}</Text></Box>
                    <Box><Text color="slate.400" fontWeight="bold" mb={0.5}>Frustrations:</Text> <Text color="slate.200" className="text-red-400">{f.frustrating || 'None'}</Text></Box>
                  </SimpleGrid>
                  <Box borderTop="1px dashed" borderColor="slate.800" pt={2} fontSize="xs">
                    <Text color="purple.300" fontWeight="bold" mb={0.5}>Surprise Discoveries & Recommendations:</Text>
                    <Text color="emerald.300" fontStyle="italic">"{f.general || 'No recommendations'}"</Text>
                  </Box>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Level 5: Table of Individual Participant UUIDs */}
        <Card variant="outline" borderRadius="2xl" border="1px" borderColor="gray.150" p={2}>
          <CardBody className="space-y-4">
            <HStack spacing={2} color="indigo.600" fontWeight="bold">
              <Icon as={FiSettings} />
              <Text fontSize="xs" textTransform="uppercase">Historical telemetry intake registry</Text>
            </HStack>

            <Divider />

            <Box overflowX="auto">
              <Table variant="simple" size="sm" colorScheme="gray">
                <Thead>
                  <Tr>
                    <Th>Participant UUID</Th>
                    <Th>Age</Th>
                    <Th>Gender</Th>
                    <Th>CVD Type</Th>
                    <Th>Diagnosed Status</Th>
                    <Th>Prior Tool</Th>
                    <Th>Intake Date</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {participants.map((p) => (
                    <Tr key={p.uuid}>
                      <Td><Code fontSize="2xs">{p.uuid}</Code></Td>
                      <Td>{p.age}</Td>
                      <Td className="capitalize">{p.gender}</Td>
                      <Td className="capitalize">{p.cvd_type}</Td>
                      <Td>{p.is_diagnosed}</Td>
                      <Td className="capitalize">{p.prior_tool_use}</Td>
                      <Td fontSize="2xs" color="gray.500">{new Date(p.created_at).toLocaleDateString()}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>

      </Box>
    </Box>
  );
};
