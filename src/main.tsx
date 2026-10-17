import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './lib/clientTelemetry';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<div role="alert">Something went wrong. Please refresh and try again.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
