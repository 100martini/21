import React, { useEffect } from 'react';
import '../styles/WelcomeScreen.css';

const WelcomeScreen = ({ user, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const displayName = user?.nickname || user?.firstName || user?.login || 'Student';
  
  const level = user?.level || 
                user?.cursusUsers?.find(c => c.cursus?.slug === '42cursus')?.level ||
                user?.cursusUsers?.[user?.cursusUsers.length - 1]?.level || 0;
                
  const wallet = user?.wallet || 0;
  const correctionPoints = user?.correctionPoints || 0;
  const is42User = !!user?.intraId;

  const avatarUrl = user?.customAvatar || user?.avatar?.medium || user?.avatar;

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        {avatarUrl ? (
          <img 
            src={avatarUrl}
            alt={displayName}
            className="welcome-avatar"
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div className="welcome-avatar-placeholder">
            {displayName.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        <h1 className="welcome-title">
          Welcome back, {displayName}!
        </h1>
        
        {is42User && (
          <>
            <div className="welcome-level">
              Level {level.toFixed(2)}
            </div>
            
            <div className="welcome-stats">
              <div className="welcome-stat">
                <div className="welcome-stat-value">{wallet}</div>
                <div className="welcome-stat-label">Wallet</div>
              </div>
              <div className="welcome-divider"></div>
              <div className="welcome-stat">
                <div className="welcome-stat-value">{correctionPoints}</div>
                <div className="welcome-stat-label">Evaluation Points</div>
              </div>
            </div>
          </>
        )}

        {!is42User && (
          <div className="welcome-subtitle">
            Ready to collaborate?
          </div>
        )}

        <div className="welcome-loading">
          <div className="loading-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
