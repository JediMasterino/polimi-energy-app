import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/epw-s3': {
        target: 'https://energyplus-weather.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/epw-s3/, '')
      },
      '/pvgis-api': {
        target: 'https://re.jrc.ec.europa.eu/api/v5_2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pvgis-api/, '')
      },
      '/map-osm': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Polimi-BEM-Sustainability-Studio/1.0 (https://polimi.it)'
        },
        rewrite: (path) => path.replace(/^\/map-osm/, '')
      },
      '/map-esri': {
        target: 'https://server.arcgisonline.com/ArcGIS/rest/services',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-esri/, '')
      }
    }
  }
})
