import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ZoeApp } from './ZoeApp.tsx';
createRoot(document.getElementById('root')!).render(<StrictMode><ZoeApp /></StrictMode>);
