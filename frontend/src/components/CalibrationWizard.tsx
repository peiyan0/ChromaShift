import { useState, useEffect, type FC } from 'react';
import { Box, VStack, HStack, Text, Slider, SliderTrack, SliderFilledTrack, SliderThumb, RadioGroup, Radio, Button, Image, Divider, useToast } from '@chakra-ui/react';
import { profileService } from '../services/profile';

export const CalibrationWizard: FC = () => {
  const [cvdType, setCvdType] = useState('deuteranopia');
  const [severity, setSeverity] = useState(70);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  // Load existing profile on mount
  useEffect(() => {
    profileService.getProfile().then(data => {
      if (data) {
        setCvdType(data.cvd_type);
        setSeverity(data.severity);
      }
    }).catch(e => console.error("Could not load profile", e));
  }, []);

  // In a real app, these would be generated dynamically by passing parameters to the client-side TF.js preview model
  const mockOriginalImage = "https://images.unsplash.com/photo-1516117172878-fd2c41f4a759?auto=format&fit=crop&w=400&q=80"; 
  const mockCorrectedImage = "https://images.unsplash.com/photo-1516117172878-fd2c41f4a759?auto=format&fit=crop&w=400&q=80"; // Ideally a differently tinted image

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await profileService.updateProfile({ cvd_type: cvdType, severity });
      toast({
        title: "Profile Saved",
        description: "Your CVD vision profile has been successfully updated.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile. It may not exist yet.",
        status: "error",
      });
      // Fallback to create if update fails (404)
      try {
        await profileService.createProfile({ cvd_type: cvdType, severity });
        toast({ title: "Profile Created", status: "success" });
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="w-full max-w-4xl mx-auto mt-10 p-8 rounded-2xl shadow-xl bg-white border border-gray-100">
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="3xl" fontWeight="bold" color="gray.800">Vision Profile Calibration</Text>
          <Text color="gray.500" mt={2}>
            Adjust the settings below until the corrected image provides the clearest distinction between colors for you.
          </Text>
        </Box>

        <Divider />

        <HStack spacing={10} align="start" flexDir={{ base: "column", md: "row" }}>
          {/* Controls Panel */}
          <VStack flex={1} spacing={6} align="stretch">
            <Box>
              <Text fontWeight="bold" mb={3}>Color Vision Deficiency Type</Text>
              <RadioGroup onChange={setCvdType} value={cvdType}>
                <VStack align="start" spacing={3}>
                  <Radio value="protanopia" colorScheme="blue">Protanopia (Red-blind)</Radio>
                  <Radio value="deuteranopia" colorScheme="blue">Deuteranopia (Green-blind)</Radio>
                  <Radio value="tritanopia" colorScheme="blue">Tritanopia (Blue-blind)</Radio>
                </VStack>
              </RadioGroup>
            </Box>

            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="bold">Severity / Correction Intensity</Text>
                <Text fontWeight="medium" color="blue.500">{severity}%</Text>
              </HStack>
              <Slider 
                aria-label="severity-slider" 
                defaultValue={70} 
                min={0} 
                max={100} 
                onChange={(v) => setSeverity(v)}
                colorScheme="blue"
              >
                <SliderTrack bg="gray.200">
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb boxSize={6} />
              </Slider>
              <Text fontSize="xs" color="gray.400" mt={2}>
                Higher intensity pushes confused colors further apart orthogonally.
              </Text>
            </Box>

            <Button colorScheme="blue" size="lg" mt={4} onClick={handleSave} isLoading={isSaving}>
              Save Vision Profile
            </Button>
          </VStack>

          {/* Preview Panel */}
          <VStack flex={1} spacing={4} w="full">
            <Text fontWeight="bold" alignSelf="start">Live Preview</Text>
            <Box className="relative w-full rounded-xl overflow-hidden shadow-inner border border-gray-200" bg="gray.50" h="250px">
              <HStack h="full" spacing={0}>
                <Box flex={1} h="full" pos="relative">
                  <Image src={mockOriginalImage} objectFit="cover" w="full" h="full" opacity={0.6} />
                  <Box pos="absolute" top={2} left={2} bg="blackAlpha.700" color="white" px={2} py={1} borderRadius="md" fontSize="xs" fontWeight="bold">Original</Box>
                </Box>
                <Box w="2px" bg="white" zIndex={10} />
                <Box flex={1} h="full" pos="relative">
                  <Image src={mockCorrectedImage} objectFit="cover" w="full" h="full" filter={severity > 50 ? "contrast(1.2) saturate(1.5) hue-rotate(15deg)" : "none"} transition="all 0.3s" />
                  <Box pos="absolute" top={2} right={2} bg="blue.500" color="white" px={2} py={1} borderRadius="md" fontSize="xs" fontWeight="bold">Corrected</Box>
                </Box>
              </HStack>
            </Box>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              (In a full integration, this preview uses TensorFlow.js to render your specific severity instantly.)
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
};
