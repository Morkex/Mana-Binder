const { app, BrowserWindow, shell, session, nativeImage, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

const isDev = !app.isPackaged
const DEV_URL = 'http://127.0.0.1:5173'

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

async function loadApp(win) {
  if (isDev) {
    const ready = await waitForDevServer()
    if (ready) {
      await win.loadURL(DEV_URL)
      return
    }

    const distHtml = path.join(__dirname, '../dist/index.html')
    if (fs.existsSync(distHtml)) {
      await win.loadFile(distHtml)
      dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Mana Binder',
        message: 'No se encontró el servidor de desarrollo (Vite).',
        detail:
          'Se cargó la build estática (dist). La colección puede no cargar.\n\n' +
          'Usa el acceso directo “Mana Binder” o ejecuta:\n' +
          '  npm run electron:dev\n' +
          'desde la carpeta app.',
      })
      return
    }

    dialog.showErrorBox(
      'Mana Binder no pudo arrancar',
      'Vite no está en marcha en http://127.0.0.1:5173 y no hay build en dist/.\n\n' +
        'Abre la app con el acceso directo del escritorio, o en una terminal:\n' +
        '  cd "Desktop\\Mana Binder\\app"\n' +
        '  npm run electron:dev',
    )
    app.quit()
    return
  }

  await win.loadFile(path.join(__dirname, '../dist/index.html'))
}

function createWindow() {
  // Allow EDHREC JSON from the renderer (no official CORS headers).
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
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
