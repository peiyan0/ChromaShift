import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Icon,
  HStack,
  Box,
  Heading,
} from '@chakra-ui/react';
import { FiTrendingUp, FiLock, FiMail } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PromoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromoteModal: React.FC<PromoteModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { promote } = useAuth();

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Call backend promote endpoint
      await api.post('/auth/promote', {
        email,
        password,
      });

      // Update auth context state to permanent
      promote();

      toast({
        title: 'Account secured!',
        description: 'Your guest session has been successfully migrated to a permanent account.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Promotion failed.',
        description: error.response?.data?.detail || 'An error occurred during account migration.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
      <ModalContent
        bg="white"
        borderRadius="2xl"
        shadow="2xl"
        overflow="hidden"
        border="1px"
        borderColor="gray.100"
      >
        <Box bgGradient="linear(to-r, blue.600, purple.600)" px={6} py={8} color="white" position="relative">
          <ModalCloseButton color="white" top={4} right={4} />
          <VStack align="start" spacing={2}>
            <HStack bg="whiteAlpha.200" px={3} py={1} borderRadius="full" spacing={2}>
              <Icon as={FiTrendingUp} w={4} h={4} color="yellow.300" />
              <Text fontSize="xs" fontWeight="bold" letterSpacing="wider" textTransform="uppercase">
                Keep Your Progress
              </Text>
            </HStack>
            <Heading size="md" fontWeight="black" mt={2}>
              Promote Guest Session
            </Heading>
            <Text fontSize="sm" opacity={0.9} mt={1}>
              Secure your customized vision calibration profiles, processed video logs, and accessibility audits.
            </Text>
          </VStack>
        </Box>

        <ModalBody px={6} py={6} as="form" onSubmit={handlePromote}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
                Email Address
              </FormLabel>
              <HStack>
                <Icon as={FiMail} color="gray.400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  focusBorderColor="blue.500"
                  borderRadius="xl"
                />
              </HStack>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
                Password
              </FormLabel>
              <HStack>
                <Icon as={FiLock} color="gray.400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  focusBorderColor="purple.500"
                  borderRadius="xl"
                />
              </HStack>
            </FormControl>
          </VStack>

          <Button
            type="submit"
            w="full"
            mt={6}
            colorScheme="blue"
            bgGradient="linear(to-r, blue.600, purple.600)"
            _hover={{ bgGradient: 'linear(to-r, blue.700, purple.700)' }}
            isLoading={isLoading}
            size="lg"
            borderRadius="xl"
            fontWeight="bold"
            shadow="lg"
          >
            Create Permanent Account
          </Button>
        </ModalBody>
        <ModalFooter bg="gray.50" px={6} py={4} borderTop="1px" borderColor="gray.100">
          <Text fontSize="xs" color="gray.500" textAlign="center" w="full">
            By promoting, all current guest files and profiles are immediately bound to this email.
          </Text>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
