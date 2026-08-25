import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('Wurzelelement nicht gefunden');

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
