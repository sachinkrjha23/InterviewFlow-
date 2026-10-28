import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { MotionConfig } from 'motion/react'
import { store } from './redux/store.js'
import './utils/setupAxios.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </Provider>
    </BrowserRouter>
  </StrictMode>,
)