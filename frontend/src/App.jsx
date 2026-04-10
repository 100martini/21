import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import AuthSuccess from './pages/AuthSuccess';
import Dashboard from './pages/Dashboard';
import ProjectKanban from './pages/ProjectKanban';
import { isAuthenticated, setToken } from './utils/auth';

// game routes MOIZ
import Lobby from './Game/pages/Lobby';
import TicTacToe from './Game/TicTac/Tictac';
import TicTacToeLocal from './Game/TicTac/Tictac_local';
import TicTacToeOnline from './Game/TicTac/Tictac_online';
import Checkers from './Game/Checkers/Checkers';
import CheckersLocal from './Game/Checkers/Checkers_local';
import CheckersOnline from './Game/Checkers/Checkers_online';

const ProtectedRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" />;
};

const TokenHandler = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      setToken(token);
      navigate('/dashboard', { replace: true });
    } else if (error) {
      console.error('OAuth error:', error);
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  return children;
};

function App() {
  return (
    <Router>
      <TokenHandler>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProtectedRoute>
                <ProjectKanban />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kanban/:slug"
            element={
              <ProtectedRoute>
                <ProjectKanban />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />

          {/* game routes MOIZ */}
          <Route path="/game" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
          <Route path="/tictactoe" element={<ProtectedRoute><TicTacToe /></ProtectedRoute>} />
          <Route path="/tictactoe/local" element={<ProtectedRoute><TicTacToeLocal /></ProtectedRoute>} />
          <Route path="/tictactoe/online" element={<ProtectedRoute><TicTacToeOnline /></ProtectedRoute>} />
          <Route path="/checkers" element={<ProtectedRoute><Checkers /></ProtectedRoute>} />
          <Route path="/checkers/local" element={<ProtectedRoute><CheckersLocal /></ProtectedRoute>} />
          <Route path="/checkers/online" element={<ProtectedRoute><CheckersOnline /></ProtectedRoute>} />
        </Routes>
      </TokenHandler>
    </Router>
  );
}

export default App;