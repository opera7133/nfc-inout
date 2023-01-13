'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('node', {
  doRegister: () => {
    ipcRenderer.invoke('doRegister')
  },
  register: (name) => {
    ipcRenderer.invoke('register', name)
  },
  back: () => {
    ipcRenderer.invoke('back')
  },
  end: () => {
    ipcRenderer.on('end', (e) => {
      document.getElementById('warn').setAttribute('hidden', '')
      document.getElementById('main').textContent = 'カードをリセットしました'
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
        const sound = new Audio('./error.mp3')
        sound.play()
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
