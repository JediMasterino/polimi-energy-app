import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { injectSpeedInsights } from '@vercel/speed-insights'
import 'leaflet/dist/leaflet.css'
import './index.css'

injectSpeedInsights()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

