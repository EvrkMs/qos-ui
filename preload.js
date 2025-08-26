const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('qosApi', {
  // Основные операции с политиками
  getPolicies: () => ipcRenderer.invoke('get-qos-policies'),
  updatePolicy: (policyData) => ipcRenderer.invoke('update-qos-policy', policyData),
  deletePolicy: (ruleName, regView) => ipcRenderer.invoke('delete-qos-policy', ruleName, regView),
  createPolicy: (policyData) => ipcRenderer.invoke('create-qos-policy', policyData),
  
  // Проверка прав
  checkAdmin: () => ipcRenderer.invoke('check-admin'),
  
  // Управление окном
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  resetWindowBounds: () => ipcRenderer.invoke('reset-window-bounds'),
  
  // Открытие внешних ссылок
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

// Expose some Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  isWindows: process.platform === 'win32'
});