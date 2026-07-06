import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import Dashboard from './features/dashboard/Dashboard';
import TopicsList from './features/topics/TopicsList';
import TopicDetail from './features/topics/TopicDetail';
import Flashcard from './features/flashcard/Flashcard';
import Quiz from './features/quiz/Quiz';
import FillBlank from './features/fill/FillBlank';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(30, 30, 50, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              backdropFilter: 'blur(20px)',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: {
              iconTheme: { primary: '#667eea', secondary: '#ffffff' },
            },
            error: {
              iconTheme: { primary: '#f5576c', secondary: '#ffffff' },
            },
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute>
                <Layout><TopicsList /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:id"
            element={
              <ProtectedRoute>
                <Layout><TopicDetail /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Practice routes */}
          <Route
            path="/topics/:id/flashcard"
            element={
              <ProtectedRoute>
                <Layout><Flashcard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:id/quiz"
            element={
              <ProtectedRoute>
                <Layout><Quiz /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:id/fill"
            element={
              <ProtectedRoute>
                <Layout><FillBlank /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/achievements"
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
