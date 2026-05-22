import { useEffect, useState, useRef, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Text, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Badge, 
  Button, 
  HStack, 
  Icon, 
  IconButton, 
  Spinner, 
  Center, 
  useDisclosure,
  useToast,
  SimpleGrid,
  AspectRatio,
  Image,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Flex,
  VStack,
  Card,
  CardBody,
  CardFooter
} from '@chakra-ui/react';
import { FiGrid, FiList, FiTrash2, FiShare2, FiDownload, FiFileText, FiAlertCircle } from 'react-icons/fi';
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
  const toast = useToast();
  
  // App states
  const [history, setHistory] = useState<MediaHistoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    (localStorage.getItem('chromashift_view_mode') as 'list' | 'grid') || 'grid'
  );
  
  // Deletion state
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Modal disclosures
  const { isOpen: isReportOpen, onOpen: onReportOpen, onClose: onReportClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isClearOpen, onOpen: onClearOpen, onClose: onClearClose } = useDisclosure();
  
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      case 'completed': return <Badge colorScheme="green" variant="subtle" borderRadius="md">Completed</Badge>;
      case 'processing': return <Badge colorScheme="blue" variant="subtle" borderRadius="md">Processing</Badge>;
      case 'failed': return <Badge colorScheme="red" variant="subtle" borderRadius="md">Failed</Badge>;
      default: return <Badge colorScheme="gray" variant="subtle" borderRadius="md">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'image': return <Badge variant="outline" colorScheme="purple" borderRadius="md">Image</Badge>;
      case 'video': return <Badge variant="outline" colorScheme="orange" borderRadius="md">Video</Badge>;
      case 'pdf': return <Badge variant="outline" colorScheme="red" borderRadius="md">PDF</Badge>;
      default: return null;
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const data = await mediaService.getDownloadUrl(jobId);
      window.open(data.url, '_blank');
    } catch (error) {
      console.error("Download failed", error);
      toast({
        title: "Download failed.",
        description: "Could not retrieve the processed file from storage.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  };

  const handleShare = async (jobId: string) => {
    try {
      const data = await mediaService.shareMedia(jobId);
      navigator.clipboard.writeText(data.share_url);
      toast({
        title: "Link Copied!",
        description: "A public shareable preview link is copied to your clipboard.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch (error) {
      console.error("Share failed", error);
      toast({
        title: "Share link failed.",
        description: "Could not generate a temporary preview link.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  };

  const openComplianceReport = (jobId: string) => {
    setSelectedJobId(jobId);
    onReportOpen();
  };

  const handleDeleteClick = (jobId: string) => {
    setJobToDelete(jobId);
    onDeleteOpen();
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await mediaService.deleteMedia(jobToDelete);
      setHistory(prev => prev.filter(item => item.job_id !== jobToDelete));
      toast({
        title: "File deleted.",
        description: "The media file and its history records have been permanently cleared.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch (error) {
      console.error("Deletion failed", error);
      toast({
        title: "Deletion failed.",
        description: "An error occurred while deleting the media file. Please try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-right"
      });
    } finally {
      setIsDeleting(false);
      setJobToDelete(null);
      onDeleteClose();
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await mediaService.clearAllMedia();
      setHistory([]);
      toast({
        title: "Uploads Cleared.",
        description: res.message || "All of your uploaded and processed media files have been purged.",
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch (error) {
      console.error("Failed to purge uploads", error);
      toast({
        title: "Failed to clear history.",
        description: "An error occurred during bulk purging. Please try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-right"
      });
    } finally {
      setIsClearing(false);
      onClearClose();
    }
  };

  if (isLoading) {
    return <Center p={10}><Spinner size="xl" color="blue.500" /></Center>;
  }

  return (
    <>
      <Box className="w-full max-w-5xl mx-auto mt-10 p-6 rounded-2xl shadow-xl bg-white border border-gray-100">
        {/* Header and Control Bar */}
        <Flex align="center" justify="space-between" mb={6} flexWrap="wrap" gap={4}>
          <VStack align="flex-start" spacing={0.5}>
            <Text fontSize="2xl" fontWeight="black" color="gray.800">Recent Uploads</Text>
            <Text fontSize="sm" color="gray.500">Manage, preview, and audit your CVD-remapped files</Text>
          </VStack>
          
          <HStack spacing={3}>
            {/* View Mode Toggle */}
            <HStack spacing={1} bg="gray.100" p={1} borderRadius="xl" shadow="inner">
              <Tooltip label="Grid View" hasArrow>
                <IconButton
                  aria-label="Grid View"
                  icon={<FiGrid />}
                  size="sm"
                  colorScheme={viewMode === 'grid' ? 'blue' : 'gray'}
                  variant={viewMode === 'grid' ? 'solid' : 'ghost'}
                  borderRadius="lg"
                  onClick={() => {
                    setViewMode('grid');
                    localStorage.setItem('chromashift_view_mode', 'grid');
                  }}
                />
              </Tooltip>
              <Tooltip label="List View" hasArrow>
                <IconButton
                  aria-label="List View"
                  icon={<FiList />}
                  size="sm"
                  colorScheme={viewMode === 'list' ? 'blue' : 'gray'}
                  variant={viewMode === 'list' ? 'solid' : 'ghost'}
                  borderRadius="lg"
                  onClick={() => {
                    setViewMode('list');
                    localStorage.setItem('chromashift_view_mode', 'list');
                  }}
                />
              </Tooltip>
            </HStack>

            <Button
              leftIcon={<FiTrash2 />}
              size="sm"
              colorScheme="red"
              variant="outline"
              borderRadius="xl"
              onClick={onClearOpen}
              isDisabled={history.length === 0}
              _hover={{ bg: "red.50" }}
            >
              Clear All
            </Button>
          </HStack>
        </Flex>

        {history.length === 0 ? (
          <Center py={16} border="2px" borderStyle="dashed" borderColor="gray.200" borderRadius="2xl">
            <VStack spacing={3}>
              <Icon as={FiFileText} w={10} h={10} color="gray.300" />
              <Text color="gray.500" fontWeight="medium">No media uploads found.</Text>
              <Button size="sm" colorScheme="blue" variant="link" onClick={() => navigate('/upload')}>
                Go to the Upload tab to start.
              </Button>
            </VStack>
          </Center>
        ) : viewMode === 'grid' ? (
          /* Grid View Layout with previews */
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={6}>
            {history.map((item) => (
              <Card 
                key={item.job_id} 
                borderRadius="xl" 
                overflow="hidden" 
                shadow="md" 
                border="1px" 
                borderColor="gray.150"
                transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{ transform: 'translateY(-5px)', shadow: 'lg', borderColor: 'blue.200' }}
                bg="white"
              >
                {/* Visual Preview / Status Area */}
                <AspectRatio ratio={16 / 9} bg="gray.50" overflow="hidden" position="relative" borderBottom="1px" borderColor="gray.100">
                  <Box w="100%" h="100%">
                    {item.status === 'completed' ? (
                      item.type === 'image' ? (
                        <Image 
                          src={item.download_url || undefined} 
                          alt={item.filename} 
                          objectFit="cover" 
                          w="100%" 
                          h="100%" 
                          loading="lazy"
                          fallbackSrc="https://via.placeholder.com/400x225?text=Image+Loading"
                        />
                      ) : item.type === 'video' ? (
                        <Box position="relative" w="100%" h="100%">
                          <video 
                            src={item.download_url || undefined} 
                            muted 
                            loop 
                            playsInline 
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                          <Box 
                            position="absolute" 
                            bottom={2} 
                            right={2} 
                            bg="blackAlpha.700" 
                            color="white" 
                            px={2} 
                            py={0.5} 
                            borderRadius="md" 
                            fontSize="2xs" 
                            fontWeight="bold"
                            pointerEvents="none"
                            backdropFilter="blur(4px)"
                          >
                            Hover to Play
                          </Box>
                        </Box>
                      ) : item.type === 'pdf' ? (
                        <Flex w="100%" h="100%" bgGradient="linear(to-br, red.500, orange.500)" align="center" justify="center" direction="column" color="white" p={4}>
                          <Icon as={FiFileText} w={12} h={12} mb={2} />
                          <Text fontSize="sm" fontWeight="black" letterSpacing="wide">PDF DOCUMENT</Text>
                        </Flex>
                      ) : (
                        <Flex w="100%" h="100%" bg="gray.100" align="center" justify="center">
                          <Text color="gray.500" fontSize="xs">No Preview Available</Text>
                        </Flex>
                      )
                    ) : item.status === 'processing' ? (
                      <Flex w="100%" h="100%" bgGradient="linear(to-br, blue.600, purple.600)" align="center" justify="center" direction="column" color="white" p={4}>
                        <Spinner size="md" mb={3} thickness="3px" color="white" />
                        <Text fontSize="2xs" fontWeight="black" letterSpacing="widest" textTransform="uppercase">
                          Processing Media
                        </Text>
                      </Flex>
                    ) : item.status === 'failed' ? (
                      <Flex w="100%" h="100%" bg="red.50" align="center" justify="center" direction="column" color="red.500" p={4}>
                        <Icon as={FiAlertCircle} w={10} h={10} mb={2} />
                        <Text fontSize="2xs" fontWeight="bold">Processing Failed</Text>
                      </Flex>
                    ) : (
                      <Flex w="100%" h="100%" bg="gray.100" align="center" justify="center" direction="column" color="gray.500" p={4}>
                        <Spinner size="sm" mb={2} />
                        <Text fontSize="xs">Queued...</Text>
                      </Flex>
                    )}
                  </Box>
                </AspectRatio>

                {/* Card Title & Info */}
                <CardBody p={4} pb={2}>
                  <VStack align="stretch" spacing={2.5}>
                    <Text fontWeight="bold" fontSize="md" color="gray.800" noOfLines={1} title={item.filename}>
                      {item.filename}
                    </Text>
                    <HStack justify="space-between" align="center">
                      <HStack spacing={1.5}>
                        {getTypeBadge(item.type)}
                        {getStatusBadge(item.status)}
                      </HStack>
                      <Text color="gray.400" fontSize="2xs" fontWeight="semibold">
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </HStack>
                  </VStack>
                </CardBody>

                {/* Card Actions Footer */}
                <CardFooter px={4} py={3} borderTop="1px" borderColor="gray.50" bg="gray.50/50">
                  <HStack w="100%" spacing={1.5} justify="space-between">
                    <HStack spacing={1.5}>
                      <Tooltip label="Open in Studio Workspace" hasArrow>
                        <IconButton
                          aria-label="Studio Workspace"
                          icon={<Icon as={StudioIcon} w={4} h={4} />}
                          size="sm"
                          colorScheme="blue"
                          borderRadius="lg"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => navigate(`/workspace/${item.job_id}`)}
                        />
                      </Tooltip>
                      
                      <Tooltip label="WCAG Compliance Audit Report" hasArrow>
                        <IconButton
                          aria-label="WCAG Report"
                          icon={<Icon as={AuditIcon} w={4} h={4} />}
                          size="sm"
                          colorScheme="teal"
                          variant="outline"
                          borderRadius="lg"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => openComplianceReport(item.job_id)}
                        />
                      </Tooltip>

                      <Tooltip label="Copy Public Share Link" hasArrow>
                        <IconButton
                          aria-label="Share"
                          icon={<FiShare2 />}
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                          borderRadius="lg"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => handleShare(item.job_id)}
                        />
                      </Tooltip>
                    </HStack>

                    <HStack spacing={1.5}>
                      <Tooltip label="Download Processed Media" hasArrow>
                        <IconButton
                          aria-label="Download"
                          icon={<FiDownload />}
                          size="sm"
                          variant="outline"
                          colorScheme="blue"
                          borderRadius="lg"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => handleDownload(item.job_id)}
                        />
                      </Tooltip>

                      <Tooltip label="Delete Upload Permanently" hasArrow>
                        <IconButton
                          aria-label="Delete File"
                          icon={<FiTrash2 />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          borderRadius="lg"
                          onClick={() => handleDeleteClick(item.job_id)}
                          _hover={{ bg: "red.50" }}
                        />
                      </Tooltip>
                    </HStack>
                  </HStack>
                </CardFooter>
              </Card>
            ))}
          </SimpleGrid>
        ) : (
          /* List View Layout */
          <Box overflowX="auto" borderRadius="xl" border="1px" borderColor="gray.100">
            <Table variant="simple" size="md">
              <Thead bg="gray.50">
                <Tr>
                  <Th py={4}>Filename</Th>
                  <Th py={4}>Type</Th>
                  <Th py={4}>Date</Th>
                  <Th py={4}>Status</Th>
                  <Th py={4} textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((item) => (
                  <Tr key={item.job_id} _hover={{ bg: "gray.50/50" }} transition="background 0.2s">
                    <Td py={3}>
                      {/* Premium List Item Thumbnail & Text Row */}
                      <HStack spacing={3}>
                        {item.status === 'completed' && item.type === 'image' && item.download_url ? (
                          <Image
                            src={item.download_url}
                            boxSize="36px"
                            objectFit="cover"
                            borderRadius="lg"
                            border="1px"
                            borderColor="gray.200"
                            fallbackSrc="https://via.placeholder.com/36?text=IMG"
                          />
                        ) : item.status === 'completed' && item.type === 'video' && item.download_url ? (
                          <Box boxSize="36px" borderRadius="lg" overflow="hidden" border="1px" borderColor="gray.200" bg="gray.100">
                            <video
                              src={item.download_url}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                        ) : item.type === 'pdf' ? (
                          <Center boxSize="36px" bg="red.50" color="red.500" borderRadius="lg" border="1px" borderColor="red.100">
                            <Icon as={FiFileText} w={5} h={5} />
                          </Center>
                        ) : (
                          <Center boxSize="36px" bg="gray.100" color="gray.400" borderRadius="lg">
                            {item.status === 'processing' ? <Spinner size="xs" /> : <Icon as={FiFileText} w={5} h={5} />}
                          </Center>
                        )}
                        <Text fontWeight="bold" color="gray.700" noOfLines={1} maxW="xs">{item.filename}</Text>
                      </HStack>
                    </Td>
                    <Td py={3}>{getTypeBadge(item.type)}</Td>
                    <Td py={3} color="gray.500" fontSize="xs" fontWeight="semibold">
                      {new Date(item.created_at).toLocaleString()}
                    </Td>
                    <Td py={3}>{getStatusBadge(item.status)}</Td>
                    <Td py={3} textAlign="right">
                      <HStack justify="flex-end" spacing={1.5}>
                        <Button
                          leftIcon={<StudioIcon w={4} h={4} />}
                          size="sm"
                          colorScheme="blue"
                          borderRadius="lg"
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
                          borderRadius="lg"
                          isDisabled={item.status !== 'completed'}
                          onClick={() => openComplianceReport(item.job_id)}
                        >
                          WCAG Report
                        </Button>
                        <Tooltip label="Copy Share Link" hasArrow>
                          <IconButton 
                            aria-label="Share" 
                            icon={<ShareIcon w={4} h={4} />} 
                            size="sm" 
                            variant="ghost"
                            colorScheme="blue"
                            borderRadius="lg"
                            isDisabled={item.status !== 'completed'}
                            onClick={() => handleShare(item.job_id)}
                          />
                        </Tooltip>
                        <Tooltip label="Download Processed" hasArrow>
                          <IconButton 
                            aria-label="Download"
                            icon={<DownloadIcon w={4} h={4} />} 
                            size="sm" 
                            variant="outline"
                            colorScheme="blue"
                            borderRadius="lg"
                            isDisabled={item.status !== 'completed'}
                            onClick={() => handleDownload(item.job_id)}
                          />
                        </Tooltip>
                        <Tooltip label="Delete Permanently" hasArrow>
                          <IconButton 
                            aria-label="Delete" 
                            icon={<FiTrash2 />} 
                            size="sm" 
                            variant="ghost"
                            colorScheme="red"
                            borderRadius="lg"
                            onClick={() => handleDeleteClick(item.job_id)}
                            _hover={{ bg: "red.50" }}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      {/* Compliance report modal */}
      <ComplianceReportModal 
        isOpen={isReportOpen} 
        onClose={onReportClose} 
        jobId={selectedJobId} 
      />

      {/* Individual Deletion Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="2xl">
            <AlertDialogHeader fontSize="lg" fontWeight="black" color="gray.850">
              Delete Uploaded File
            </AlertDialogHeader>

            <AlertDialogBody color="gray.600">
              Are you sure you want to permanently delete this uploaded file? This will immediately remove it from active storage and purge all related reports. This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} size="sm" borderRadius="xl">
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleConfirmDelete} 
                ml={3} 
                isLoading={isDeleting}
                loadingText="Deleting"
                size="sm" 
                borderRadius="xl"
              >
                Delete permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Global Clear-All Purge Dialog */}
      <AlertDialog
        isOpen={isClearOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClearClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="2xl">
            <AlertDialogHeader fontSize="lg" fontWeight="black" color="red.600">
              ⚠️ Clear All Uploads
            </AlertDialogHeader>

            <AlertDialogBody color="gray.600">
              This will permanently delete <strong>EVERY SINGLE</strong> upload, processed asset, and WCAG accessibility compliance audit report connected to your profile from active database structures and storage buckets.
              <br /><br />
              This action is immediate and absolute. Are you sure you want to proceed?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClearClose} size="sm" borderRadius="xl">
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleConfirmClearAll} 
                ml={3} 
                isLoading={isClearing}
                loadingText="Purging"
                size="sm" 
                borderRadius="xl"
              >
                Purge All Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

