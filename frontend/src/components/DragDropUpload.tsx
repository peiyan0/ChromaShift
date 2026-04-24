import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, VStack, Icon, Progress, useToast, Button, HStack } from '@chakra-ui/react';
import { mediaService } from '../services/media';
import { useNavigate } from 'react-router-dom';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

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
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(10);
    
    try {
      // 1. Upload to S3
      const uploadRes = await mediaService.uploadMedia(file);
      setProgress(40);
      
      // 2. Trigger processing
      await mediaService.processMedia(uploadRes.job_id, {});
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
          setTimeout(() => navigate('/'), 1500);
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

  return (
    <Box 
      className="w-full max-w-2xl mx-auto mt-10 p-6 rounded-2xl shadow-xl bg-white border border-gray-100"
    >
      <VStack spacing={6}>
        <Text fontSize="2xl" fontWeight="bold" color="gray.800">Upload Media</Text>
        <Text color="gray.500" textAlign="center">
          Upload an image, video, or PDF to automatically apply your CVD vision profile corrections.
        </Text>

        <Box
          w="full"
          p={10}
          border="2px dashed"
          borderColor={isDragging ? "blue.400" : "gray.300"}
          borderRadius="xl"
          bg={isDragging ? "blue.50" : "gray.50"}
          transition="all 0.2s"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          cursor="pointer"
          _hover={{ bg: "gray.100" }}
        >
          <VStack spacing={4}>
            <UploadIcon w={12} h={12} color={isDragging ? "blue.500" : "gray.400"} />
            <Text fontWeight="medium" color="gray.600">
              {file ? file.name : "Drag & drop files here, or click to browse"}
            </Text>
            {!file && <Text fontSize="sm" color="gray.400">Supports JPG, PNG, WEBP, MP4, PDF</Text>}
          </VStack>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
          />
        </Box>

        {isUploading && (
          <Box w="full">
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Processing...</Text>
              <Text fontSize="sm">{Math.round(progress)}%</Text>
            </HStack>
            <Progress value={progress} size="sm" colorScheme="blue" borderRadius="full" hasStripe isAnimated={progress < 100} />
          </Box>
        )}

        <Button 
          colorScheme="blue" 
          size="lg" 
          w="full" 
          isDisabled={!file || isUploading}
          onClick={handleUpload}
          isLoading={isUploading}
          loadingText="Uploading"
        >
          Upload & Process
        </Button>
      </VStack>
    </Box>
  );
};
