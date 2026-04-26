import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import AcceptInvite from './pages/AcceptInvite';
import NoGroups from './pages/NoGroups';
import './index.css';

function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 13, background: 'var(--bg)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && (!profile.groups || profile.groups.length === 0)) return <NoGroups />;
  return children;
}

function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
          <Route path="/signup" element={<RedirectIfAuth><Signup /></RedirectIfAuth>} />
          <Route path="/invite" element={<AcceptInvite />} />
          <Route path="/" element={<RequireAuth><Chat /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
