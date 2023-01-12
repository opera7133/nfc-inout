'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const { NFC } = require('nfc-pcsc')
const crypto = require('crypto')
const path = require('path')

require('dotenv').config()

let win
const nfc = new NFC()
const byteSize = (str) => new Blob([str]).size
const key = crypto.scryptSync(process.env.CRYPT_KEY, process.env.CRYPT_SALT, 32)
const iv = Buffer.alloc(16)
iv.write(process.env.CRYPT_KEY)

function createWindow() {
  win = new BrowserWindow({
    title: '入退室管理システム',
    autoHideMenuBar: true,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadFile(path.join(__dirname, 'index.html'))
}

function encrypt(text) {
  const encryptalgo = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = encryptalgo.update(text, 'utf8', 'hex')
  encrypted += encryptalgo.final('hex')
  return encrypted
}

function decrypt(encrypted) {
  const decryptalgo = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decryptalgo.update(encrypted, 'hex', 'utf-8')
  decrypted += decryptalgo.final('utf-8')
  return decrypted
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  nfc.on('reader', (reader) => {
    reader.on('card', async (card) => {
      try {
        let data = []
        let zeroBuf = Buffer.alloc(16)
        let i = 0
        while (true) {
          const dataTemp1 = await reader.read(i, 16, 16)
          const dataTemp2 = await reader.read(i + 1, 16, 16)
          if (Buffer.compare(dataTemp1, zeroBuf) === 0) {
            break
          }
          data[i / 2] = decrypt(
            dataTemp1.toString().replace(/\0/g, '') +
              dataTemp2.toString().replace(/\0/g, '')
          )
          i += 2
        }
        win.webContents.send('auth', { data: data })
      } catch (err) {
        console.error(`error when reading data`, err)
      }
    })
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('doRegister', (e) => {
  win.loadFile(path.join(__dirname, 'register.html'))
})

ipcMain.handle('back', (e) => {
  win.loadFile(path.join(__dirname, 'index.html'))
})

/*if (process.argv[2] === "write") {
        try {
          const data = Buffer.allocUnsafe(16);
          const text = ["山田太郎"]
          let block = 0;
          for (let i = 0; i < text.length; i++) {
            let dt = encrypt(text[i])
            for (let j = 0; j < byteSize(dt) / 16; j++) {
              data.fill(0);
              data.write(new TextDecoder().decode(new TextEncoder().encode(dt).slice(j * 16, j * 16 + 16)));
              await reader.write(block, data, 16);
              block++
            }
          }
          console.log(`data written`);
        } catch (err) {
          console.error(`error when writing data`, err);
        }
    } else {*/
