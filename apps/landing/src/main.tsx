import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/landing.css';
import LandingPage from './features/landing/LandingPage.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <LandingPage />
    </React.StrictMode>
);