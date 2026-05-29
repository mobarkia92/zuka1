import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CounselorDashboard from './pages/CounselorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SmartAssessment from './pages/SmartAssessment';
import AlertsPage from './pages/AlertsPage';
import SessionsPage from './pages/SessionsPage';
import InterventionsPage from './pages/InterventionsPage';

function App() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Get redirect path based on user role
  const getRedirect = () => {
    if (!user) return '/';
    if (user.role === 'student') return '/portal';
    if (user.role === 'counselor') return '/counselor';
    if (user.role === 'admin') return '/admin';
    return '/';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', direction: 'rtl' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }} />
          <p style={{ color: '#6B6B6B', fontSize: '16px' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={getRedirect()} replace /> : <LoginPage />} />

      {/* Student portal */}
      <Route
        path="/portal/*"
        element={
          isAuthenticated && user?.role === 'student' ? (
            <DashboardPage />
          ) : isAuthenticated ? (
            <Navigate to={getRedirect()} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Counselor portal */}
      <Route
        path="/counselor/*"
        element={
          isAuthenticated && user?.role === 'counselor' ? (
            <CounselorDashboard />
          ) : isAuthenticated ? (
            <Navigate to={getRedirect()} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Admin portal */}
      <Route
        path="/admin/*"
        element={
          isAuthenticated && user?.role === 'admin' ? (
            <AdminDashboard />
          ) : isAuthenticated ? (
            <Navigate to={getRedirect()} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Smart Assessment — available to all authenticated users */}
      <Route
        path="/assessment"
        element={isAuthenticated ? <SmartAssessment /> : <Navigate to="/login" replace />}
      />

      {/* Alerts Center */}
      <Route path="/alerts" element={isAuthenticated ? <AlertsPage /> : <Navigate to="/login" replace />} />

      {/* Sessions */}
      <Route path="/sessions" element={isAuthenticated ? <SessionsPage /> : <Navigate to="/login" replace />} />

      {/* Interventions */}
      <Route path="/interventions" element={isAuthenticated ? <InterventionsPage /> : <Navigate to="/login" replace />} />

      {/* Legacy redirects */}
      <Route path="/dashboard/*" element={<Navigate to="/portal" replace />} />
      <Route path="/counselor-dashboard/*" element={<Navigate to="/counselor" replace />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
