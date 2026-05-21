import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Flex, HStack, Button, Text, Container, Badge } from '@chakra-ui/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import EmailVerification from './pages/auth/EmailVerification';

// Import new components
import { DashboardHistory } from './components/DashboardHistory';
import { DragDropUpload } from './components/DragDropUpload';
import { CalibrationWizard } from './components/CalibrationWizard';
import { WorkspaceStudio } from './components/WorkspaceStudio';

// Simple Navigation Layout
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, isGuest } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Top Navbar */}
      <Flex as="header" w="full" bg="white" borderBottom="1px" borderColor="gray.200" py={4} px={8} align="center" justify="space-between" shadow="sm">
        <HStack spacing={3}>
          <Text fontSize="xl" fontWeight="black" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text" letterSpacing="tight">
            ChromaShift
          </Text>
          {isGuest && (
            <Badge colorScheme="purple" borderRadius="md" px={2} py={0.5} fontSize="xs" fontWeight="bold">
              Guest Mode
            </Badge>
          )}
        </HStack>
        
        <HStack spacing={6}>
          <Button as={RouterLink} to="/" variant={isActive('/') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Dashboard
          </Button>
          <Button as={RouterLink} to="/upload" variant={isActive('/upload') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Upload
          </Button>
          <Button as={RouterLink} to="/settings" variant={isActive('/settings') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Vision Profile
          </Button>
          
          <Box w="1px" h="24px" bg="gray.300" mx={2} />
          
          {isGuest ? (
            <Button as={RouterLink} to="/auth/login" colorScheme="blue" variant="solid" size="sm" onClick={logout}>
              Log In / Register
            </Button>
          ) : (
            <Button onClick={logout} variant="outline" colorScheme="red" size="sm">
              Logout
            </Button>
          )}
        </HStack>
      </Flex>


      {/* Main Content Area */}
      <Container maxW="container.xl" py={8}>
        {children}
      </Container>
    </Box>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/verify" element={<EmailVerification />} />
          
          {/* Protected Routes wrapped in AppLayout */}
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardHistory />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/upload" element={
            <ProtectedRoute>
              <AppLayout>
                <DragDropUpload />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <CalibrationWizard />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/workspace/:jobId" element={
            <ProtectedRoute>
              <AppLayout>
                <WorkspaceStudio />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
