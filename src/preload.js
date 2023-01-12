'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('node', {
  doRegister: () => {
    ipcRenderer.invoke('doRegister')
  },
  register: () => {
    ipcRenderer.invoke('register')
  },
  back: () => {
    ipcRenderer.invoke('back')
  },
  auth: (data) => {
    ipcRenderer.on('auth', (e, data) => {
      const sound = new Audio('./success.mp3')
      sound.play()
      document.getElementById('main').textContent =
        '認証しました：' + data.data[0]
      setTimeout(() => {
        document.getElementById('main').textContent = '待機中です...'
      }, 5000)
    })
  },
})
