import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Text, Table, Thead, Tbody, Tr, Th, Td, Badge, Button, HStack, Icon, IconButton, Spinner, Center, useDisclosure } from '@chakra-ui/react';
import { mediaService, type MediaHistoryResponse } from '../services/media';
import { ComplianceReportModal } from './ComplianceReportModal';

const DownloadIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
  </Icon>
);

const ShareIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.92 18,21.92C19.61,21.92 20.92,20.61 20.92,19C20.92,17.39 19.61,16.08 18,16.08Z" />
  </Icon>
);

const AuditIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
  </Icon>
);

const StudioIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M19,3H5A2,2 0 0,0 3,5V15A2,2 0 0,0 5,17H10V19H8V21H16V19H14V17H19A2,2 0 0,0 21,15V5A2,2 0 0,0 19,3M19,15H5V5H19V15Z" />
  </Icon>
);

export const DashboardHistory: FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<MediaHistoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await mediaService.getHistory();
        setHistory(data);
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge colorScheme="green">Completed</Badge>;
      case 'processing': return <Badge colorScheme="blue">Processing</Badge>;
      case 'failed': return <Badge colorScheme="red">Failed</Badge>;
      default: return <Badge colorScheme="gray">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'image': return <Badge variant="outline" colorScheme="purple">Image</Badge>;
      case 'video': return <Badge variant="outline" colorScheme="orange">Video</Badge>;
      case 'pdf': return <Badge variant="outline" colorScheme="red">PDF</Badge>;
      default: return null;
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const data = await mediaService.getDownloadUrl(jobId);
      window.open(data.url, '_blank');
    } catch (error) {
      console.error("Download failed", error);
    }
  };

  const handleShare = async (jobId: string) => {
    try {
      const data = await mediaService.shareMedia(jobId);
      navigator.clipboard.writeText(data.share_url);
      alert("Share link copied to clipboard!");
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const openComplianceReport = (jobId: string) => {
    setSelectedJobId(jobId);
    onOpen();
  };

  if (isLoading) {
    return <Center p={10}><Spinner size="xl" color="blue.500" /></Center>;
  }

  return (
    <>
      <Box className="w-full max-w-5xl mx-auto mt-10 p-6 rounded-2xl shadow-xl bg-white border border-gray-100">
        <Text fontSize="2xl" fontWeight="bold" color="gray.800" mb={6}>Recent Uploads</Text>
        
        {history.length === 0 ? (
          <Center py={10}>
            <Text color="gray.500">No media uploads found. Go to the Upload tab to start.</Text>
          </Center>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="md">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Filename</Th>
                  <Th>Type</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((item) => (
                  <Tr key={item.job_id}>
                    <Td fontWeight="medium">{item.filename}</Td>
                    <Td>{getTypeBadge(item.type)}</Td>
                    <Td color="gray.500" fontSize="sm">{new Date(item.created_at).toLocaleString()}</Td>
                    <Td>{getStatusBadge(item.status)}</Td>
                    <Td textAlign="right">
                      <HStack justify="flex-end" spacing={2}>
                        <Button
                          leftIcon={<StudioIcon w={4} h={4} />}
                          size="sm"
                          colorScheme="blue"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => navigate(`/workspace/${item.job_id}`)}
                        >
                          Workspace
                        </Button>
                        <Button
                          leftIcon={<AuditIcon w={4} h={4} />}
                          size="sm"
                          colorScheme="teal"
                          variant="outline"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => openComplianceReport(item.job_id)}
                        >
                          WCAG Report
                        </Button>
                        <IconButton 
                          aria-label="Share" 
                          icon={<ShareIcon w={4} h={4} />} 
                          size="sm" 
                          variant="ghost"
                          colorScheme="blue"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => handleShare(item.job_id)}
                        />
                        <Button 
                          leftIcon={<DownloadIcon w={4} h={4} />} 
                          size="sm" 
                          variant="outline"
                          colorScheme="blue"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => handleDownload(item.job_id)}
                        >
                          Download
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <ComplianceReportModal 
        isOpen={isOpen} 
        onClose={onClose} 
        jobId={selectedJobId} 
      />
    </>
  );
};
