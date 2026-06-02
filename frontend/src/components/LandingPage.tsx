import React, { useState, useEffect } from 'react';
import { Box, VStack, Heading, Text, Button, SimpleGrid, Icon, HStack, Badge, Flex, Card, CardBody, Select, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Image, Center } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiZap, FiShield, FiCheckCircle, FiArrowRight, FiImage, FiVideo, FiFileText } from 'react-icons/fi';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [cvdType, setCvdType] = useState('protanopia');
  const [severity, setSeverity] = useState(1.0);
  const [intensity, setIntensity] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  
  const [sliderPosition, setSliderPosition] = useState(50);
  const [activeDemoImage, setActiveDemoImage] = useState('/pie_chart.png');
  
  const [matrixValues, setMatrixValues] = useState("1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");

  useEffect(() => {
    const mat = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const s = severity;
    if (cvdType === 'protanopia') {
      mat[0][0] = 1.0 - 0.5 * s;
      mat[0][1] = 0.5 * s;
    } else if (cvdType === 'deuteranopia') {
      mat[1][0] = 0.5 * s;
      mat[1][1] = 1.0 - 0.5 * s;
    } else if (cvdType === 'tritanopia') {
      mat[2][1] = 0.5 * s;
      mat[2][2] = 1.0 - 0.5 * s;
    }
    const values = `${mat[0][0]} ${mat[0][1]} ${mat[0][2]} 0 0  ${mat[1][0]} ${mat[1][1]} ${mat[1][2]} 0 0  ${mat[2][0]} ${mat[2][1]} ${mat[2][2]} 0 0  0 0 0 1 0`;
    setMatrixValues(values);
  }, [cvdType, severity]);

  return (
    <Box w="full">
      {/* Hero Section */}
      <Box pt={16} pb={20} textAlign="center">
        <Badge colorScheme="purple" px={3} py={1} borderRadius="full" mb={6} fontSize="sm">
          Bridging the Chromatic Digital Divide
        </Badge>
        <Heading 
          as="h1" 
          fontSize={{ base: "4xl", md: "6xl" }} 
          fontWeight="black" 
          letterSpacing="tight" 
          color="gray.900" 
          mb={6}
          lineHeight="1.2"
        >
          Accessibility Without <Text as="span" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text">Compromise.</Text>
        </Heading>
        <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="3xl" mx="auto" mb={10} lineHeight="tall">
          Over 300 million individuals with Color Vision Deficiency (CVD) are excluded from accessing visually-rich digital content. ChromaShift uses an intelligent Hybrid Adaptive AI framework to personalize media for your unique vision.
        </Text>
        <HStack justify="center" spacing={4}>
          <Button 
            size="lg" 
            colorScheme="blue" 
            bgGradient="linear(to-r, blue.600, purple.600)" 
            _hover={{ bgGradient: "linear(to-r, blue.700, purple.700)" }}
            px={10} 
            py={7} 
            fontSize="lg" 
            fontWeight="bold" 
            borderRadius="xl"
            rightIcon={<FiArrowRight />}
            onClick={() => navigate('/hub')}
          >
            Launch Media Hub
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            colorScheme="gray" 
            px={8} 
            py={7} 
            fontSize="lg" 
            fontWeight="bold" 
            borderRadius="xl"
            onClick={() => navigate('/test-vision')}
          >
            Take Vision Test
          </Button>
        </HStack>

        {/* Media Support Strip */}
        <Box mt={16}>
          <Text fontSize="sm" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={6}>
            Universal Media Processing
          </Text>
          <HStack justify="center" spacing={{ base: 6, md: 12 }}>
            <VStack>
              <Box p={4} bg="blue.50" borderRadius="2xl" color="blue.500" shadow="sm">
                <Icon as={FiImage} boxSize={8} />
              </Box>
              <Text fontWeight="bold" color="gray.700">Images</Text>
            </VStack>
            <VStack>
              <Box p={4} bg="purple.50" borderRadius="2xl" color="purple.500" shadow="sm">
                <Icon as={FiVideo} boxSize={8} />
              </Box>
              <Text fontWeight="bold" color="gray.700">Videos</Text>
            </VStack>
            <VStack>
              <Box p={4} bg="orange.50" borderRadius="2xl" color="orange.500" shadow="sm">
                <Icon as={FiFileText} boxSize={8} />
              </Box>
              <Text fontWeight="bold" color="gray.700">PDFs</Text>
            </VStack>
          </HStack>
          <Text fontSize="sm" color="gray.500" mt={6} maxW="xl" mx="auto">
            Unlike standard web extensions, ChromaShift natively processes images, video files, and PDF documents with full hardware acceleration.
          </Text>
        </Box>
      </Box>

      {/* Interactive Demonstration Section */}
      <Box py={16} textAlign="center" bg="gray.50" borderRadius="3xl" shadow="inner" mb={10} px={8}>
        <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
          <defs>
            <filter id="demo-daltonize-filter" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={matrixValues} />
            </filter>
          </defs>
        </svg>

        <VStack spacing={4} mb={8}>
          <Badge colorScheme="blue">Live Demonstration</Badge>
          <Heading fontSize="3xl" fontWeight="black" color="gray.800">Experience the Shift</Heading>
          <Text fontSize="md" color="gray.500" maxW="2xl">
            Play with the controls below to see how our algorithm dynamically shifts overlapping hues, making complex data visualizations accessible instantly.
          </Text>
        </VStack>

        {/* Playground Controls */}
        <Card variant="outline" borderRadius="2xl" mb={10} maxW="4xl" mx="auto" bg="white" shadow="sm">
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
              <Box>
                <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={2}>CVD Type</Text>
                <Select value={cvdType} onChange={(e) => setCvdType(e.target.value)} colorScheme="blue" borderRadius="lg">
                  <option value="protanopia">Protanopia (Red-Blind)</option>
                  <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
                  <option value="tritanopia">Tritanopia (Blue-Blind)</option>
                </Select>
              </Box>
              <Box>
                <HStack justify="space-between" mb={2} fontSize="sm">
                  <Text fontWeight="bold" color="gray.600">Severity</Text>
                  <Text fontWeight="black" color="blue.600">{severity.toFixed(2)}</Text>
                </HStack>
                <Slider min={0.1} max={1.5} step={0.05} value={severity} onChange={(v) => setSeverity(v)} colorScheme="blue">
                  <SliderTrack bg="gray.100" h="4px"><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={4} />
                </Slider>
              </Box>
              <Box>
                <HStack justify="space-between" mb={2} fontSize="sm">
                  <Text fontWeight="bold" color="gray.600">Intensity (Brightness)</Text>
                  <Text fontWeight="black" color="blue.600">{(intensity * 100).toFixed(0)}%</Text>
                </HStack>
                <Slider min={0.5} max={1.5} step={0.05} value={intensity} onChange={(v) => setIntensity(v)} colorScheme="blue">
                  <SliderTrack bg="gray.100" h="4px"><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={4} />
                </Slider>
              </Box>
              <Box>
                <HStack justify="space-between" mb={2} fontSize="sm">
                  <Text fontWeight="bold" color="gray.600">Contrast</Text>
                  <Text fontWeight="black" color="blue.600">{(contrast * 100).toFixed(0)}%</Text>
                </HStack>
                <Slider min={0.5} max={1.5} step={0.05} value={contrast} onChange={(v) => setContrast(v)} colorScheme="blue">
                  <SliderTrack bg="gray.100" h="4px"><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={4} />
                </Slider>
              </Box>
              <Box>
                <HStack justify="space-between" mb={2} fontSize="sm">
                  <Text fontWeight="bold" color="gray.600">Saturation</Text>
                  <Text fontWeight="black" color="blue.600">{(saturation * 100).toFixed(0)}%</Text>
                </HStack>
                <Slider min={0.5} max={1.5} step={0.05} value={saturation} onChange={(v) => setSaturation(v)} colorScheme="blue">
                  <SliderTrack bg="gray.100" h="4px"><SliderFilledTrack /></SliderTrack>
                  <SliderThumb boxSize={4} />
                </Slider>
              </Box>
              <Flex align="flex-end">
                <Button 
                  size="md" 
                  variant="ghost" 
                  colorScheme="red" 
                  w="full"
                  onClick={() => {
                    setCvdType('protanopia');
                    setSeverity(1.0);
                    setIntensity(1.0);
                    setContrast(1.0);
                    setSaturation(1.0);
                  }}
                >
                  Reset Defaults
                </Button>
              </Flex>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Interactive Image Switcher */}
        <VStack spacing={3} mb={6}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            Select Sample Visualization
          </Text>
          <HStack justify="center" spacing={3}>
            <Button 
              size="sm" 
              colorScheme={activeDemoImage === '/pie_chart.png' ? 'blue' : 'gray'} 
              variant={activeDemoImage === '/pie_chart.png' ? 'solid' : 'outline'}
              onClick={() => setActiveDemoImage('/pie_chart.png')}
              borderRadius="full"
              px={4}
            >
              Pie Chart
            </Button>
            <Button 
              size="sm" 
              colorScheme={activeDemoImage === '/multi_line_comparison.webp' ? 'blue' : 'gray'} 
              variant={activeDemoImage === '/multi_line_comparison.webp' ? 'solid' : 'outline'}
              onClick={() => setActiveDemoImage('/multi_line_comparison.webp')}
              borderRadius="full"
              px={4}
            >
              Line Graph
            </Button>
            <Button 
              size="sm" 
              colorScheme={activeDemoImage === '/heatmap.webp' ? 'blue' : 'gray'} 
              variant={activeDemoImage === '/heatmap.webp' ? 'solid' : 'outline'}
              onClick={() => setActiveDemoImage('/heatmap.webp')}
              borderRadius="full"
              px={4}
            >
              Heatmap Log
            </Button>
          </HStack>
        </VStack>

        {/* Dynamic Before/After Split Slider */}
        <Box 
          position="relative" 
          w="full" 
          maxW="4xl" 
          mx="auto" 
          borderRadius="2xl" 
          overflow="hidden" 
          shadow="2xl" 
          border="1px" 
          borderColor="gray.200" 
          height={{ base: "300px", md: "480px" }}
          bg="white"
        >
          {/* Underlay / Background: Original Image */}
          <Image 
            src={activeDemoImage} 
            alt="Original Data Visualization" 
            w="full" 
            h="full" 
            objectFit="contain" 
            userSelect="none"
          />

          {/* Overlay: Corrected Image with Clip Path */}
          <Image 
            src={activeDemoImage} 
            alt="Corrected Data Visualization" 
            position="absolute"
            top={0}
            left={0}
            w="full" 
            h="full" 
            objectFit="contain" 
            userSelect="none"
            style={{ 
              filter: `url(#demo-daltonize-filter) brightness(${intensity}) contrast(${contrast}) saturate(${saturation})`,
              clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`
            }}
          />

          {/* Separator Line */}
          <Box 
            position="absolute"
            top={0}
            bottom={0}
            left={`${sliderPosition}%`}
            width="3px"
            bg="white"
            shadow="lg"
            transform="translateX(-50%)"
            pointerEvents="none"
            zIndex={2}
          />

          {/* Drag Handle Knob */}
          <Center 
            position="absolute"
            top="50%"
            left={`${sliderPosition}%`}
            transform="translate(-50%, -50%)"
            boxSize="46px"
            borderRadius="full"
            bg="white"
            border="3px solid"
            borderColor="blue.500"
            shadow="2xl"
            pointerEvents="none"
            zIndex={3}
            transition="transform 0.1s"
            _hover={{ transform: 'translate(-50%, -50%) scale(1.05)' }}
          >
            <HStack spacing={0.5} justify="center" userSelect="none">
              <Text fontSize="10px" fontWeight="black" color="blue.500">◀</Text>
              <Text fontSize="10px" fontWeight="black" color="blue.500">▶</Text>
            </HStack>
          </Center>

          {/* Floating HUD Labels */}
          <Box 
            position="absolute" 
            left={4} 
            top={4} 
            bg="black/60" 
            backdropFilter="blur(8px)" 
            px={3} 
            py={1.5} 
            borderRadius="xl" 
            pointerEvents="none" 
            zIndex={4}
            border="1px solid"
            borderColor="white/10"
          >
            <Text fontSize="xs" color="black" fontWeight="black" letterSpacing="wide">Original</Text>
          </Box>
          <Box 
            position="absolute" 
            right={4} 
            top={4} 
            bg="blue.600/80" 
            backdropFilter="blur(8px)" 
            px={3} 
            py={1.5} 
            borderRadius="xl" 
            pointerEvents="none" 
            zIndex={4}
            border="1px solid"
            borderColor="white/10"
          >
            <HStack spacing={1.5}>
              <Badge colorScheme="purple" fontSize="9px" px={1.5} borderRadius="full">Active</Badge>
              <Text fontSize="xs" color="black" fontWeight="black" letterSpacing="wide">ChromaShift</Text>
            </HStack>
          </Box>

          {/* Interactive Invisible Input Range Overlay */}
          <input 
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'ew-resize',
              zIndex: 5
            }}
          />
        </Box>

        <Box mt={12} maxW="3xl" mx="auto">
            <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={4}>Works seamlessly on videos without dropped frames:</Text>
            <Box borderRadius="2xl" overflow="hidden" shadow="xl" border="1px" borderColor="gray.200" bg="black" position="relative">
              <Box position="absolute" top={3} right={3} bg="blue.500" color="white" px={3} py={1} borderRadius="full" fontSize="xs" fontWeight="bold" shadow="md" zIndex={10}>
                GPU Filter Active
              </Box>
              <video src="/chart_infographic.mp4" controls autoPlay loop muted playsInline style={{ width: '100%', height: 'auto', filter: `url(#demo-daltonize-filter) brightness(${intensity}) contrast(${contrast}) saturate(${saturation})` }} />
            </Box>
        </Box>
      </Box>

      {/* Features Section */}
      <Box py={20} bg="white" borderRadius="3xl" shadow="sm" border="1px" borderColor="gray.100" px={8}>
        <VStack spacing={4} mb={16} textAlign="center">
          <Heading fontSize="3xl" fontWeight="black" color="gray.800">Advanced AI Remediation</Heading>
          <Text fontSize="md" color="gray.500" maxW="2xl">
            Our platform goes beyond generic filters. We use state-of-the-art machine learning models to provide semantically-aware color remapping for images, videos, and PDFs.
          </Text>
        </VStack>
        
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={10}>
          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="blue.50" color="blue.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiZap} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Hardware-Accelerated Engine</Heading>
              <Text color="gray.600" lineHeight="tall">
                Leveraging YOLO26-seg (NMS-free, 43% faster CPU inference) with int8-quantised edge deployment alongside real-time WebGL and WebGPU pipelines to process high-resolution media, providing intelligent region-aware Daltonization.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="purple.50" color="purple.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiVideo} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Optical Flow Video Pipelines</Heading>
              <Text color="gray.600" lineHeight="tall">
                Videos are exported in unified H.264 MP4 formats. We run YOLO26n-seg on keyframes and use Optical Flow tracking for temporal smoothing, ensuring zero frame drops and a flicker-free visual experience.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="orange.50" color="orange.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiFileText} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Text-Preserving PDFs</Heading>
              <Text color="gray.600" lineHeight="tall">
                Using PyMuPDF for object-level extraction, we selectively recolor charts and images while perfectly preserving all vector text layers. Your processed documents remain 100% searchable and screen-reader accessible.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="pink.50" color="pink.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiEye} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">LAB Color Space Math</Heading>
              <Text color="gray.600" lineHeight="tall">
                Our algorithm operates entirely in perceptual LAB color space. We guarantee 100% preservation of Lightness (L), shifting unseen color confusion purely into visible (A/B) channels without blowing out the image.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="green.50" color="green.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiShield} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">WCAG 2.1 Auto-Loop</Heading>
              <Text color="gray.600" lineHeight="tall">
                Our backend uses an automated iterative loop that recursively increments correction severity until mathematical WCAG AA contrast compliance (SC 1.4.1, 1.4.3) is achieved.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="teal.50" color="teal.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiCheckCircle} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Accessibility Reports</Heading>
              <Text color="gray.600" lineHeight="tall">
                Export concrete JSON compliance reports detailing tested color pairs, contrast ratios, and actionable remediation suggestions. Perfect for design hand-offs and accessibility teams.
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>
      </Box>

      {/* Impact / SDGs Section */}
      <Box py={20} px={8} mt={10}>
        <Flex direction={{ base: "column", lg: "row" }} align="center" justify="space-between" gap={12}>
          <Box flex={1}>
            <Badge colorScheme="green" mb={4} px={3} py={1} borderRadius="full">Global Impact</Badge>
            <Heading fontSize="4xl" fontWeight="black" color="gray.900" mb={6} lineHeight="1.2">
              Aligning with United Nations Sustainable Development Goals
            </Heading>
            <Text fontSize="lg" color="gray.600" mb={8} lineHeight="tall">
              ChromaShift is designed to foster a more inclusive digital world, directly supporting several key UN SDGs by removing barriers in education, employment, and public communication.
            </Text>
            
            <VStack align="start" spacing={5}>
              <HStack align="start">
                <Icon as={FiCheckCircle} color="blue.500" mt={1} boxSize={5} />
                <Box>
                  <Text fontWeight="bold" color="gray.800">SDG 4: Quality Education</Text>
                  <Text color="gray.600" fontSize="sm">Ensuring students with visual impairments can fully engage with digital curricula and educational diagrams.</Text>
                </Box>
              </HStack>
              <HStack align="start">
                <Icon as={FiCheckCircle} color="purple.500" mt={1} boxSize={5} />
                <Box>
                  <Text fontWeight="bold" color="gray.800">SDG 8: Decent Work and Economic Growth</Text>
                  <Text color="gray.600" fontSize="sm">Ensuring professional media, such as corporate dashboards, are legible for all employees.</Text>
                </Box>
              </HStack>
              <HStack align="start">
                <Icon as={FiCheckCircle} color="green.500" mt={1} boxSize={5} />
                <Box>
                  <Text fontWeight="bold" color="gray.800">SDG 10: Reduced Inequalities</Text>
                  <Text color="gray.600" fontSize="sm">Promoting the social and economic inclusion of persons with disabilities globally.</Text>
                </Box>
              </HStack>
            </VStack>
          </Box>
          <Box flex={1} bgGradient="linear(to-br, blue.50, purple.50)" p={10} borderRadius="3xl" border="1px" borderColor="blue.100" position="relative" overflow="hidden">
            <Box position="absolute" top="-10%" right="-10%" boxSize="300px" bg="purple.200" filter="blur(100px)" opacity="0.4" borderRadius="full" />
            <Box position="absolute" bottom="-10%" left="-10%" boxSize="300px" bg="blue.200" filter="blur(100px)" opacity="0.4" borderRadius="full" />
            
            <VStack spacing={6} position="relative" zIndex={1} align="start">
              <Heading fontSize="2xl" fontWeight="black" color="gray.800">
                Ready to transform your media?
              </Heading>
              <Text color="gray.600">
                Create a personalized vision profile and start Daltonizing your images, videos, and PDFs instantly.
              </Text>
              <Button 
                size="lg" 
                colorScheme="blue" 
                w="full"
                py={7}
                fontSize="md"
                borderRadius="xl"
                onClick={() => navigate('/settings')}
              >
                Create Vision Profile
              </Button>
            </VStack>
          </Box>
        </Flex>
      </Box>

      {/* Privacy & Security Section */}
      <Box py={20} bg="white" borderRadius="3xl" shadow="sm" border="1px" borderColor="gray.100" px={8} mt={10} mb={10}>
        <VStack spacing={4} mb={12} textAlign="center">
          <Badge colorScheme="blue">Privacy by Design</Badge>
          <Heading fontSize="3xl" fontWeight="black" color="gray.800">Your Data Stays Yours</Heading>
          <Text fontSize="md" color="gray.500" maxW="2xl">
            We treat accessibility data as sensitive health and corporate information. Our architecture is built on absolute data minimization.
          </Text>
        </VStack>
        
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="blue.50" color="blue.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiShield} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">7-Day Auto-Expiry</Heading>
              <Text color="gray.600" lineHeight="tall">
                All uploaded media and processed counterparts are permanently deleted from our storage backend after 7 days. A chronological cron job ensures orphaned files are pruned automatically.
              </Text>
            </CardBody>
          </Card>
          
          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="purple.50" color="purple.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiZap} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Local-First Execution</Heading>
              <Text color="gray.600" lineHeight="tall">
                During calibration and live preview, we use WebGPU and TensorFlow.js so visual data never leaves your browser.
              </Text>
            </CardBody>
          </Card>

          <Card variant="unstyled" bg="transparent">
            <CardBody>
              <Box boxSize="48px" bg="green.50" color="green.600" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" mb={6}>
                <Icon as={FiEye} boxSize={6} />
              </Box>
              <Heading fontSize="xl" fontWeight="bold" mb={3} color="gray.800">Anonymous Calibration</Heading>
              <Text color="gray.600" lineHeight="tall">
                Vision profiles track mathematical transformation variables (contrast, severity matrices). We never ask for or require formal medical diagnoses.
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>
      </Box>
    </Box>
  );
};
