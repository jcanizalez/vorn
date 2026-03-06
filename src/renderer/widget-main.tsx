import React from 'react'
import ReactDOM from 'react-dom/client'
import { Widget } from './components/Widget'
import './widget.css'

ReactDOM.createRoot(document.getElementById('widget-root')!).render(
  <React.StrictMode>
    <Widget />
  </React.StrictMode>
)
