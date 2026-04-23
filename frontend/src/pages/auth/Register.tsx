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
import axios from 'axios';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post('http://localhost:8000/api/v1/auth/register', {
        email,
        password
      });
      toast({
        title: 'Account created.',
        description: "We've created your account for you.",
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/auth/login');
    } catch (error: any) {
      toast({
        title: 'Error creating account.',
        description: error.response?.data?.detail || "Something went wrong",
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
        <VStack spacing={4} as="form" onSubmit={handleRegister}>
          <Heading size="lg">Create Account</Heading>
          <Text color="gray.500">Google Antigravity Platform</Text>
          
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
            Register
          </Button>
          
          <Text>
            Already have an account?{' '}
            <ChakraLink as={RouterLink} to="/auth/login" color="blue.500">
              Log In
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default Register;
