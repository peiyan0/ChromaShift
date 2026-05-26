import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Badge,
  Button,
  IconButton,
  Icon,
  Spinner,
  Center,
  useToast,
  Divider,
  SimpleGrid,
  CircularProgress,
  CircularProgressLabel,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb
} from '@chakra-ui/react';
import { mediaService, type MediaStatusResponse } from '../services/media';
import { complianceService, type ComplianceReportResponse } from '../services/compliance';
import { profileService, type VisionProfile } from '../services/profile';

// Custom SVG Icons
const BackIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
  </Icon>
);

const SideBySideIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M2,18H10V6H2V18M1,5H11A1,1 0 0,1 12,6V18A1,1 0 0,1 11,19H1A1,1 0 0,1 0,18V6A1,1 0 0,1 1,5M14,18H22V6H14V18M13,5H23A1,1 0 0,1 24,6V18A1,1 0 0,1 23,19H13A1,1 0 0,1 12,18V6A1,1 0 0,1 13,5Z" />
  </Icon>
);

const ToggleViewIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20V4Z" />
  </Icon>
);

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

const RefreshIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
  </Icon>
);

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

export const WorkspaceStudio: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState<MediaStatusResponse | null>(null);
  const [report, setReport] = useState<ComplianceReportResponse | null>(null);
  const [mediaType, setMediaType] = useState<string>('image');
  const [fileName, setFileName] = useState<string>('Loading file...');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'side-by-side' | 'toggle'>('side-by-side');
  const [toggleActive, setToggleActive] = useState<'original' | 'processed'>('processed');

  // Dynamic Filtering State
  const [profile, setProfile] = useState<VisionProfile | null>(null);
  const [intensity, setIntensity] = useState<number>(1.0);
  const [svgMatrixValues, setSvgMatrixValues] = useState<string>("1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");

  // Video Synced References
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const processedVideoRef = useRef<HTMLVideoElement>(null);
  const isSyncing = useRef<boolean>(false);

  useEffect(() => {
    if (jobId) {
      loadWorkspace();
    }
  }, [jobId]);

  useEffect(() => {
    const loadProfile = async () => {
      let p = null;
      const cached = localStorage.getItem('chromashift_cvd_profile');
      if (cached) {
        try { p = JSON.parse(cached); } catch (_) {}
      }
      if (!p) {
        try { p = await profileService.getProfile(); } catch (_) {}
      }
      if (p) {
        setProfile(p);
        setIntensity(p.severity || 1.0);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      const type = profile.cvd_type || 'deuteranopia';
      const s = intensity;
      
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
  }, [profile, intensity]);

  const loadWorkspace = async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      // 1. Fetch Job status & S3 presigned URLs
      const statusRes = await mediaService.getMediaStatus(jobId);
      setStatus(statusRes);
      
      // Determine file type from file extension
      const ext = statusRes.download_url?.split('?')[0].split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
        setMediaType('video');
      } else if (ext === 'pdf') {
        setMediaType('pdf');
      } else {
        setMediaType('image');
      }

      // Try to deduce filename from history list
      try {
        const history = await mediaService.getHistory();
        const job = history.find(j => j.job_id === jobId);
        if (job) {
          setFileName(job.filename);
          setMediaType(job.type);
        }
      } catch (err) {
        console.error("Failed to deduce filename from history", err);
      }

      // 2. Fetch WCAG Compliance Report
      try {
        const reportRes = await complianceService.getReport(jobId);
        setReport(reportRes);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setReport(null); // No report generated yet
        }
      }

    } catch (error) {
      toast({
        title: "Workspace Load Failed",
        description: "Could not fetch media info from the server.",
        status: "error",
        duration: 5000,
        isClosable: true
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!jobId) return;
    setIsAuditing(true);
    try {
      const reportRes = await complianceService.runCheck(jobId);
      setReport(reportRes);
      toast({ title: "Accessibility Audit Complete", status: "success", duration: 3000 });
    } catch (error) {
      toast({ title: "Accessibility Audit Failed", description: "Could not run automated WCAG check.", status: "error", duration: 4000 });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDownload = () => {
    if (status?.download_url) {
      window.open(status.download_url, '_blank');
    }
  };

  const handleShare = async () => {
    if (!jobId) return;
    try {
      const data = await mediaService.shareMedia(jobId);
      await navigator.clipboard.writeText(data.share_url);
      toast({ title: "Share link copied", description: "The accessible link has been copied to your clipboard.", status: "success", duration: 3000 });
    } catch (error) {
      toast({ title: "Share Link Generation Failed", status: "error", duration: 3000 });
    }
  };

  // Video Synchronizer Logic
  const syncPlayback = (source: 'processed' | 'original') => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const sourceVideo = source === 'processed' ? processedVideoRef.current : originalVideoRef.current;
    const targetVideo = source === 'processed' ? originalVideoRef.current : processedVideoRef.current;

    if (sourceVideo && targetVideo) {
      // Synchronize play state
      if (sourceVideo.paused && !targetVideo.paused) {
        targetVideo.pause();
      } else if (!sourceVideo.paused && targetVideo.paused) {
        targetVideo.play().catch(() => {});
      }
      // Synchronize timestamp (allow tiny deviation threshold of 0.05s)
      if (Math.abs(targetVideo.currentTime - sourceVideo.currentTime) > 0.05) {
        targetVideo.currentTime = sourceVideo.currentTime;
      }
    }

    setTimeout(() => {
      isSyncing.current = false;
    }, 15);
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'Error') return <ErrorIcon color="red.500" w={5} h={5} />;
    if (severity === 'Warning') return <WarningIcon color="orange.500" w={5} h={5} />;
    return null;
  };

  if (isLoading) {
    return (
      <Center h="70vh" flexDir="column">
        <Spinner size="xl" color="blue.500" mb={4} thickness="4px" />
        <Text color="gray.600" fontWeight="medium">Loading Workspace Studio...</Text>
      </Center>
    );
  }

  if (status?.status === 'processing' || status?.status === 'uploaded') {
    return (
      <Center h="70vh" flexDir="column" p={6}>
        <CircularProgress isIndeterminate color="blue.500" size="80px" thickness="8px" mb={6}>
          <CircularProgressLabel color="blue.500" fontSize="xs" fontWeight="bold">AI</CircularProgressLabel>
        </CircularProgress>
        <Text fontSize="xl" fontWeight="black" color="gray.800" mb={2}>Processing Your File...</Text>
        <Text color="gray.500" textAlign="center" maxW="md" mb={6}>
          Our semantic AI pipeline is analyzing and remapping your colors for maximum WCAG compliance. This will take just a moment.
        </Text>
        <Button leftIcon={<RefreshIcon w={4} h={4} />} onClick={loadWorkspace} colorScheme="blue" variant="outline" borderRadius="xl">
          Refresh Status
        </Button>
      </Center>
    );
  }

  if (status?.status === 'failed') {
    return (
      <Center h="70vh" flexDir="column" p={6}>
        <Icon as={WarningIcon} w={16} h={16} color="red.500" mb={6} />
        <Text fontSize="xl" fontWeight="black" color="gray.800" mb={2}>Processing Failed</Text>
        <Text color="gray.500" textAlign="center" maxW="md" mb={6}>
          An error occurred in our AI processing pipeline while attempting to remap colors for this file.
        </Text>
        <Button onClick={() => navigate('/')} colorScheme="blue" borderRadius="xl">
          Back to Dashboard
        </Button>
      </Center>
    );
  }

  return (
    <Box w="full" px={1} py={4}>
      <svg width="0" height="0" style={{ position: 'absolute', zIndex: -100, pointerEvents: 'none' }}>
        <defs>
          <filter id="workspace-daltonize-filter">
            <feColorMatrix type="matrix" values={svgMatrixValues} />
          </filter>
        </defs>
      </svg>
      {/* Studio Header Bar */}
      <Flex justify="space-between" align="center" mb={6} bg="white" p={4} borderRadius="2xl" border="1px" borderColor="gray.100" shadow="sm">
        <HStack spacing={4}>
          <IconButton
            aria-label="Back to Dashboard"
            icon={<BackIcon w={5} h={5} />}
            variant="ghost"
            onClick={() => navigate('/')}
            borderRadius="full"
          />
          <VStack align="flex-start" spacing={0}>
            <HStack>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">{fileName}</Text>
              <Badge colorScheme={mediaType === 'image' ? 'purple' : mediaType === 'video' ? 'orange' : 'red'} variant="subtle">
                {mediaType.toUpperCase()}
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.400">Job ID: {jobId}</Text>
          </VStack>
        </HStack>

        {/* Comparison Layout Selectors */}
        <HStack spacing={3} bg="gray.100" p={1} borderRadius="xl">
          <Button
            leftIcon={<SideBySideIcon w={4} h={4} />}
            size="sm"
            variant={displayMode === 'side-by-side' ? 'solid' : 'ghost'}
            colorScheme={displayMode === 'side-by-side' ? 'blue' : 'gray'}
            onClick={() => setDisplayMode('side-by-side')}
            borderRadius="lg"
          >
            Side-by-Side
          </Button>
          <Button
            leftIcon={<ToggleViewIcon w={4} h={4} />}
            size="sm"
            variant={displayMode === 'toggle' ? 'solid' : 'ghost'}
            colorScheme={displayMode === 'toggle' ? 'blue' : 'gray'}
            onClick={() => setDisplayMode('toggle')}
            borderRadius="lg"
          >
            Overlay Toggle
          </Button>
        </HStack>
      </Flex>

      {/* Main Grid: Left Media Workspace, Right/Bottom WCAG Sidebar */}
      <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6}>
        {/* MEDIA VIEWPORT PANEL */}
        <Box gridColumn={{ lg: displayMode === 'side-by-side' ? "span 12" : "span 8" }} bg="white" border="1px" borderColor="gray.100" shadow="md" borderRadius="2xl" overflow="hidden" p={6}>
          {/* Intensity Slider */}
          {(mediaType === 'image' || mediaType === 'video') && (
            <Box mb={6} p={4} bg="gray.50" borderRadius="xl" border="1px" borderColor="gray.200">
              <Flex justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="bold" color="gray.700">Live Correction Intensity (Severity)</Text>
                <Text fontSize="sm" fontWeight="bold" color="blue.600">{Math.round(intensity * 100)}%</Text>
              </Flex>
              <Slider
                aria-label="intensity-slider"
                min={0}
                max={2}
                step={0.1}
                value={intensity}
                onChange={(val) => setIntensity(val)}
                colorScheme="blue"
              >
                <SliderTrack bg="gray.300">
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb boxSize={6} shadow="md" />
              </Slider>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Adjusting this slider applies a real-time GPU filter to the original media. 
              </Text>
            </Box>
          )}

          {displayMode === 'toggle' && (
            <Flex justify="center" mb={4}>
              <HStack spacing={1} bg="gray.100" p={1} borderRadius="lg">
                <Button
                  size="xs"
                  variant={toggleActive === 'original' ? 'solid' : 'ghost'}
                  colorScheme={toggleActive === 'original' ? 'teal' : 'gray'}
                  onClick={() => setToggleActive('original')}
                  borderRadius="md"
                >
                  Original File
                </Button>
                <Button
                  size="xs"
                  variant={toggleActive === 'processed' ? 'solid' : 'ghost'}
                  colorScheme={toggleActive === 'processed' ? 'teal' : 'gray'}
                  onClick={() => setToggleActive('processed')}
                  borderRadius="md"
                >
                  Corrected View
                </Button>
              </HStack>
            </Flex>
          )}

          {/* Dynamic Media Renderer */}
          {mediaType === 'image' && (
            <Box>
              {displayMode === 'side-by-side' ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <VStack align="stretch">
                    <Text fontWeight="bold" fontSize="sm" color="gray.500" mb={1} textAlign="center">Original Image</Text>
                    <Box border="1px" borderColor="gray.200" borderRadius="xl" overflow="hidden" shadow="inner" maxH="75vh" display="flex" justifyContent="center" bg="gray.50">
                      <img
                        src={status?.download_url_original || ''}
                        alt="Original Upload"
                        style={{ width: '100%', height: 'auto', maxHeight: '75vh', objectFit: 'contain' }}
                      />
                    </Box>
                  </VStack>
                  <VStack align="stretch">
                    <Text fontWeight="bold" fontSize="sm" color="blue.500" mb={1} textAlign="center">Corrected Image (CVD Shifted)</Text>
                    <Box border="1px" borderColor="blue.100" borderRadius="xl" overflow="hidden" shadow="inner" maxH="75vh" display="flex" justifyContent="center" bg="gray.50">
                      <img
                        src={status?.download_url_original || ''}
                        alt="Corrected Accessible"
                        style={{ width: '100%', height: 'auto', maxHeight: '75vh', objectFit: 'contain', filter: 'url(#workspace-daltonize-filter)' }}
                      />
                    </Box>
                  </VStack>
                </SimpleGrid>
              ) : (
                <Center minH="400px">
                  <Box border="1px" borderColor="gray.200" borderRadius="2xl" overflow="hidden" shadow="lg" w="100%" display="flex" justifyContent="center" bg="gray.50">
                    <img
                      src={status?.download_url_original || ''}
                      alt="Overlay View"
                      style={{ 
                        width: '100%', 
                        height: 'auto', 
                        maxHeight: '80vh', 
                        objectFit: 'contain',
                        filter: toggleActive === 'processed' ? 'url(#workspace-daltonize-filter)' : 'none'
                      }}
                    />
                  </Box>
                </Center>
              )}
            </Box>
          )}

          {mediaType === 'video' && (
            <Box>
              {displayMode === 'side-by-side' ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <VStack align="stretch">
                    <Text fontWeight="bold" fontSize="sm" color="gray.500" mb={1} textAlign="center">Original Video</Text>
                    <Box border="1px" borderColor="gray.200" borderRadius="xl" overflow="hidden" bg="black" shadow="lg" maxH="75vh" display="flex">
                      <video
                        ref={originalVideoRef}
                        src={status?.download_url_original || ''}
                        controls
                        playsInline
                        style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }}
                        onPlay={() => syncPlayback('original')}
                        onPause={() => syncPlayback('original')}
                        onSeeking={() => syncPlayback('original')}
                        onSeeked={() => syncPlayback('original')}
                      />
                    </Box>
                  </VStack>
                  <VStack align="stretch">
                    <Text fontWeight="bold" fontSize="sm" color="blue.500" mb={1} textAlign="center">Corrected Video (Coherent Shift)</Text>
                    <Box border="1px" borderColor="blue.100" borderRadius="xl" overflow="hidden" bg="black" shadow="lg" maxH="75vh" display="flex">
                      <video
                        ref={processedVideoRef}
                        src={status?.download_url_original || ''}
                        controls
                        playsInline
                        style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', filter: 'url(#workspace-daltonize-filter)' }}
                        onPlay={() => syncPlayback('processed')}
                        onPause={() => syncPlayback('processed')}
                        onSeeking={() => syncPlayback('processed')}
                        onSeeked={() => syncPlayback('processed')}
                      />
                    </Box>
                  </VStack>
                </SimpleGrid>
              ) : (
                <Center>
                  <Box border="1px" borderColor="gray.200" borderRadius="xl" overflow="hidden" bg="black" shadow="2xl" w="100%" display="flex" justifyContent="center">
                    <video
                      key={toggleActive}
                      src={status?.download_url_original || ''}
                      controls
                      autoPlay
                      muted
                      playsInline
                      style={{ 
                        width: '100%', 
                        maxHeight: '80vh', 
                        objectFit: 'contain',
                        filter: toggleActive === 'processed' ? 'url(#workspace-daltonize-filter)' : 'none'
                      }}
                    />
                  </Box>
                </Center>
              )}
              <Text fontSize="xs" color="gray.400" mt={3} textAlign="center">
                * Playback controls are fully synchronized in Side-by-Side layout to compare details in real-time.
              </Text>
            </Box>
          )}

          {mediaType === 'pdf' && (
            <Box>
              {displayMode === 'side-by-side' ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <VStack align="stretch" h="650px">
                    <Text fontWeight="bold" fontSize="sm" color="gray.500" mb={1} textAlign="center">Original PDF Document</Text>
                    <iframe
                      src={`${status?.download_url_original}#toolbar=0`}
                      width="100%"
                      height="100%"
                      style={{ border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
                      title="Original PDF"
                    />
                  </VStack>
                  <VStack align="stretch" h="650px">
                    <Text fontWeight="bold" fontSize="sm" color="blue.500" mb={1} textAlign="center">Corrected PDF Document</Text>
                    <iframe
                      src={`${status?.download_url}#toolbar=0`}
                      width="100%"
                      height="100%"
                      style={{ border: '1px solid #BEE3F8', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
                      title="Processed PDF"
                    />
                  </VStack>
                </SimpleGrid>
              ) : (
                <Box h="650px" w="100%">
                  <iframe
                    key={toggleActive}
                    src={toggleActive === 'original' ? (status?.download_url_original || '') : (status?.download_url || '')}
                    width="100%"
                    height="100%"
                    style={{ border: '1px solid #E2E8F0', borderRadius: '16px' }}
                    title="PDF Toggle Viewer"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* WCAG COMPLIANCE SIDEBAR */}
        <Box gridColumn={{ lg: displayMode === 'side-by-side' ? "span 12" : "span 4" }} bg="white" border="1px" borderColor="gray.100" shadow="md" borderRadius="2xl" p={6}>
          {!report ? (
            <Center py={12} flexDir="column" h="100%">
              <Text mb={4} color="gray.600" textAlign="center" fontWeight="medium">
                No compliance report exists for this file.
              </Text>
              <Button
                colorScheme="blue"
                onClick={handleRunAudit}
                isLoading={isAuditing}
                loadingText="Running Real WCAG Audit..."
                size="md"
                shadow="sm"
                borderRadius="xl"
              >
                Run Compliance Check
              </Button>
            </Center>
          ) : (
            <VStack spacing={6} align="stretch">
              {/* Scorecard Widget */}
              <Box bg="slate.50" border="1px" borderColor="gray.100" p={5} borderRadius="2xl" shadow="sm">
                <Text fontSize="md" fontWeight="bold" color="gray.700" mb={4}>Accessibility Audit</Text>
                <HStack justify="space-around" align="center" spacing={4}>
                  <CircularProgress
                    value={report.score}
                    size="90px"
                    thickness="12px"
                    color={report.score >= 90 ? 'green.400' : report.score >= 70 ? 'orange.400' : 'red.400'}
                  >
                    <CircularProgressLabel fontSize="lg" fontWeight="black" color="gray.700">
                      {Math.round(report.score)}%
                    </CircularProgressLabel>
                  </CircularProgress>

                  <VStack align="flex-start" spacing={1}>
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase">Status</Text>
                    <Badge
                      colorScheme={report.status === 'pass' ? 'green' : report.status === 'fail' ? 'red' : 'yellow'}
                      fontSize="md"
                      px={3}
                      py={1}
                      borderRadius="lg"
                    >
                      {report.status.toUpperCase()}
                    </Badge>
                  </VStack>
                </HStack>
              </Box>

              {/* Operations Control Panel */}
              <Box>
                <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" mb={3}>Actions</Text>
                <SimpleGrid columns={2} spacing={3}>
                  <Button
                    leftIcon={<DownloadIcon w={4} h={4} />}
                    size="sm"
                    colorScheme="blue"
                    onClick={handleDownload}
                    borderRadius="xl"
                  >
                    Download File
                  </Button>
                  <Button
                    leftIcon={<ShareIcon w={4} h={4} />}
                    size="sm"
                    variant="outline"
                    colorScheme="blue"
                    onClick={handleShare}
                    borderRadius="xl"
                  >
                    Copy Link
                  </Button>
                </SimpleGrid>
                <Button
                  leftIcon={<RefreshIcon w={4} h={4} />}
                  w="full"
                  mt={3}
                  size="sm"
                  variant="ghost"
                  colorScheme="gray"
                  onClick={handleRunAudit}
                  isLoading={isAuditing}
                  borderRadius="xl"
                >
                  Re-run Core Audit
                </Button>
              </Box>

              <Divider />

              {/* Identified Issues checklist */}
              <Box maxH="400px" overflowY="auto" pr={1}>
                <Text fontSize="sm" fontWeight="bold" color="gray.800" mb={4}>
                  Identified Violations ({report.issues.length})
                </Text>

                {report.issues.length === 0 ? (
                  <Box p={4} bg="green.50" color="green.800" borderRadius="xl" border="1px" borderColor="green.100">
                    <Text fontSize="sm" fontWeight="medium">Excellent! Pixel contrast ratios pass WCAG 2.1 AAA/AA targets.</Text>
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {report.issues.map((issue, idx) => (
                      <Box
                        key={idx}
                        p={4}
                        borderRadius="xl"
                        borderLeft="4px"
                        borderLeftColor={issue.severity === 'Error' ? 'red.400' : 'orange.400'}
                        bg="gray.50"
                        borderWidth="1px"
                        borderColor="gray.100"
                      >
                        <HStack justify="space-between" mb={2}>
                          <HStack>
                            {getSeverityIcon(issue.severity)}
                            <Text fontWeight="black" fontSize="xs" color="gray.800">SC {issue.sc_id}</Text>
                          </HStack>
                          <Badge size="sm" colorScheme={issue.severity === 'Error' ? 'red' : 'orange'} borderRadius="md">
                            {issue.severity}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.600" mb={3} lineHeight="tall">{issue.description}</Text>
                        
                        <Box bg="blue.50" p={3} borderRadius="lg">
                          <Text fontSize="10px" fontWeight="black" color="blue.600" textTransform="uppercase" mb={1}>Recommendation</Text>
                          <Text fontSize="xs" color="blue.800" fontWeight="medium">{issue.suggestion}</Text>
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      </SimpleGrid>
    </Box>
  );
};
