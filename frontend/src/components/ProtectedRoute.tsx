import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Center, Spinner } from '@chakra-ui/react';

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  
  if (isInitializing) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" color="blue.600" thickness="4px" />
      </Center>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }
  
  return children;
};

