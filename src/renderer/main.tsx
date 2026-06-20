import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installDevMock } from './devMock';
import { App } from './App';
import './styles.css';

installDevMock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
