'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const { NFC } = require('nfc-pcsc')
const crypto = require('crypto')
const path = require('path')
const { Blob } = require('buffer')
const ULID = require('ulid')
const mysql = require('mysql2/promise')
const axios = require('axios')

require('dotenv').config({ path: __dirname + '/../.env' })

let win
let mode = 'read'
let registerName = ''
const zeroBuf = Buffer.alloc(16)

const nfc = new NFC()
const byteSize = (str) => new Blob([str]).size
const key = crypto.scryptSync(process.env.CRYPT_KEY, process.env.CRYPT_SALT, 32)
const iv = Buffer.alloc(16)
iv.write(process.env.CRYPT_KEY)

// ウィンドウ初期化
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

// 暗号化
function encrypt(text) {
  const encryptalgo = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = encryptalgo.update(text, 'utf8', 'hex')
  encrypted += encryptalgo.final('hex')
  return encrypted
}

// 復号
function decrypt(encrypted) {
  const decryptalgo = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decryptalgo.update(encrypted, 'hex', 'utf-8')
  decrypted += decryptalgo.final('utf-8')
  return decrypted
}

/* 
データベースの操作

type: register, update, read, delete
data: {id, name, state}
*/
async function controlDB(type, data) {
  const connection = await mysql.createConnection(process.env.DATABASE_URL)
  if (type === 'register') {
    const res = await connection.query(
      'INSERT INTO users (id, name, state) VALUES (?, ?, ?)',
      [data.id, data.name, data.state]
    )
    connection.end()
    return res.affectedRows == 1
  } else if (type === 'update') {
    const res = await connection.query(
      'UPDATE users SET state = ? WHERE id = ?',
      [data.state, data.id]
    )
    connection.end()
    return res.affectedRows == 1
  } else if (type === 'delete') {
    const res = await connection.query('DELETE FROM users WHERE id = ?', [
      data.id,
    ])
    connection.end()
    return res.affectedRows == 1
  } else {
    const rows = await connection.query(`SELECT * FROM users WHERE name = ?`, [
      data.name,
    ])
    connection.end()
    return rows[0]
  }
}

async function readAndAuth(reader) {
  let spid = ''
  let encrypted = ''
  let data = []
  let dataTemp = []
  let i = 0
  dataTemp[0] = await reader.read(0, 16, 16)
  dataTemp[1] = await reader.read(1, 16, 16)
  dataTemp[2] = await reader.read(2, 16, 16)
  dataTemp[3] = await reader.read(3, 16, 16)
  if (Buffer.compare(dataTemp[0], zeroBuf) !== 0) {
    encrypted =
      dataTemp[0].toString().replace(/\0/g, '') +
      dataTemp[1].toString().replace(/\0/g, '') +
      dataTemp[2].toString().replace(/\0/g, '') +
      dataTemp[3].toString().replace(/\0/g, '')
    data[0] = decrypt(encrypted)
    i += 4
  }
  dataTemp = []
  while (true) {
    dataTemp[0] = await reader.read(i, 16, 16)
    dataTemp[1] = await reader.read(i + 1, 16, 16)
    if (Buffer.compare(dataTemp[0], zeroBuf) === 0) {
      break
    }
    data[(i - 2) / 2] = decrypt(
      dataTemp[0].toString().replace(/\0/g, '') +
        dataTemp[1].toString().replace(/\0/g, '')
    )
    i += 2
  }
  dataTemp[0] = await reader.read(12, 16, 16)
  dataTemp[1] = await reader.read(13, 16, 16)
  spid =
    dataTemp[0].toString().replace(/\0/g, '') +
    dataTemp[1].toString().replace(/\0/g, '')

  const dbdt = await controlDB('read', { id: spid, name: encrypted })
  return { id: spid, data: data, db: dbdt }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  nfc.on('reader', (reader) => {
    reader.on('card', async (card) => {
      try {
        if (mode === 'register') {
          if (byteSize(registerName) > 32) {
            throw new Error('Name is too long')
          }
          if (Buffer.compare(await reader.read(0, 16, 16), zeroBuf) !== 0) {
            throw new Error('Already registred')
          }
          const data = Buffer.allocUnsafe(16)
          for (let i = 0; i < 14; i++) {
            data.fill(0)
            await reader.write(i, data, 16)
          }
          const text = [registerName]
          let block = 0
          for (let i = 0; i < text.length; i++) {
            let dt = encrypt(text[i])
            for (let j = 0; j < byteSize(dt) / 16; j++) {
              data.fill(0)
              data.write(
                new TextDecoder().decode(
                  new TextEncoder().encode(dt).slice(j * 16, j * 16 + 16)
                )
              )
              await reader.write(block, data, 16)
              block++
            }
          }
          const spid = ULID.ulid()
          for (let j = 0; j < 2; j++) {
            data.fill(0)
            data.write(
              new TextDecoder().decode(
                new TextEncoder().encode(spid).slice(j * 16, j * 16 + 16)
              )
            )
            await reader.write(12 + j, data, 16)
            block++
          }
          controlDB('register', { id: spid, name: encrypt(text[0]), state: 1 })
          win.webContents.send('callback', true)
          mode = 'read'
        } else if (mode === 'reset') {
          const old = await readAndAuth(reader)
          if (old.data[0] && old.id && old.db[0].id === old.id) {
            controlDB('delete', { id: old.id })
          }
          const data = Buffer.allocUnsafe(16)
          for (let i = 0; i < 14; i++) {
            data.fill(0)
            await reader.write(i, data, 16)
            win.webContents.send('end')
            mode = 'read'
          }
        } else {
          const res = await readAndAuth(reader)
          if (res.data[0] && res.id && res.db[0].id === res.id) {
            win.webContents.send('auth', { data: res.data })
            controlDB('update', {
              id: res.id,
              state: res.db[0].state === 0 ? 1 : 0,
            })
            const post = await axios.post(
              process.env.DISCORD_WEBHOOK,
              {
                username: '入退室管理',
                content: `🚪${res.data[0]}さんが${
                  res.db[0].state === 0 ? '入室' : '退室'
                }しました`,
              },
              {
                headers: {
                  Accept: 'application/json',
                  'Content-type': 'application/json',
                },
              }
            )
          } else if (res.data[0] && res.id && res.db[0].id !== res.id) {
            throw new Error('User ID does not match')
          }
        }
      } catch (err) {
        console.error(`error`, err)
        win.webContents.send('callback', false)
        mode = 'read'
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
  mode = 'read'
  registerName = ''
  win.loadFile(path.join(__dirname, 'index.html'))
})

ipcMain.handle('reset', (e) => {
  mode = 'reset'
  setTimeout(() => {
    mode = 'read'
  }, 5000)
})

ipcMain.handle('register', (e, name) => {
  mode = 'register'
  registerName = name
})
