'use strict'

const { app, dialog, BrowserWindow, ipcMain, shell } = require('electron')
const { NFC } = require('nfc-pcsc')
const path = require('path')
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
  cardName: '',
  id: '',
}

// NFC
const nfc = new NFC()

// 設定の保存
const Store = require('electron-store')
const store = new Store()

if (!store.get('settings')) {
  store.set('settings', {
    debug: false,
    darkmode: false,
    sound: true,
    notify: {
      discord: true,
      line: false,
    },
  })
}

// ORMの構成
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
})
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
    name: {
      type: DataTypes.STRING,
    },
    userId: {
      type: DataTypes.STRING(26),
      allowNull: false,
      onDelete: 'cascade',
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
  root: path.join(__dirname, 'views'),
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
    await reply.view('index.ejs', { users: users })
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
  const status = store.get('settings.notify.discord') || false
  if (process.env.DISCORD_WEBHOOK && status) {
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
  const status = store.get('settings.notify.line') || false
  if (process.env.LINE_ACCESS_TOKEN && process.env.LINE_USER_ID && status) {
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

const playSound = (file) => {
  const status = store.get('settings.sound') || false
  if (status) {
    sound.play(path.join(__dirname, file))
  }
}

// ウィンドウ初期化
function createWindow() {
  win = new BrowserWindow({
    title: '入退室管理システム',
    autoHideMenuBar: true,
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'assets/img/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  const handleUrlOpen = (e, url) => {
    if (url.match(/^http/)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  }
  win.webContents.on('will-navigate', handleUrlOpen)
  win.webContents.on('new-window', handleUrlOpen)

  win.loadFile(path.join(__dirname, 'pages', 'index.html'))
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
          playSound('success.mp3')
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
              name: registerData.cardName,
              userId: newUser.id,
            })
            await sendDiscord(`🆕 ${registerData.name}さんを登録しました`)
            await sendLine(`🆕 ${registerData.name}さんを登録しました`)
          } else {
            const currentUser = await User.findOne({
              where: {
                id: registerData.id,
              },
            })
            const newCard = await Card.create({
              id: ULID.ulid(),
              idm: card.uid,
              name: registerData.cardName,
              userId: registerData.id,
            })
            currentUser.state = true
            currentUser.last = new Date()
            await currentUser.save()
          }
          win.webContents.send('callback', true)
          mode = 'read'
        } else if (mode === 'reset') {
          playSound('success.mp3')
          const deleteCard = await Card.findOne({
            where: { idm: card.uid },
          })
          if (deleteCard) {
            const deletedCard = await deleteCard.destroy()
            await sendDiscord(
              `❌ ${registerData.name}さんの${
                deleteCard.name ? deleteCard.name : 'カード'
              }を削除しました`
            )
            await sendLine(
              `❌ ${registerData.name}さんの${
                deleteCard.name ? deleteCard.name : 'カード'
              }を削除しました`
            )
          }
          win.webContents.send('end')
          mode = 'read'
        } else {
          const uCard = await Card.findOne({
            where: { idm: card.uid },
          })
          if (uCard.userId) {
            const user = await User.findOne({
              where: { id: uCard.userId },
            })
            if (user.id) {
              win.webContents.send('auth', { name: user.name })
              playSound('success.mp3')
              if (!user.state) {
                user.last = new Date()
              }
              user.state = !user.state
              const updatedUser = await user.save()
              await sendDiscord(
                `🚪 ${user.name}さんが${uCard ? `${uCard.name}で` : ''}${
                  user.state ? '入室' : '退室'
                }しました`
              )
              await sendLine(
                `🚪 ${user.name}さんが${uCard ? `${uCard.name}で` : ''}${
                  user.state ? '入室' : '退室'
                }しました`
              )
              win.webContents.send(
                'debug',
                `id: ${user.id}\nidm: ${card.uid}\ncardName: ${
                  uCard.name || ''
                }\nstate: ${user.state}`
              )
            }
          }
        }
      } catch (err) {
        console.error(`error`, err)
        playSound('error.mp3')
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
  win.loadFile(path.join(__dirname, 'pages', 'register.html'))
})

ipcMain.handle('showUsers', (e) => {
  win.loadFile(path.join(__dirname, 'pages', 'users.html'))
})

ipcMain.handle('back', (e) => {
  mode = 'read'
  registerData = {
    type: 'create',
    name: '',
    cardName: '',
    id: '',
  }
  win.loadFile(path.join(__dirname, 'pages', 'index.html'))
})

ipcMain.handle('reset', (e) => {
  mode = 'reset'
  setTimeout(() => {
    mode = 'read'
  }, 5000)
})

ipcMain.handle('register', (e, type, name, cardName) => {
  mode = 'register'
  if (type === 'create') {
    registerData = {
      type: 'create',
      name: name,
      cardName: cardName,
    }
  } else {
    registerData = {
      type: 'update',
      id: name,
      cardName: cardName,
    }
  }
})

ipcMain.handle('changeState', async (e, uid) => {
  const user = await User.findOne({ where: { id: uid } })
  if (!user.state) {
    user.last = new Date()
  }
  user.state = !user.state
  await user.save()
  await sendDiscord(
    `🚪 ${user.name}さんを${user.state ? '入室' : '退室'}に変更しました`
  )
  await sendLine(
    `🚪 ${user.name}さんを${user.state ? '入室' : '退室'}に変更しました`
  )
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
    await user.destroy()
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
  try {
    const settings = store.get('settings')
    store.set('settings', { ...settings, ...data })
    return true
  } catch (e) {
    return false
  }
})
ipcMain.handle('openInfo', (e) => {
  const informationWindow = new BrowserWindow({
    parent: win,
    title: 'このソフトウェアについて',
    width: 400,
    height: 500,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/img/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
    },
    modal: true,
  })
  const handleUrlOpen = (e, url) => {
    if (url.match(/^http/)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  }
  informationWindow.webContents.on('will-navigate', handleUrlOpen)
  informationWindow.webContents.on('new-window', handleUrlOpen)
  informationWindow.loadFile(path.join(__dirname, 'pages', 'info.html'))
})
ipcMain.handle('openSettings', (e) => {
  const settingsWindow = new BrowserWindow({
    parent: win,
    title: '環境設定',
    width: 600,
    height: 400,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/img/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
    },
    modal: true,
  })
  settingsWindow.loadFile(path.join(__dirname, 'pages', 'settings.html'))
})
