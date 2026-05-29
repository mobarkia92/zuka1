import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { TRPCProvider } from '@/providers/trpc'
import { UserProvider } from './contexts/UserContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
