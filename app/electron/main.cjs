const { app, BrowserWindow, shell, session, nativeImage, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { startLocalServer, resolveCollectionRoot } = require('./localServer.cjs')

const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:5173'

/** @type {import('http').Server | null} */
let localServer = null

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../public/favicon.ico'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const img = nativeImage.createFromPath(file)
    if (!img.isEmpty()) return img
  }
  return undefined
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pingUrl(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        res.resume()
        resolve(res.statusCode != null && res.statusCode < 500)
      })
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

async function waitForDevServer(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await pingUrl(DEV_URL)) return true
    await sleep(500)
  }
  return false
}

async function startPackagedServer() {
  const distHtml = path.join(__dirname, '../dist/index.html')
  if (!fs.existsSync(distHtml)) {
    throw new Error(
      'No hay build en app/dist. Ejecuta: npm run build\n' +
        'O usa npm run electron:dev para desarrollo.',
    )
  }
  const started = await startLocalServer(app)
  localServer = started.server
  return started
}

function warnMissingCollection(win, collectionRoot) {
  dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Mana Binder — Colección no encontrada',
    message: 'No se encontró coleccion_maestra.json',
    detail:
      'Coloca la carpeta «coleccion_organizada» junto al ejecutable:\n\n' +
      `${path.dirname(process.execPath)}\\coleccion_organizada\\\n\n` +
      'Ruta buscada:\n' +
      `${collectionRoot}\n\n` +
      'También puedes definir la variable de entorno MANA_BINDER_COLLECTION\n' +
      'apuntando a esa carpeta.\n\n' +
      'Genera la colección con: python actualizar_coleccion.py',
  })
}

async function loadApp(win) {
  // Desarrollo: preferir Vite
  if (isDev) {
    const ready = await waitForDevServer()
    if (ready) {
      await win.loadURL(DEV_URL)
      return
    }
  }

  // Empaquetado o fallback: servidor local (UI + colección + proxies)
  let warnedCollection = false
  try {
    const { port, collectionRoot, collectionOk } = await startPackagedServer()
    await win.loadURL(`http://127.0.0.1:${port}`)
    if (!collectionOk && !warnedCollection) {
      warnedCollection = true
      const show = () => warnMissingCollection(win, collectionRoot)
      if (win.isVisible()) show()
      else win.once('ready-to-show', show)
    }
  } catch (err) {
    dialog.showErrorBox('Mana Binder no pudo arrancar', String(err))
    app.quit()
  }
}

function createWindow() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.includes('json.edhrec.com')) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    const headers = { ...details.responseHeaders }
    headers['Access-Control-Allow-Origin'] = ['*']
    callback({ responseHeaders: headers })
  })

  const icon = resolveAppIcon()

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Mana Binder — Colección Magic',
    backgroundColor: '#e8eef2',
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  loadApp(win).catch((err) => {
    dialog.showErrorBox('Mana Binder', String(err))
    app.quit()
  })
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.manabinder.app')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (localServer) {
    try {
      localServer.close()
    } catch {
      /* ignore */
    }
    localServer = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Evitar que queden procesos zombie del server
app.on('before-quit', () => {
  if (localServer) {
    try {
      localServer.close()
    } catch {
      /* ignore */
    }
  }
})

// Export util para tests / scripts
module.exports = { resolveCollectionRoot }
