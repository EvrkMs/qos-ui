const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qosApi', {
  getPolicies: () => ipcRenderer.invoke('get-qos-policies')
});
