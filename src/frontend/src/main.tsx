import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const enableStrictMode = import.meta.env.VITE_ENABLE_STRICT_MODE === 'true';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
if (enableStrictMode) {
  console.log('rendering strict mode');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  root.render(<App />);
}