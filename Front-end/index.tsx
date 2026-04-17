import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppSettingsProvider } from './AppSettingsContext';
import { LanguageProvider } from './LanguageContext';
import { NotificationProvider } from './NotificationContext';
import { AuthProvider } from './AuthContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <AppSettingsProvider>
        <LanguageProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </LanguageProvider>
      </AppSettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
