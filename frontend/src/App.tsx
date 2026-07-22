import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import AdminLayout from './components/Adminlayout';
import IAPage from './pages/IAPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallback from './pages/AuthCallback';
import AppointmentsPage from './pages/AppointmentsPage';
import DocumentsPage from './pages/DocumentsPage';
import TicketsPage from './pages/TicketsPage';
import ProfilePage from './pages/ProfilePage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage';
import AdminWeeklyPage from './pages/admin/AdminWeeklyPage';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminAdminsPage from './pages/admin/AdminAdminsPage';
import AdminMessagesPage from './pages/admin/AdminMessagesPage';
import AdminDocumentsPage from './pages/admin/AdminDocumentsPage';
import HomePage from './pages/HomePage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  return isAdmin() ? <>{children}</> : <Navigate to="/admin/login" replace />;
};

export default function App() {
  const { init } = useAuth();
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="assistant" element={<IAPage />} />
          <Route path="rendez-vous" element={<AppointmentsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="billets" element={<TicketsPage />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="appointments" element={<AdminAppointmentsPage />} />
          <Route path="appointments/semaine" element={<AdminWeeklyPage />} />
          <Route path="tickets" element={<AdminTicketsPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="documents" element={<AdminDocumentsPage />} />
          <Route path="admins" element={<AdminAdminsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}