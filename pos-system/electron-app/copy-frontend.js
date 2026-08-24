// Copies frontend/dist (produced by `npm run build` in ../frontend)
// into electron-app/app so main.js can load it.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, 'app');

if (!fs.existsSync(src)) {
  console.error('ERROR: frontend/dist not found.');
  console.error('Run this first:  cd ../frontend && npm install && npm run build');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied frontend/dist -> electron-app/app');
