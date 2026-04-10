import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import '../styles/Login.css';

const Eye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('signin');

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ email: '', password: '', confirmPassword: '' });
  const [showSignInPwd, setShowSignInPwd] = useState(false);
  const [showSignUpPwd, setShowSignUpPwd] = useState(false);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const errorParam = searchParams.get('error');
    if (errorParam) {
      switch (errorParam) {
        case 'access_denied':
          setError('You denied access to the application.');
          break;
        case 'no_code':
          setError('No authorization code received.');
          break;
        case 'auth_failed':
          setError('Authentication failed. Please try again.');
          break;
        default:
          setError('An error occurred during login.');
      }
    }

    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      sessionStorage.setItem('token',tokenParam);
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, searchParams]);

  const handleSignInChange = (e) => {
    const { name, value } = e.target;
    setSignInData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData(prev => ({ ...prev, [name]: value }));
  };

  const handleOAuthLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/42`;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://localhost:8443/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signInData)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Sign in failed.'); return; }
      sessionStorage.setItem('token',data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (signUpData.password !== signUpData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://localhost:8443/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signUpData.email, password: signUpData.password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed.'); return; }
      sessionStorage.setItem('token',data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  if (isAuthenticated()) return null;

  return (
    <div className="login-page">
      <div className="container">

        <div className="logo-section">
          <div className="logo">21</div>
          <h1>Project Hub</h1>
          <p>Collaborate on 42 projects with your team</p>
        </div>

        <div className="login-card">
          <h2>Ready to code?</h2>

          <button className="btn-42" onClick={handleOAuthLogin}>
            Continue with 42 Intra
          </button>

          <div className="divider"><span>or</span></div>

          <div className="tab-switcher">
            <button className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`} onClick={() => { setActiveTab('signin'); setError(''); }}>Sign In</button>
            <button className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`} onClick={() => { setActiveTab('signup'); setError(''); }}>Sign Up</button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {activeTab === 'signin' ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <input type="email" name="email" placeholder="Email" value={signInData.email} onChange={handleSignInChange} required />
              <div className="pwd-wrap">
                <input type={showSignInPwd ? 'text' : 'password'} name="password" placeholder="Password" value={signInData.password} onChange={handleSignInChange} required />
                <button type="button" className="pwd-eye" onClick={() => setShowSignInPwd(v => !v)} tabIndex={-1} aria-label={showSignInPwd ? 'Hide password' : 'Show password'}>
                  {showSignInPwd ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <button type="submit" className="btn-submit">Sign In</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignUp}>
              <input type="email" name="email" placeholder="Email" value={signUpData.email} onChange={handleSignUpChange} required />
              <div className="pwd-wrap">
                <input type={showSignUpPwd ? 'text' : 'password'} name="password" placeholder="Password" value={signUpData.password} onChange={handleSignUpChange} required />
                <button type="button" className="pwd-eye" onClick={() => setShowSignUpPwd(v => !v)} tabIndex={-1} aria-label={showSignUpPwd ? 'Hide password' : 'Show password'}>
                  {showSignUpPwd ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <div className="pwd-wrap">
                <input type={showSignUpConfirm ? 'text' : 'password'} name="confirmPassword" placeholder="Confirm Password" value={signUpData.confirmPassword} onChange={handleSignUpChange} required />
                <button type="button" className="pwd-eye" onClick={() => setShowSignUpConfirm(v => !v)} tabIndex={-1} aria-label={showSignUpConfirm ? 'Hide password' : 'Show password'}>
                  {showSignUpConfirm ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <button type="submit" className="btn-submit">Create Account</button>
            </form>
          )}
        </div>

        <div className="features">
          <div className="feature"><div className="feature-icon">Team</div><p>Collaboration</p></div>
          <div className="feature"><div className="feature-icon">Task</div><p>Management</p></div>
          <div className="feature"><div className="feature-icon">Game</div><p>Hub</p></div>
        </div>

      </div>
    </div>
  );
};

export default Login;
