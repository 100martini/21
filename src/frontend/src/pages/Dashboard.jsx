import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { removeToken } from '../utils/auth';
import WelcomeScreen from '../components/WelcomeScreen';
import FullDashboard from '../components/FullDashboard';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = sessionStorage.getItem('user');
    return !cached;
  });
  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('welcomeShown');
  });

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const hasCachedData = sessionStorage.getItem('user');
    const startTime = Date.now();
    
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      sessionStorage.setItem('user', JSON.stringify(response.data));
      
      if (!hasCachedData) {
        const elapsed = Date.now() - startTime;
        const minLoadingTime = 1500;
        const remaining = Math.max(0, minLoadingTime - elapsed);
        
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      
      setLoading(false);
      
    } catch (err) {
      removeToken();
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('welcomeShown');
      navigate('/login');
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    sessionStorage.setItem('welcomeShown', 'true');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <h2>Fetching data from 42 API</h2>
          <p>Please wait</p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return <WelcomeScreen user={user} onComplete={handleWelcomeComplete} />;
  }

  return <FullDashboard user={user} />;
};

export default Dashboard;