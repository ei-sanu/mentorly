import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/globals.css';
import { MockAuthProvider } from '@/lib/mock-auth';
import { ScrollToTop } from '@/components/scroll-to-top';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <MockAuthProvider>
        <App />
      </MockAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
