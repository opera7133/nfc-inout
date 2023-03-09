'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('el', {
  setSettings: async (data) => {
    return await ipcRenderer.invoke('setSettings', data)
  },
  loadSettings: async () => {
    return await ipcRenderer.invoke('loadSettings')
  },
})
