import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Flex, HStack, Button, Text, Container, Badge, useDisclosure } from '@chakra-ui/react';
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
import { PromoteModal } from './components/PromoteModal';
import { VisionTest } from './components/VisionTest';
import { AdminAnalytics } from './components/AdminAnalytics';
import { LandingPage } from './components/LandingPage';

// Simple Navigation Layout
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, isGuest, isAdmin } = useAuth();
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Box minH="100vh" bg="gray.50">
      {isGuest && (
        <Box bgGradient="linear(to-r, blue.600, purple.600)" color="white" py={2.5} px={4} textAlign="center" fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" shadow="inner">
          🎨 Running in Guest Session. Your vision profile calibration and media history will be automatically pruned in 24 hours.
          <Button size="xs" colorScheme="whiteAlpha" bg="whiteAlpha.300" ml={3} fontWeight="extrabold" borderRadius="md" _hover={{ bg: "whiteAlpha.450" }} onClick={onOpen}>
            Secure Your Account
          </Button>
        </Box>
      )}

      {/* Top Navbar */}
      <Flex as="header" w="full" bg="white" borderBottom="1px" borderColor="gray.200" py={4} px={8} align="center" justify="space-between" shadow="sm">
        <HStack spacing={3}>
          <RouterLink to="/">
            <Text fontSize="xl" fontWeight="black" bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text" letterSpacing="tight">
              ChromaShift
            </Text>
          </RouterLink>
          {isGuest && (
            <Badge colorScheme="purple" borderRadius="md" px={2} py={0.5} fontSize="xs" fontWeight="bold">
              Guest Mode
            </Badge>
          )}
        </HStack>
        
        <HStack spacing={6}>
          <Button as={RouterLink} to="/hub" variant={isActive('/hub') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Media Hub
          </Button>
          <Button as={RouterLink} to="/test-vision" variant={isActive('/test-vision') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Test Vision
          </Button>
          <Button as={RouterLink} to="/upload" variant={isActive('/upload') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Upload
          </Button>
          <Button as={RouterLink} to="/settings" variant={isActive('/settings') ? 'solid' : 'ghost'} colorScheme="blue" size="sm">
            Vision Profile
          </Button>

          {isAdmin && (
            <Button as={RouterLink} to="/admin/analytics" variant={isActive('/admin/analytics') ? 'solid' : 'ghost'} colorScheme="purple" size="sm" fontWeight="black">
              🛡️ Admin Panel
            </Button>
          )}
          
          <Box w="1px" h="24px" bg="gray.300" mx={2} />
          
          {isGuest ? (
            <HStack spacing={3}>
              <Button size="sm" colorScheme="purple" bgGradient="linear(to-r, blue.600, purple.600)" color="white" _hover={{ opacity: 0.9 }} onClick={onOpen}>
                Secure Progress
              </Button>
              <Button as={RouterLink} to="/auth/login" colorScheme="blue" variant="ghost" size="sm">
                Log In
              </Button>
            </HStack>
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

      {/* Guest Session Promotion Modal */}
      <PromoteModal isOpen={isOpen} onClose={onClose} />
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
          
          {/* Public Landing Page */}
          <Route path="/" element={
            <AppLayout>
              <LandingPage />
            </AppLayout>
          } />

          {/* Protected Routes wrapped in AppLayout */}
          <Route path="/hub" element={
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

          <Route path="/test-vision" element={
            <ProtectedRoute>
              <AppLayout>
                <VisionTest />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/analytics" element={
            <ProtectedRoute>
              <AppLayout>
                <AdminAnalytics />
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
