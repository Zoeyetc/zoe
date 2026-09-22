import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './experience/App';
import './experience/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
