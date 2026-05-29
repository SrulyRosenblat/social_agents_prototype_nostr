import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount point not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
