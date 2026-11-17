import { App } from './app';
import './styles.css';

const app = new App();
void app.boot();
// debug/inspection hook (harmless in production)
(window as unknown as { __ludo?: unknown }).__ludo = app;

// WebGL context loss recovery notice
const canvas = document.querySelector('#gl');
canvas?.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  window.location.reload();
});
