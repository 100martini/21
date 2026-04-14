import React, { useEffect, useState } from "react";
import ChatPage from "./ChatPage";
import './App.css';


import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsInitializing(false);
    } else if (!token) {
      window.location.href = `${import.meta.env.VITE_MAIN_APP_URL || "https://localhost:8443"}/login`;
    } else {
      setIsInitializing(false);
    }
  }, [token]);

  if (isInitializing || !token) {
    return null; 
  }

  return (
    <ErrorBoundary>
      <ChatPage apiBaseUrl={import.meta.env.VITE_API_BASE_URL || "https://localhost:8000"} />
    </ErrorBoundary>
  );
}