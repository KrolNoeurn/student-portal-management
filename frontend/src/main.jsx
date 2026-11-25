import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@/styles/vuexy-theme.css';
import '@/i18n';
import { App } from '@/App';
createRoot(document.getElementById('root')).render(<StrictMode>
    <App />
  </StrictMode>);
