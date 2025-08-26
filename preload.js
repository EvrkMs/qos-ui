const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('qosApi', {
  getPolicies: () => ipcRenderer.invoke('get-qos-policies'),
  updatePolicy: (policyData) => ipcRenderer.invoke('update-qos-policy', policyData),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  resetWindowBounds: () => ipcRenderer.invoke('reset-window-bounds')
});

// Expose some Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions
});