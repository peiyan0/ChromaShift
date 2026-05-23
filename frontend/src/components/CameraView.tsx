import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Badge,
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
  CardBody
} from '@chakra-ui/react';
import * as tf from '@tensorflow/tfjs';
import { profileService, type VisionProfile } from '../services/profile';

export const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toast = useToast();

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [profile, setProfile] = useState<VisionProfile>({ cvd_type: 'deuteranopia', severity: 1.0 });
  const [isActive, setIsActive] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Mutable refs for real-time requestAnimationFrame access without re-binding loop
  const settingsRef = useRef({
    cvdType: 'deuteranopia',
    severity: 1.0,
    isActive: true
  });

  useEffect(() => {
    // Sync React state to refs for the render loop
    settingsRef.current.cvdType = profile.cvd_type;
    settingsRef.current.severity = profile.severity;
    settingsRef.current.isActive = isActive;
  }, [profile, isActive]);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let animationId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const setupTF = async () => {
      try {
        await tf.ready();
        // Force WebGL backend for GPU acceleration
        await tf.setBackend('webgl');
        console.log(`TF.js initialized successfully on backend: ${tf.getBackend()}`);
      } catch (err) {
        console.warn('Failed to initialize WebGL backend, falling back to default:', err);
      }
    };

    const loadProfileAndCamera = async () => {
      try {
        // 1. Initialize TensorFlow.js
        await setupTF();

        // 2. Fetch User Vision Profile
        try {
          const savedProfile = await profileService.getProfile();
          setProfile({
            cvd_type: savedProfile.cvd_type || 'deuteranopia',
            severity: savedProfile.severity !== undefined ? savedProfile.severity : 1.0
          });
        } catch (err) {
          console.log("Could not load vision profile, using default calibration");
        }

        // 3. Initialize Webcam Stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().then(() => {
                setIsInitializing(false);
                // Trigger the real-time render loop
                animationId = requestAnimationFrame(renderLoop);
              });
            }
          };
        }
      } catch (error) {
        toast({
          title: "Camera Initialization Failed",
          description: "Please grant camera permissions and ensure no other application is using it.",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        setIsInitializing(false);
      }
    };

    // Pre-allocated 3x3 Laplacian Edge-detection Kernel for high-pass boundary mask
    const laplacianKernel = tf.tensor4d([
      0,  1, 0,
      1, -4, 1,
      0,  1, 0
    ], [3, 3, 1, 1]);

    const renderLoop = () => {
      if (!active || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.paused || video.ended || video.readyState < 2) {
        animationId = requestAnimationFrame(renderLoop);
        return;
      }

      // Maintain exact video aspect ratio in canvas
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const { cvdType, severity, isActive: correctionActive } = settingsRef.current;

      if (!correctionActive) {
        // Draw original video frame directly with zero processing overhead
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        // 100% Client-Side WebGL-accelerated Tensor Remapping Pipeline
        tf.tidy(() => {
          // A. Load camera pixels to 3D float tensor
          const inputTensor = tf.browser.fromPixels(video);
          const imgFloat = tf.cast(inputTensor, 'float32');

          // B. Slice RGB channels
          const r = imgFloat.slice([0, 0, 0], [-1, -1, 1]);
          const g = imgFloat.slice([0, 0, 1], [-1, -1, 1]);
          const b = imgFloat.slice([0, 0, 2], [-1, -1, 1]);

          // C. Calculate Luminance (standard WCAG relative weights)
          const lum = tf.add(
            tf.add(r.mul(0.2126), g.mul(0.7152)),
            b.mul(0.0722)
          );

          // D. Dynamic Edge contrast/attention map using 2D convolution
          // Laplacian filter highlights sharp boundaries (text, icons, borders)
          const edges = tf.abs(tf.conv2d(lum as tf.Tensor3D, laplacianKernel, 1, 'same'));
          
          // Smooth boundary mask mapping values to [0, 1] using standard sigmoid
          const mask = tf.sigmoid(edges.sub(12).mul(0.2));

          // E. Math Shifting Logic (RGB)
          let finalR = r;
          let finalG = g;
          let finalB = b;

          const m = mask.mul(tf.scalar(severity));

          if (cvdType === 'protanopia') {
            // Protanopia: Shift Red channel using Green
            finalR = r.mul(tf.scalar(1).sub(m.mul(0.5))).add(g.mul(m.mul(0.5)));
          } else if (cvdType === 'tritanopia') {
            // Tritanopia: Shift Blue channel using Green
            finalB = b.mul(tf.scalar(1).sub(m.mul(0.5))).add(g.mul(m.mul(0.5)));
          } else {
            // Deuteranopia: Shift Green channel using Red
            finalG = g.mul(tf.scalar(1).sub(m.mul(0.5))).add(r.mul(m.mul(0.5)));
          }

          // F. Stack back to RGB and clip to [0, 255]
          const stacked = tf.concat([finalR, finalG, finalB], 2);
          const clipped = tf.clipByValue(stacked, 0, 255);
          const outputTensor = tf.cast(clipped, 'int32');

          // G. Draw output tensor directly onto WebGL canvas
          tf.browser.toPixels(outputTensor as tf.Tensor3D, canvas);
        });
      }

      // Compute performance FPS metrics
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    loadProfileAndCamera();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
      laplacianKernel.dispose();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleProfileChange = (key: keyof VisionProfile, value: any) => {
    setProfile(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await profileService.updateProfile({
        cvd_type: profile.cvd_type,
        severity: profile.severity
      });
      toast({
        title: "Profile Saved",
        description: "Your calibration settings have been persisted successfully.",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to update your vision profile on the server.",
        status: "error",
        duration: 4000,
        isClosable: true
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <Box w="full" maxW="4xl" mx="auto" mt={6} px={4}>
      <Flex direction="column" gap={6}>
        {/* Header Block */}
        <Flex justify="space-between" align="center" bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.100">
          <VStack align="flex-start" spacing={1}>
            <HStack>
              <Heading size="md" color="gray.800">Live Camera Studio</Heading>
              <Badge colorScheme={isActive ? "green" : "gray"} borderRadius="md">
                {isActive ? "Remapping Active" : "Original Feed"}
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.400">Powered by TensorFlow.js (WebGL Accelerated)</Text>
          </VStack>
          <HStack spacing={4}>
            <Text fontWeight="black" fontSize="sm" color="blue.600">{fps} FPS</Text>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="correction-toggle" mb="0" fontSize="sm" fontWeight="bold">
                Correction
              </FormLabel>
              <Switch id="correction-toggle" isChecked={isActive} onChange={(e) => setIsActive(e.target.checked)} colorScheme="blue" />
            </FormControl>
          </HStack>
        </Flex>

        {/* Live Camera Viewport */}
        <Box
          position="relative"
          w="full"
          borderRadius="2xl"
          overflow="hidden"
          bg="black"
          shadow="2xl"
          border="1px"
          borderColor="gray.800"
          aspectRatio={4/3}
        >
          {/* Hidden HTML5 Video Stream Source */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />

          {/* Render WebGL Output Canvas */}
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {isInitializing && (
            <Center position="absolute" top={0} left={0} w="full" h="full" bg="black" zIndex={2}>
              <VStack spacing={4}>
                <Spinner size="xl" color="blue.500" thickness="4px" />
                <Text color="gray.300" fontWeight="medium">Initializing Local GPU Correction...</Text>
              </VStack>
            </Center>
          )}
        </Box>

        {/* Overlay Interactive Calibration Controls */}
        <Card border="1px" borderColor="gray.100" shadow="lg" borderRadius="2xl">
          <CardBody p={5}>
            <VStack spacing={5} align="stretch">
              <Text fontSize="sm" fontWeight="black" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                Real-Time Calibration Controls
              </Text>
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                {/* CVD Mode Select */}
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="bold" color="gray.700">Vision Profile Mode</FormLabel>
                  <Select
                    value={profile.cvd_type}
                    onChange={(e) => handleProfileChange('cvd_type', e.target.value)}
                    borderRadius="xl"
                    size="md"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'blue.400' }}
                  >
                    <option value="deuteranopia">Green-blind (Deuteranopia) - struggle to tell green and red apart</option>
                    <option value="protanopia">Red-blind (Protanopia) - struggle to tell red and green apart</option>
                    <option value="tritanopia">Blue-blind (Tritanopia) - struggle to tell blue and green, yellow and pink apart</option>
                  </Select>
                </FormControl>

                {/* Severity Slider */}
                <FormControl>
                  <Flex justify="space-between" align="center" mb={2}>
                    <FormLabel fontSize="sm" fontWeight="bold" color="gray.700" mb={0}>
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
                    onChange={(val) => handleProfileChange('severity', val)}
                    colorScheme="blue"
                  >
                    <SliderTrack borderRadius="full" height="6px">
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb boxSize={6} border="2px solid" borderColor="blue.500" shadow="md" />
                  </Slider>
                </FormControl>
              </SimpleGrid>

              <Button
                colorScheme="blue"
                size="md"
                borderRadius="xl"
                onClick={handleSaveProfile}
                isLoading={isSavingProfile}
                loadingText="Saving Settings..."
                shadow="sm"
                alignSelf="flex-end"
              >
                Save Settings to Profile
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Flex>
    </Box>
  );
};

export default CameraView;