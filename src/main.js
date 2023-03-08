'use strict'

const { app, dialog, BrowserWindow, ipcMain } = require('electron')
const { NFC } = require('nfc-pcsc')
const path = require('path')
const fs = require('fs')
const ULID = require('ulid')
const axios = require('axios')
const sound = require('sound-play')
const { Sequelize, DataTypes } = require('sequelize')
const fastify = require('fastify')()

require('dotenv').config({ path: __dirname + '/../.env' })

// ウィンドウ、モード切替、登録時の一時変数
let win
let mode = 'read'
let registerData = {
  type: 'create',
  name: '',
  id: '',
}

// NFC
const nfc = new NFC()

// 設定の保存
const Store = require('electron-store')
const store = new Store()

// ORMの構成
const sequelize = new Sequelize(process.env.DATABASE_URL)
const User = sequelize.define(
  'users',
  {
    id: {
      type: DataTypes.STRING(26),
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    state: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    last: {
      type: DataTypes.DATE,
    },
  },
  {}
)

const Card = sequelize.define(
  'cards',
  {
    id: {
      type: DataTypes.STRING(26),
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
    idm: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.STRING(26),
      allowNull: false,
    },
  },
  {}
)

User.hasMany(Card, { foreignKey: 'userId' })
Card.belongsTo(User)

// ウェブコンソール
fastify.register(require('@fastify/view'), {
  engine: {
    ejs: require('ejs'),
  },
})
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
})
fastify.register(require('@fastify/basic-auth'), {
  validate,
  authenticate: true,
})

function validate(username, password, req, reply, done) {
  if (
    username === process.env.BASIC_AUTH_USER &&
    password === process.env.BASIC_AUTH_PASSWORD
  ) {
    done()
  } else {
    done(new Error('Winter is coming'))
  }
}
fastify.after(() => {
  if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD) {
    fastify.addHook('onRequest', fastify.basicAuth)
  }
  fastify.get('/', async (req, reply) => {
    const users = await User.findAll({ raw: true })
    await reply.view('/src/views/index.ejs', { users: users })
  })
  fastify.get('/favicon.ico', async (req, reply) => {
    await reply.sendFile('favicon.ico')
  })
})

const start = async () => {
  try {
    await fastify.listen({ port: 3060, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Discordのメッセージ送信
const sendDiscord = async (content) => {
  if (process.env.DISCORD_WEBHOOK) {
    const post = await axios.post(
      process.env.DISCORD_WEBHOOK,
      {
        username: '入退室管理',
        content: content,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-type': 'application/json',
        },
      }
    )
  }
}

// LINEのメッセージ送信
const sendLine = async (content) => {
  if (process.env.LINE_ACCESS_TOKEN && process.env.LINE_USER_ID) {
    const post = await axios.post(
      process.env.DISCORD_WEBHOOK,
      {
        to: process.env.LINE_USER_ID,
        messages: [
          {
            type: 'text',
            text: content,
          },
        ],
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-type': 'application/json',
          Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
        },
      }
    )
  }
}

// ウィンドウ初期化
function createWindow() {
  win = new BrowserWindow({
    title: '入退室管理システム',
    autoHideMenuBar: true,
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  start()
  ;(async () => {
    await User.sync({ alter: true })
    await Card.sync({ alter: true })
  })()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  nfc.on('reader', (reader) => {
    reader.on('card', async (card) => {
      try {
        if (mode === 'register') {
          sound.play(path.join(__dirname, 'success.mp3'))
          if (registerData.type === 'create') {
            const newUser = await User.create({
              id: ULID.ulid(),
              name: registerData.name,
              state: true,
              last: new Date(),
            })
            const newCard = await Card.create({
              id: ULID.ulid(),
              idm: card.uid,
              userId: newUser.id,
            })
            await sendDiscord(`🆕 ${registerData.name}さんを登録しました`)
            await sendLine(`🆕 ${registerData.name}さんを登録しました`)
          } else {
            const newCard = await Card.create({
              id: ULID.ulid(),
              idm: card.uid,
              userId: registerData.id,
            })
          }
          win.webContents.send('callback', true)
          mode = 'read'
        } else if (mode === 'reset') {
          sound.play(path.join(__dirname, 'success.mp3'))
          const deleteCard = await Card.findOne({
            where: { idm: card.uid },
          })
          if (deleteCard) {
            const deletedCard = await deleteCard.destroy()
          }
          win.webContents.send('end')
          mode = 'read'
        } else {
          const uid = await Card.findOne({
            where: { idm: card.uid },
          }).userId
          if (uid) {
            const user = await User.findOne({
              where: { id: uid },
            })
            if (user) {
              win.webContents.send('auth', { data: { name: user.name } })
              sound.play(sound.play(path.join(__dirname, 'success.mp3')))
              if (!user.state) {
                user.last = new Date()
              }
              user.state = data.state
              const updatedUser = await user.save()
              await sendDiscord(
                `🚪 ${user.name}さんが${!user.state ? '入室' : '退室'}しました`
              )
              await sendLine(
                `🚪 ${user.name}さんが${!user.state ? '入室' : '退室'}しました`
              )
            }
          }
        }
      } catch (err) {
        console.error(`error`, err)
        sound.play(path.join(__dirname, 'error.mp3'))
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

ipcMain.handle('showUsers', (e) => {
  win.loadFile(path.join(__dirname, 'users.html'))
})

ipcMain.handle('back', (e) => {
  mode = 'read'
  registerData = {
    type: 'create',
    name: '',
    id: '',
  }
  win.loadFile(path.join(__dirname, 'index.html'))
})

ipcMain.handle('reset', (e) => {
  mode = 'reset'
  setTimeout(() => {
    mode = 'read'
  }, 5000)
})

ipcMain.handle('register', (e, type, name) => {
  mode = 'register'
  if (type === 'create') {
    registerData = {
      type: 'create',
      name: name,
    }
  } else {
    registerData = {
      type: 'update',
      id: name,
    }
  }
})

ipcMain.handle('changeState', async (e, uid) => {
  const user = await User.findOne({ where: { id: uid } })
  if (user.state) {
    user.last = new Date()
  }
  user.state = !user.state
  await user.save()
  win.webContents.reloadIgnoringCache()
})

ipcMain.handle('deleteUser', async (e, uid) => {
  const select = dialog.showMessageBoxSync({
    type: 'question',
    title: 'ユーザーを削除します',
    message: '本当によろしいですか？',
    buttons: ['削除', 'キャンセル'],
    cancelId: 1,
  })
  if (select === 0) {
    const user = await User.findOne({ where: { id: uid } })
    await User.destroy(user)
    win.webContents.reloadIgnoringCache()
    await sendDiscord(`❌ ${user.name}さんを削除しました`)
    await sendLine(`❌ ${user.name}さんを削除しました`)
  }
})

ipcMain.handle('getUsers', async (e) => {
  const users = await User.findAll({ raw: true })
  return users
})

ipcMain.handle('loadSettings', (e) => {
  return store.get('settings')
})
ipcMain.handle('setSettings', (e, data) => {
  store.set('settings', data)
})
