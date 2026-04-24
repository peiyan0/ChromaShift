import { useEffect, useState } from 'react';
import { Box, VStack, Heading, Text, Spinner, useToast, Button } from '@chakra-ui/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setStatus('error');
        return;
      }

      try {
        await api.post(`/auth/verify-email?token=${token}`);
        setStatus('success');
        toast({
          title: 'Email Verified',
          description: 'Your account has been successfully verified.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        setStatus('error');
        toast({
          title: 'Verification Failed',
          description: 'The token might be invalid or expired.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    verifyToken();
  }, [searchParams, toast]);

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box p={8} maxWidth="400px" borderWidth={1} borderRadius={8} boxShadow="lg" bg="white" textAlign="center">
        <VStack spacing={4}>
          <Heading size="lg">Email Verification</Heading>
          
          {status === 'loading' && (
            <>
              <Spinner size="xl" color="blue.500" />
              <Text>Verifying your email...</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <Text color="green.500">Thank you! Your email is verified.</Text>
              <Button colorScheme="blue" onClick={() => navigate('/auth/login')}>
                Go to Login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Text color="red.500">We could not verify your email.</Text>
              <Button variant="outline" onClick={() => navigate('/auth/register')}>
                Back to Register
              </Button>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
};

export default EmailVerification;
