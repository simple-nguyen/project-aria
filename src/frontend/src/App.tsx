import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MarketProvider } from './context/MarketContext';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <MarketProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MarketProvider>
    </Router>
  );
}

export default App;
