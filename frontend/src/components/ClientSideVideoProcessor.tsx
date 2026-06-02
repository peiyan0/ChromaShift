import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Select,
  SimpleGrid,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Switch,
  FormControl,
  FormLabel,
  Spinner,
  Center,
  useToast,
  Card,
  CardBody,
  Progress,
  Icon,
} from '@chakra-ui/react';
import {
  FiPlay,
  FiPause,
  FiDownload,
  FiCpu,
  FiCheckCircle,
  FiX,
  FiSliders,
  FiInfo,
} from 'react-icons/fi';
import * as tf from '@tensorflow/tfjs';
import { profileService, type VisionProfile } from '../services/profile';
import { aiPreviewService } from '../services/ai_preview';

const KEYFRAME_INTERVAL = 20;

interface ClientSideVideoProcessorProps {
  file: File;
  onCancel: () => void;
}

export const ClientSideVideoProcessor: React.FC<ClientSideVideoProcessorProps> = ({ file, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toast = useToast();

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [profile, setProfile] = useState<VisionProfile>({ cvd_type: 'deuteranopia', severity: 1.0 });
  const [isLivePreview, setIsLivePreview] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);

  // Settings ref for real-time requestAnimationFrame access
  const settingsRef = useRef({
    cvdType: 'deuteranopia',
    severity: 1.0,
    isLivePreview: true,
    isProcessing: false,
  });

  const videoUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // Refs for keyframe-based YOLO semantic mask
  const segMaskRef = useRef<{ data: Float32Array; w: number; h: number } | null>(null);
  const maskFrameCountRef = useRef<number>(0);
  const maskPendingRef = useRef<boolean>(false);

  useEffect(() => {
    // Synchronize states to refs
    settingsRef.current.cvdType = profile.cvd_type;
    settingsRef.current.severity = profile.severity;
    settingsRef.current.isLivePreview = isLivePreview;
    settingsRef.current.isProcessing = isProcessing;
  }, [profile, isLivePreview, isProcessing]);

  useEffect(() => {
    // Generate object URL for the local video file
    videoUrlRef.current = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = videoUrlRef.current;
    }

    const setupTF = async () => {
      try {
        await tf.ready();
        await tf.setBackend('webgl');
      } catch (err) {
        console.warn('Failed to initialize WebGL backend, falling back to CPU/WASM:', err);
      }
    };

    const initProcessor = async () => {
      try {
        await setupTF();

        try {
          const savedProfile = await profileService.getProfile();
          setProfile({
            cvd_type: savedProfile.cvd_type || 'deuteranopia',
            severity: savedProfile.severity !== undefined ? savedProfile.severity : 1.0
          });
        } catch (err) {
          console.log("Could not load vision profile, using default values");
        }

        setIsInitializing(false);
      } catch (error) {
        toast({
          title: "GPU initialization failed",
          description: "Could not initialize WebGL accelerator.",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        setIsInitializing(false);
      }
    };

    initProcessor();

    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [file]);

  const startRenderLoop = () => {
    if (animationFrameIdRef.current) return;

    let lastTime = performance.now();
    let frameCount = 0;

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      if (video.paused || video.ended || video.readyState < 2) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Sync canvas dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      const { cvdType, severity, isLivePreview: activePreview, isProcessing: activeProcessing } = settingsRef.current;

      if (!activePreview && !activeProcessing) {
        // Draw raw video directly
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        const w = canvas.width;
        const h = canvas.height;

        // Fire YOLO keyframe segmentation non-blocking every KEYFRAME_INTERVAL frames
        maskFrameCountRef.current++;
        if (maskFrameCountRef.current % KEYFRAME_INTERVAL === 0 && !maskPendingRef.current) {
          maskPendingRef.current = true;
          const offscreen = new OffscreenCanvas(w, h);
          const octx = offscreen.getContext('2d')!;
          octx.drawImage(video, 0, 0, w, h);
          const imageData = octx.getImageData(0, 0, w, h);
          aiPreviewService.getSemanticMask(imageData).then(data => {
            segMaskRef.current = { data, w, h };
            maskPendingRef.current = false;
          }).catch(() => {
            maskPendingRef.current = false;
          });
        }

        // GPU accelerated Daltonization with YOLO semantic mask
        tf.tidy(() => {
          const inputTensor = tf.browser.fromPixels(video);
          const imgFloat = tf.cast(inputTensor, 'float32');

          const r = imgFloat.slice([0, 0, 0], [-1, -1, 1]);
          const g = imgFloat.slice([0, 0, 1], [-1, -1, 1]);
          const b = imgFloat.slice([0, 0, 2], [-1, -1, 1]);

          // Use held YOLO semantic mask; fall back to uniform if not yet computed
          const stored = segMaskRef.current;
          const maskData = (stored && stored.w === w && stored.h === h)
            ? stored.data
            : new Float32Array(w * h).fill(1.0);
          const maskTensor = tf.tensor3d(maskData, [h, w, 1]);

          const m = maskTensor.mul(tf.scalar(severity));

          let finalR = r;
          let finalG = g;
          let finalB = b;

          if (cvdType === 'protanopia') {
            // Protanopia: Reduce red, boost blue to compensate for red-blindness
            finalR = r.mul(tf.scalar(1).sub(m.mul(0.4)));
            finalB = b.add(r.sub(g).relu().mul(m.mul(0.3)));
          } else if (cvdType === 'tritanopia') {
            // Tritanopia: Shift blue-yellow confusion into red-green
            finalB = b.mul(tf.scalar(1).sub(m.mul(0.5))).add(g.mul(m.mul(0.5)));
          } else {
            // Deuteranopia: Reduce green, boost yellow to compensate for green-blindness
            finalG = g.mul(tf.scalar(1).sub(m.mul(0.4)));
            finalB = b.add(g.sub(r).relu().mul(m.mul(0.3)));
          }

          const stacked = tf.concat([finalR, finalG, finalB], 2);
          const clipped = tf.clipByValue(stacked, 0, 255);
          const outputTensor = tf.cast(clipped, 'int32');

          tf.browser.toPixels(outputTensor as tf.Tensor3D, canvas);
        });
      }

      // Progress reporting during export
      if (activeProcessing) {
        const curProgress = (video.currentTime / video.duration) * 100;
        setProgress(curProgress);

        if (video.currentTime >= video.duration - 0.1 || video.ended) {
          // Finalize export
          stopExport();
          return;
        }
      }

      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);
  };

  const stopRenderLoop = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      stopRenderLoop();
    } else {
      video.play().then(() => {
        setIsPlaying(true);
        startRenderLoop();
      });
    }
  };

  const handleStartExport = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Reset video to start
    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
    stopRenderLoop();

    // Prepare canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Build capture stream (30 fps)
    const stream = canvas.captureStream(30);
    const combinedStream = new MediaStream([stream.getVideoTracks()[0]]);

    // Capture audio if available
    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream.addTrack(audioTracks[0]);
        }
      }
    } catch (e) {
      console.log("No audio track detected or captured from source video.");
    }

    recordedChunksRef.current = [];
    let recorder: MediaRecorder;
    
    // Choose appropriate mimeType for maximum support
    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    try {
      recorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      recorder = new MediaRecorder(combinedStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setIsProcessing(false);
      setProgress(100);
      toast({
        title: "Export Completed!",
        description: "Your color-corrected video is ready for download.",
        status: "success",
        duration: 4000,
        isClosable: true
      });
    };

    recorderRef.current = recorder;
    setIsProcessing(true);
    setProgress(0);

    // Mute video to prevent playing audio through speakers during fast export
    video.muted = true;
    
    recorder.start();
    video.play().then(() => {
      setIsPlaying(true);
      startRenderLoop();
    });
  };

  const stopExport = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = false;
    }
    setIsPlaying(false);
    stopRenderLoop();

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleDownload = () => {
    if (!exportUrl) return;
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = `daltonized_${file.name.split('.')[0]}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setExportUrl(null);
    setProgress(0);
    setIsProcessing(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
    }
  };

  return (
    <Box w="full" maxW="3xl" mx="auto" mt={8}>
      <Card borderRadius="2xl" border="1px" borderColor="gray.200" shadow="xl" overflow="hidden">
        {/* Title / Action Header */}
        <Flex justify="space-between" align="center" bgGradient="linear(to-r, blue.600, purple.600)" px={6} py={4} color="white">
          <HStack spacing={3}>
            <Icon as={FiCpu} w={6} h={6} color="yellow.300" />
            <VStack align="start" spacing={0}>
              <Heading size="sm">Local GPU Video Remapper</Heading>
              <Text fontSize="xs" opacity={0.85}>Zero uploads. Processed entirely on your machine.</Text>
            </VStack>
          </HStack>
          <Button size="xs" colorScheme="whiteAlpha" leftIcon={<FiX />} onClick={onCancel}>
            Cancel
          </Button>
        </Flex>

        <CardBody p={6}>
          {isInitializing ? (
            <Center py={10}>
              <VStack spacing={4}>
                <Spinner size="xl" color="blue.500" thickness="4px" />
                <Text color="gray.600" fontWeight="bold">Initializing GPU Pipeline & Model Parameters...</Text>
              </VStack>
            </Center>
          ) : (
            <VStack spacing={6} align="stretch">
              {/* Info Banner */}
              {!isProcessing && !exportUrl && (
                <HStack bg="blue.50" border="1px" borderColor="blue.100" p={3.5} borderRadius="xl" spacing={3}>
                  <Icon as={FiInfo} color="blue.500" w={5} h={5} />
                  <Text fontSize="xs" color="blue.800" fontWeight="medium">
                    Adjust CVD types and sliders to instantly see the active corrections. Play the video to preview, or click <strong>Start GPU Remap</strong> to render & save the file.
                  </Text>
                </HStack>
              )}

              {/* Viewport Screen */}
              <Box
                position="relative"
                w="full"
                borderRadius="xl"
                overflow="hidden"
                bg="black"
                aspectRatio={16/9}
                shadow="inner"
                border="1px"
                borderColor="gray.800"
              >
                {/* Source video element (hidden or overlaid) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  preload="auto"
                  crossOrigin="anonymous"
                  style={{ display: 'none' }}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (!isProcessing) {
                      stopRenderLoop();
                    }
                  }}
                />

                {/* Canvas renderer */}
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Processing Overlay Screen */}
                {isProcessing && (
                  <Center position="absolute" top={0} left={0} w="full" h="full" bg="blackAlpha.700" backdropFilter="blur(4px)" zIndex={5}>
                    <VStack spacing={4} w="80%">
                      <Spinner size="xl" color="purple.500" thickness="4px" />
                      <Text color="white" fontWeight="black" letterSpacing="wide" fontSize="md">
                        RENDERING accessible video...
                      </Text>
                      <Progress value={progress} colorScheme="purple" size="md" w="full" borderRadius="full" hasStripe isAnimated />
                      <HStack justify="space-between" w="full" px={1}>
                        <Text color="gray.400" fontSize="xs">{Math.round(progress)}% done</Text>
                        <Text color="yellow.400" fontSize="xs" fontWeight="black">{fps} FPS Speed</Text>
                      </HStack>
                      <Button colorScheme="red" size="sm" onClick={stopExport} mt={2}>
                        Abort Export
                      </Button>
                    </VStack>
                  </Center>
                )}

                {/* Success Export Screen */}
                {exportUrl && (
                  <Center position="absolute" top={0} left={0} w="full" h="full" bg="blackAlpha.800" backdropFilter="blur(8px)" zIndex={5}>
                    <VStack spacing={5}>
                      <Icon as={FiCheckCircle} w={16} h={16} color="green.400" />
                      <VStack spacing={1}>
                        <Heading size="md" color="white" fontWeight="black">Export Completed Successfully</Heading>
                        <Text color="gray.300" fontSize="sm">Local GPU Daltonization rendering finished.</Text>
                      </VStack>
                      <HStack spacing={4}>
                        <Button colorScheme="green" size="md" leftIcon={<FiDownload />} onClick={handleDownload}>
                          Download Remapped Video
                        </Button>
                        <Button colorScheme="whiteAlpha" variant="outline" size="md" onClick={handleReset}>
                          Reset & Re-process
                        </Button>
                      </HStack>
                    </VStack>
                  </Center>
                )}
              </Box>

              {/* Live Preview Play controls */}
              {!isProcessing && !exportUrl && (
                <HStack justify="space-between" bg="gray.50" px={4} py={3} borderRadius="xl" border="1px" borderColor="gray.100">
                  <Button
                    leftIcon={isPlaying ? <FiPause /> : <FiPlay />}
                    colorScheme="blue"
                    size="sm"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? 'Pause Preview' : 'Play Live Preview'}
                  </Button>
                  <HStack spacing={4}>
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">
                      WebGL Rendering: <span style={{ color: '#2B6CB0' }}>{isPlaying ? `${fps} FPS` : 'Ready'}</span>
                    </Text>
                    <FormControl display="flex" alignItems="center" w="auto">
                      <FormLabel htmlFor="preview-correction" mb="0" fontSize="xs" fontWeight="bold" color="gray.600">
                        Correction Applied
                      </FormLabel>
                      <Switch
                        id="preview-correction"
                        isChecked={isLivePreview}
                        onChange={(e) => setIsLivePreview(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </FormControl>
                  </HStack>
                </HStack>
              )}

              {/* Calibration Settings Card */}
              {!isProcessing && !exportUrl && (
                <Box border="1px" borderColor="gray.100" p={5} borderRadius="xl" shadow="sm">
                  <VStack spacing={5} align="stretch">
                    <HStack>
                      <Icon as={FiSliders} color="blue.500" />
                      <Text fontSize="xs" fontWeight="black" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                        Color Shifting Tuning parameters
                      </Text>
                    </HStack>
                    
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
                          CVD Deficiency Type
                        </FormLabel>
                        <Select
                          value={profile.cvd_type}
                          onChange={(e) => setProfile(prev => ({ ...prev, cvd_type: e.target.value as any }))}
                          borderRadius="xl"
                          borderColor="gray.200"
                        >
                          <option value="deuteranopia">Green-blind (Deuteranopia) - struggle to tell green and red apart</option>
                          <option value="protanopia">Red-blind (Protanopia) - struggle to tell red and green apart</option>
                          <option value="tritanopia">Blue-blind (Tritanopia) - struggle to tell blue and green, yellow and pink apart</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <Flex justify="space-between" align="center" mb={2}>
                          <FormLabel fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase" mb={0}>
                            Correction Strength (Severity)
                          </FormLabel>
                          <Text fontSize="xs" fontWeight="black" color="blue.600">
                            {(profile.severity * 100).toFixed(0)}%
                          </Text>
                        </Flex>
                        <Slider
                          min={0.0}
                          max={2.0}
                          step={0.05}
                          value={profile.severity}
                          onChange={(val) => setProfile(prev => ({ ...prev, severity: val }))}
                          colorScheme="blue"
                        >
                          <SliderTrack borderRadius="full" height="5px">
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb boxSize={5} border="2px solid" borderColor="blue.500" />
                        </Slider>
                      </FormControl>
                    </SimpleGrid>

                    <Button
                      colorScheme="purple"
                      bgGradient="linear(to-r, blue.600, purple.600)"
                      size="lg"
                      borderRadius="xl"
                      fontWeight="black"
                      h={12}
                      onClick={handleStartExport}
                      shadow="md"
                    >
                      Start GPU Remap & Export Video
                    </Button>
                  </VStack>
                </Box>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>
    </Box>
  );
};
