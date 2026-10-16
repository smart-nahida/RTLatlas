import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';import '@xyflow/react/dist/style.css';import '@fontsource/noto-sans-sc/400.css';import './style.css';import './clean.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
