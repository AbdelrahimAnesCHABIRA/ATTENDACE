import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    // Cookie was set by the server during OAuth callback.
    // Just call /me to get user data — cookie is sent automatically.
    authAPI.getMe()
      .then(res => {
        login(res.data.user);
        navigate('/dashboard');
      })
      .catch(() => {
        navigate('/login?error=auth_failed');
      });
  }, [searchParams, navigate, login]);

  return (
    <div className="loading-container" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
      <p>Signing you in...</p>
    </div>
  );
}
