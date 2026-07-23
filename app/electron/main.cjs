const { app, BrowserWindow, shell, session } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

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

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Mana Binder — Colección Magic',
    backgroundColor: '#e8eef2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.setMenuBarVisibility(false)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
