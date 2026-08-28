const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadReceiptPdf: (html, receiptNumber) => ipcRenderer.invoke('download-receipt-pdf', html, receiptNumber),
});
