// preload.js — безопасный мост в рендерер
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qosApi', {
  getPolicies: () => ipcRenderer.invoke('get-policies'),
  checkAdmin:  () => ipcRenderer.invoke('check-admin'),

  createPolicy: (data) => ipcRenderer.invoke('create-policy', data),
  updatePolicy: (data) => ipcRenderer.invoke('update-policy', data),
  deletePolicy: (rule, regView, hive = 'HKLM') =>
    ipcRenderer.invoke('delete-policy', { Rule: rule, regView, hive }),
  openQosWizard: () => ipcRenderer.invoke('open-qos-wizard'),
  addQosPolicyWin: (data) => ipcRenderer.invoke('add-qos-policy-win', data),
  removeQosPolicyWin: (name) => ipcRenderer.invoke('remove-qos-policy-win', { Name: name }),
});
