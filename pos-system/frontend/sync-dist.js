const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'dist');
const backendPublic = path.join(__dirname, '..', 'backend', 'public');
const electronApp = path.join(__dirname, '..', 'electron-app', 'app');

if (fs.existsSync(src)) {
  if (fs.existsSync(path.dirname(backendPublic))) {
    fs.rmSync(backendPublic, { recursive: true, force: true });
    fs.cpSync(src, backendPublic, { recursive: true });
    console.log('✓ Synced frontend dist -> backend/public');
  }
  if (fs.existsSync(path.dirname(electronApp))) {
    fs.rmSync(electronApp, { recursive: true, force: true });
    fs.cpSync(src, electronApp, { recursive: true });
    console.log('✓ Synced frontend dist -> electron-app/app');
  }
}
