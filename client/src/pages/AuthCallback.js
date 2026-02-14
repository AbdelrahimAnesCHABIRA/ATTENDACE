import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      localStorage.setItem('token', token);

      authAPI.getMe()
        .then(res => {
          login(token, res.data.user);
          navigate('/');
        })
        .catch(() => {
          navigate('/login?error=auth_failed');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="loading-container" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
      <p>Signing you in...</p>
    </div>
  );
}
