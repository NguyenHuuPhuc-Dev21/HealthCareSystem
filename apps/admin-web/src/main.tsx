import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth';
import { AppRoutes } from './routes';
import './styles/tokens.css';
import './styles/base.css';

async function enableMocking() {
  // Chỉ bật mock khi chạy dev và VITE_USE_MOCK=true; bản build production không chứa mock
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    const { installMockApi } = await import('./mocks');
    installMockApi();
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
