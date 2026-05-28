import { useEffect, useState, type FC } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Badge,
  Box,
  Spinner,
  Center,
  Progress,
  Icon,
  useToast
} from '@chakra-ui/react';
import { complianceService, type ComplianceReportResponse } from '../services/compliance';
import api from '../services/api';

// SVG Icons
const WarningIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
  </Icon>
);

const ErrorIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
  </Icon>
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

export const ComplianceReportModal: FC<Props> = ({ isOpen, onClose, jobId }) => {
  const [report, setReport] = useState<ComplianceReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && jobId) {
      fetchReport();
    } else {
      setReport(null);
    }
  }, [isOpen, jobId]);

  const fetchReport = async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const data = await complianceService.getReport(jobId);
      setReport(data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Report doesn't exist yet, we will show the "Run Check" button
        setReport(null);
      } else {
        toast({ title: "Error fetching report", status: "error" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCheck = async () => {
    if (!jobId) return;
    setIsGenerating(true);
    try {
      const data = await complianceService.runCheck(jobId);
      setReport(data);
      toast({ title: "Audit Complete", status: "success" });
    } catch (error) {
      toast({ title: "Audit Failed", status: "error" });
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
      toast({ title: "Export Failed", status: "error" });
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'Error') return <ErrorIcon color="red.500" w={5} h={5} />;
    if (severity === 'Warning') return <WarningIcon color="orange.500" w={5} h={5} />;
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottomWidth="1px">WCAG 2.1 Accessibility Audit</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={6}>
          {isLoading ? (
            <Center py={10}><Spinner size="xl" color="blue.500" /></Center>
          ) : !report ? (
            <Center py={10} flexDir="column">
              <Text mb={4} color="gray.600">No compliance report exists for this file yet.</Text>
              <Button 
                colorScheme="blue" 
                onClick={handleRunCheck} 
                isLoading={isGenerating}
                loadingText="Running Automated Audit..."
              >
                Run WCAG Compliance Check
              </Button>
            </Center>
          ) : (
            <VStack spacing={6} align="stretch">
              
              <HStack justify="space-between" align="center" bg="gray.50" p={4} borderRadius="lg" border="1px" borderColor="gray.200">
                <Box>
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">Audit Status</Text>
                  <Badge 
                    colorScheme={report.status === 'pass' ? 'green' : report.status === 'fail' ? 'red' : 'yellow'}
                    fontSize="lg" px={3} py={1} borderRadius="md" mt={1}
                  >
                    {report.status.toUpperCase()}
                  </Badge>
                </Box>
                <Box textAlign="right" w="50%">
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" color="gray.500" fontWeight="medium">Compliance Score</Text>
                    <Text fontSize="sm" fontWeight="bold" color={report.score >= 90 ? 'green.600' : 'orange.600'}>
                      {report.score}/100
                    </Text>
                  </HStack>
                  <Progress value={report.score} colorScheme={report.score >= 90 ? 'green' : report.score >= 70 ? 'yellow' : 'red'} borderRadius="full" size="sm" />
                </Box>
              </HStack>

              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={4}>Identified Issues ({report.issues.length})</Text>
                
                {report.issues.length === 0 ? (
                  <Box p={4} bg="green.50" color="green.800" borderRadius="md" border="1px" borderColor="green.200">
                    <Text fontWeight="medium">Great job! No WCAG 2.1 violations detected.</Text>
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {report.issues.map((issue, idx) => (
                      <Box key={idx} p={4} borderRadius="md" borderLeft="4px" borderColor={issue.severity === 'Error' ? 'red.400' : 'orange.400'} bg="white" shadow="sm" borderWidth="1px">
                        <HStack justify="space-between" mb={2}>
                          <HStack>
                            {getSeverityIcon(issue.severity)}
                            <Text fontWeight="bold" color="gray.800">SC {issue.sc_id}</Text>
                          </HStack>
                          <Badge colorScheme={issue.severity === 'Error' ? 'red' : 'orange'}>{issue.severity}</Badge>
                        </HStack>
                        <Text fontSize="sm" color="gray.700" mb={3}>{issue.description}</Text>
                        
                        <Box bg="blue.50" p={3} borderRadius="md">
                          <Text fontSize="xs" fontWeight="bold" color="blue.700" textTransform="uppercase" mb={1}>Actionable Suggestion</Text>
                          <Text fontSize="sm" color="blue.800">{issue.suggestion}</Text>
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>

            </VStack>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px" bg="gray.50" borderBottomRadius="xl">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {report && (
            <>
              <Button colorScheme="purple" ml={3} onClick={handleExportReport}>
                Export Audit Report (JSON)
              </Button>
              <Button colorScheme="blue" ml={3} onClick={handleRunCheck} isLoading={isGenerating}>
                Re-Run Audit
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
