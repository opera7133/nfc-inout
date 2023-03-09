'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('node', {
  showUsers: () => {
    ipcRenderer.invoke('showUsers')
  },
  doRegister: () => {
    ipcRenderer.invoke('doRegister')
  },
  register: (type, name, cardName) => {
    ipcRenderer.invoke('register', type, name, cardName)
  },
  back: () => {
    ipcRenderer.invoke('back')
  },
  getUsers: async () => {
    return await ipcRenderer.invoke('getUsers')
  },
  end: () => {
    ipcRenderer.on('end', (e) => {
      document.getElementById('warn').setAttribute('hidden', '')
      document.getElementById('main').textContent = 'カードの登録を解除しました'
      setTimeout(() => {
        document.getElementById('main').textContent = '待機中です...'
      }, 5000)
    })
  },
  callback: (state) => {
    ipcRenderer.on('callback', (e, state) => {
      if (state) {
        document.getElementById('alert').setAttribute('hidden', '')
        ipcRenderer.invoke('back')
      } else {
        document.getElementById('info').setAttribute('hidden', '')
        document.getElementById('alert').removeAttribute('hidden')
      }
    })
  },
  reset: () => {
    const warn = document.getElementById('warn')
    warn.removeAttribute('hidden')
    ipcRenderer.invoke('reset')
    warn.textContent = warn.textContent.replace(0, 5)
    for (let i = 0; i < 6; i++) {
      ;(function (i) {
        setTimeout(function () {
          warn.textContent = warn.textContent.replace(6 - i, 5 - i)
          if (i === 5) {
            warn.setAttribute('hidden', '')
          }
        }, i * 1000)
      })(i)
    }
  },
  auth: (data) => {
    ipcRenderer.on('auth', (e, data) => {
      document.getElementById('main').textContent = '認証しました：' + data.name
      setTimeout(() => {
        document.getElementById('main').textContent = '待機中です...'
      }, 5000)
    })
  },
  debug: (sw) => {
    if (sw) {
      ipcRenderer.on('debug', (e, data) => {
        document.getElementById('console').value = data
      })
    } else {
      ipcRenderer.removeAllListeners('debug')
    }
    ipcRenderer.invoke('setSettings', { debug: sw })
  },
  changeState: (uid) => {
    ipcRenderer.invoke('changeState', uid)
  },
  deleteUser: (uid) => {
    ipcRenderer.invoke('deleteUser', uid)
  },
  setSettings: async (data) => {
    return await ipcRenderer.invoke('setSettings', data)
  },
  openSettings: () => {
    ipcRenderer.invoke('openSettings')
  },
  openInfo: () => {
    ipcRenderer.invoke('openInfo')
  },
  loadSettings: async () => {
    return await ipcRenderer.invoke('loadSettings')
  },
})
