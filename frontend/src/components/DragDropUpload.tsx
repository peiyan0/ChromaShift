import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, VStack, Icon, Progress, useToast, Button, HStack, Tabs, TabList, TabPanels, Tab, TabPanel, Card, CardBody, Badge, Image, Center } from '@chakra-ui/react';
import { mediaService } from '../services/media';
import { profileService } from '../services/profile';
import { useNavigate } from 'react-router-dom';
import { ClientSideVideoProcessor } from './ClientSideVideoProcessor';
import { FiCloud, FiCpu } from 'react-icons/fi';

const UploadIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M14,13V17H10V13H7L12,8L17,13H14M19.35,10.03C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.03C2.34,8.36 0,10.9 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.03Z" />
  </Icon>
);

export const DragDropUpload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState(0); // 0 = Server, 1 = Client GPU
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

  React.useEffect(() => {
    const cachedPending = localStorage.getItem('chromashift_pending_file');
    if (cachedPending) {
      try {
        const parsed = JSON.parse(cachedPending);
        toast({
          title: "Interrupted Session Detected",
          description: `We found a pending upload for "${parsed.name}" (${(parsed.size / 1024 / 1024).toFixed(2)} MB). Please re-select the file to resume.`,
          status: "info",
          duration: 7000,
          isClosable: true,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [toast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image, MP4 video, or PDF.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setFile(selectedFile);
    // Reset to Server-Side tab by default
    setActiveTab(0);

    // Save pending state to localStorage for NFR-3.2 recovery
    localStorage.setItem('chromashift_pending_file', JSON.stringify({
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      activeTab: 0
    }));
  };

  const loadSample = async (url: string, filename: string, type: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const sampleFile = new File([blob], filename, { type });
      validateAndSetFile(sampleFile);
      toast({
        title: "Sample Loaded",
        description: `Loaded ${filename} successfully.`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });
    } catch (e) {
      toast({ title: 'Failed to load sample', status: 'error' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(10);
    
    // Clear pending session state once upload actively starts
    localStorage.removeItem('chromashift_pending_file');
    
    try {
      // 1. Upload to S3
      const uploadRes = await mediaService.uploadMedia(file);
      setProgress(40);
      
      // 2. Trigger processing with the user's calibrated vision profile
      let cvdType = "deuteranopia";
      let severity = 1.0;
      try {
        const savedProfile = await profileService.getProfile();
        if (savedProfile) {
          cvdType = savedProfile.cvd_type || "deuteranopia";
          severity = savedProfile.severity !== undefined ? savedProfile.severity : 1.0;
        }
      } catch (err) {
        console.log("Could not load vision profile, using default values", err);
      }
      
      await mediaService.processMedia(uploadRes.job_id, { cvd_type: cvdType, severity });
      setProgress(60);

      // 3. Poll for status
      const pollInterval = setInterval(async () => {
        const statusRes = await mediaService.getMediaStatus(uploadRes.job_id);
        setProgress(60 + (statusRes.progress * 0.4)); // Scale progress to remaining 40%

        if (statusRes.status === 'completed') {
          clearInterval(pollInterval);
          setProgress(100);
          setIsUploading(false);
          
          toast({
            title: "Processing complete",
            description: "Your accessible file is ready.",
            status: "success",
            duration: 3000,
          });

          // Redirect to dashboard to see the result
          setTimeout(() => navigate('/hub'), 1500);
        } else if (statusRes.status === 'failed') {
          clearInterval(pollInterval);
          setIsUploading(false);
          toast({
            title: "Processing failed",
            description: "There was an error processing your file.",
            status: "error",
            duration: 5000,
          });
        }
      }, 2000);

    } catch (error) {
      console.error(error);
      setIsUploading(false);
      toast({
        title: "Error",
        description: "An unexpected error occurred during upload.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const isVideo = file && file.type.startsWith('video/');
  const isPdf = file && file.type === 'application/pdf';
  const isImage = file && file.type.startsWith('image/');

  // If a video is selected and Client GPU remapping is active, render processor instead
  if (isVideo && activeTab === 1) {
    return <ClientSideVideoProcessor file={file} onCancel={() => setFile(null)} />;
  }

  return (
    <Box 
      className="w-full max-w-2xl mx-auto mt-10 p-6 rounded-2xl shadow-xl bg-white border border-gray-100"
    >
      <VStack spacing={6}>
        <Text fontSize="2xl" fontWeight="black" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text">
          Upload & Remap Media
        </Text>
        <Text color="gray.500" textAlign="center" fontSize="sm">
          Upload images, videos, or PDF manuals to apply hardware-accelerated Daltonization.
        </Text>

        {!file ? (
          <>
            <Box
            w="full"
            p={12}
            border="2px dashed"
            borderColor={isDragging ? "blue.400" : "gray.300"}
            borderRadius="2xl"
            bg={isDragging ? "blue.50" : "gray.50"}
            transition="all 0.25s"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            cursor="pointer"
            _hover={{ bg: "gray.100" }}
          >
            <VStack spacing={4}>
              <UploadIcon w={16} h={16} color={isDragging ? "blue.500" : "gray.400"} />
              <Text fontWeight="bold" color="gray.600" fontSize="sm">
                Drag & drop files here, or click to browse
              </Text>
              <Text fontSize="xs" color="gray.400">Supports JPG, PNG, WEBP, MP4, PDF (max 100MB)</Text>
            </VStack>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
            />
          </Box>
          <Box w="full" mt={6}>
            <Text fontSize="md" color="gray.700" textAlign="left" mb={4} fontWeight="black">
              Don't have a file? Try our sample media:
            </Text>
            
            <VStack align="stretch" spacing={6} w="full">
              {/* Images Row */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" color="blue.600" mb={2}>Images & Charts</Text>
                <HStack overflowX="auto" pb={4} spacing={4} sx={{ '&::-webkit-scrollbar': { height: '8px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.300', borderRadius: 'full' } }}>
                  {[
                    { url: '/financial_dashboard.png', name: 'financial_dashboard.png', type: 'image/png' },
                    { url: '/apple_orchard.png', name: 'apple_orchard.png', type: 'image/png' },
                    { url: '/transit_map.png', name: 'transit_map.png', type: 'image/png' },
                    { url: '/area_chart_trends.png', name: 'area_chart_trends.png', type: 'image/png' },
                    { url: '/bar_line_sales_report.png', name: 'bar_line_sales_report.png', type: 'image/png' },
                    { url: '/multi_line_comparison.webp', name: 'multi_line_comparison.webp', type: 'image/webp' },
                    { url: '/heatmap.webp', name: 'heatmap.webp', type: 'image/webp' },
                    { url: '/pie_chart.png', name: 'pie_chart.png', type: 'image/png' }
                  ].map((s, i) => (
                    <Box 
                      key={i} minW="130px" w="130px" borderWidth="1px" borderRadius="xl" overflow="hidden" cursor="pointer" shadow="sm" transition="all 0.2s" _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
                      onClick={() => loadSample(s.url, s.name, s.type)}
                    >
                      <Box h="80px" bg="gray.100" overflow="hidden">
                        <Image src={s.url} w="full" h="full" objectFit="cover" />
                      </Box>
                      <Center p={2} bg="blue.50" borderTopWidth="1px" borderColor="blue.100">
                        <Text fontSize="2xs" fontWeight="bold" color="blue.700" isTruncated>{s.name}</Text>
                      </Center>
                    </Box>
                  ))}
                </HStack>
              </Box>

              {/* Videos Row */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" color="purple.600" mb={2}>Videos</Text>
                <HStack overflowX="auto" pb={4} spacing={4} sx={{ '&::-webkit-scrollbar': { height: '8px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.300', borderRadius: 'full' } }}>
                  {[
                    { url: '/chart_infographic.mp4', name: 'chart_infographic.mp4', type: 'video/mp4' },
                    { url: '/medical_imaging.mp4', name: 'medical_imaging.mp4', type: 'video/mp4' },
                    { url: '/financial_trading.mp4', name: 'financial_trading.mp4', type: 'video/mp4' },
                    { url: '/autonomous_driving.mp4', name: 'autonomous_driving.mp4', type: 'video/mp4' },
                    { url: '/industrial_hmi.mp4', name: 'industrial_hmi.mp4', type: 'video/mp4' },
                    { url: '/pathology_lab.mp4', name: 'pathology_lab.mp4', type: 'video/mp4' },
                    { url: '/sports_broadcast.mp4', name: 'sports_broadcast.mp4', type: 'video/mp4' },
                    { url: '/jungle_gameplay.mp4', name: 'jungle_gameplay.mp4', type: 'video/mp4' },
                    { url: '/moba_replay.mp4', name: 'moba_replay.mp4', type: 'video/mp4' }
                  ].map((s, i) => (
                    <Box 
                      key={i} minW="130px" w="130px" borderWidth="1px" borderRadius="xl" overflow="hidden" cursor="pointer" shadow="sm" transition="all 0.2s" _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
                      onClick={() => loadSample(s.url, s.name, s.type)}
                    >
                      <Box h="80px" bg="black" overflow="hidden">
                        <Box as="video" src={s.url} w="full" h="full" objectFit="cover" preload="metadata" />
                      </Box>
                      <Center p={2} bg="purple.50" borderTopWidth="1px" borderColor="purple.100">
                        <Text fontSize="2xs" fontWeight="bold" color="purple.700" isTruncated>{s.name}</Text>
                      </Center>
                    </Box>
                  ))}
                </HStack>
              </Box>

              {/* PDFs Row */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" color="orange.600" mb={2}>PDF Reports</Text>
                <HStack overflowX="auto" pb={4} spacing={4} sx={{ '&::-webkit-scrollbar': { height: '8px' }, '&::-webkit-scrollbar-thumb': { bg: 'gray.300', borderRadius: 'full' } }}>
                  {[
                    { url: '/financial_report.pdf', name: 'financial_report.pdf', type: 'application/pdf' },
                    { url: '/research_paper.pdf', name: 'research_paper.pdf', type: 'application/pdf' }
                  ].map((s, i) => (
                    <Box 
                      key={i} minW="130px" w="130px" borderWidth="1px" borderRadius="xl" overflow="hidden" cursor="pointer" shadow="sm" transition="all 0.2s" _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
                      onClick={() => loadSample(s.url, s.name, s.type)}
                    >
                      <Center h="80px" bg="gray.100">
                        <Icon viewBox="0 0 24 24" w={8} h={8} color="orange.400">
                          <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,13H11V18H9V13H7L10,9L13,13Z" />
                        </Icon>
                      </Center>
                      <Center p={2} bg="orange.50" borderTopWidth="1px" borderColor="orange.100">
                        <Text fontSize="2xs" fontWeight="bold" color="orange.700" isTruncated>{s.name}</Text>
                      </Center>
                    </Box>
                  ))}
                </HStack>
              </Box>
            </VStack>
          </Box>
          </>
        ) : (
          <VStack spacing={5} w="full">
            {/* Selected File Details */}
            <HStack w="full" justify="space-between" p={4} bg="gray.50" borderRadius="xl" border="1px" borderColor="gray.100">
              <VStack align="start" spacing={0.5}>
                <Text fontWeight="extrabold" fontSize="sm" color="gray.700" noOfLines={1}>
                  {file.name}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                </Text>
              </VStack>
              <Button size="xs" colorScheme="red" variant="ghost" onClick={() => { setFile(null); localStorage.removeItem('chromashift_pending_file'); }}>
                Change File
              </Button>
            </HStack>

            {/* If video file is selected, show Cloud vs Local GPU processing options */}
            {isVideo && (
              <Box w="full">
                <Tabs isFitted variant="soft-rounded" colorScheme="blue" index={activeTab} onChange={(index) => setActiveTab(index)}>
                  <TabList mb="1em" bg="gray.100" p={1} borderRadius="xl">
                    <Tab borderRadius="lg" fontSize="xs" fontWeight="bold">
                      <HStack spacing={2}>
                        <Icon as={FiCloud} />
                        <Text>Cloud Remap (S3)</Text>
                      </HStack>
                    </Tab>
                    <Tab borderRadius="lg" fontSize="xs" fontWeight="bold">
                      <HStack spacing={2}>
                        <Icon as={FiCpu} />
                        <Text>GPU Remap (Local)</Text>
                        <Badge colorScheme="purple">Fast</Badge>
                      </HStack>
                    </Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel p={0}>
                      <Card variant="outline" size="sm" borderRadius="xl">
                        <CardBody p={4}>
                          <VStack align="start" spacing={2}>
                            <Text fontSize="xs" color="gray.500">
                              Upload the file to secured S3 storage and process it via fine-tuned server models. Perfect for keeping a permanent archive in your history dashboard.
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>
                    </TabPanel>
                    <TabPanel p={0} />
                  </TabPanels>
                </Tabs>
              </Box>
            )}

            {/* Image/PDF standard layout explanation */}
            {!isVideo && (
              <Card variant="outline" size="sm" borderRadius="xl" w="full">
                <CardBody p={4}>
                  <Text fontSize="xs" color="gray.500">
                    {isPdf 
                      ? "Your PDF will be uploaded to securely hosted S3 storage. Our PyMuPDF pipeline will semantically recolor charts and diagrams while perfectly preserving all vector text layers for screen-reader accessibility."
                      : isImage
                      ? "Your image will be uploaded to securely hosted S3 storage. Our YOLO26n-seg pipeline will apply precise semantic Daltonization while ensuring 100% perceptual lightness preservation."
                      : "Your file will be uploaded to securely hosted S3 storage. Our backend fine-tuned Daltonization pipelines will apply CVD accessibility corrections."}
                  </Text>
                </CardBody>
              </Card>
            )}

            {isUploading && (
              <Box w="full" mt={2}>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600">Processing Cloud Pipeline...</Text>
                  <Text fontSize="xs" fontWeight="black" color="blue.600">{Math.round(progress)}%</Text>
                </HStack>
                <Progress value={progress} size="sm" colorScheme="blue" borderRadius="full" hasStripe isAnimated={progress < 100} />
              </Box>
            )}

            <Button 
              colorScheme="blue" 
              bgGradient="linear(to-r, blue.600, purple.600)"
              size="lg" 
              w="full" 
              isDisabled={isUploading}
              onClick={handleUpload}
              isLoading={isUploading}
              loadingText="Uploading & Processing"
              borderRadius="xl"
              fontWeight="black"
              shadow="md"
            >
              Upload & Process File
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};
