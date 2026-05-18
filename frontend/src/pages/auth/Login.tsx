import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  Link as ChakraLink
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      login(response.data.access_token);
      
      toast({
        title: 'Logged in successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Navigate to dashboard or profile setup
      navigate('/'); 
    } catch (error: any) {
      toast({
        title: 'Error logging in.',
        description: error.response?.data?.detail || "Invalid credentials",
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box p={8} maxWidth="400px" borderWidth={1} borderRadius={8} boxShadow="lg" bg="white">
        <VStack spacing={4} as="form" onSubmit={handleLogin}>
          <Heading size="lg">Log In</Heading>
          <Text color="gray.500">CVD Accessibility Platform</Text>
          
          <FormControl isRequired>
            <FormLabel>Email address</FormLabel>
            <Input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email" 
            />
          </FormControl>
          
          <FormControl isRequired>
            <FormLabel>Password</FormLabel>
            <Input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password" 
            />
          </FormControl>
          
          <Button 
            width="full" 
            mt={4} 
            colorScheme="blue" 
            isLoading={isLoading}
            type="submit"
          >
            Log In
          </Button>
          
          <Text>
            Don't have an account?{' '}
            <ChakraLink as={RouterLink} to="/auth/register" color="blue.500">
              Register
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default Login;
