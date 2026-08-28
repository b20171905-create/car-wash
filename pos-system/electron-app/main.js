const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

ipcMain.handle('download-receipt-pdf', async (event, html, receiptNumber) => {
  const pdf = await event.sender.printToPDF({ printBackground: true, pageSize: 'A5' });
  const safeNumber = String(receiptNumber || 'receipt').replace(/[^a-z0-9_-]/gi, '_');
  const filePath = path.join(app.getPath('downloads'), `Tiger-Car-Wash-${safeNumber}.pdf`);
  fs.writeFileSync(filePath, pdf);
  return filePath;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Car Shop POS',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  Menu.setApplicationMenu(null); // hides the File/Edit/View menu bar for a kiosk-like feel

  // Loads the built React frontend (dist/ folder produced by `npm run build` in /frontend)
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
