/**
 * Servidor HTTP local para modo empaquetado / dist sin Vite.
 * Sirve: UI (dist), /collection/* (disco), proxy /api/edhrec y /api/scryfall.
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  }
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Busca coleccion_organizada en rutas típicas (junto al .exe, resources, repo).
 */
function resolveCollectionRoot(app) {
  if (process.env.MANA_BINDER_COLLECTION) {
    return path.resolve(process.env.MANA_BINDER_COLLECTION)
  }

  const candidates = []
  if (app.isPackaged) {
    candidates.push(path.join(path.dirname(process.execPath), 'coleccion_organizada'))
    candidates.push(path.join(process.resourcesPath, 'coleccion_organizada'))
    // portable: a veces el exe está en una subcarpeta
    candidates.push(path.join(path.dirname(process.execPath), '..', 'coleccion_organizada'))
  }
  // app/electron → ../../coleccion_organizada (repo)
  candidates.push(path.join(__dirname, '..', '..', 'coleccion_organizada'))
  candidates.push(path.join(process.cwd(), 'coleccion_organizada'))
  candidates.push(path.join(process.cwd(), '..', 'coleccion_organizada'))

  for (const dir of candidates) {
    const resolved = path.resolve(dir)
    if (fs.existsSync(path.join(resolved, 'coleccion_maestra.json'))) return resolved
  }
  return path.resolve(candidates[0])
}

function resolveDistRoot() {
  return path.join(__dirname, '..', 'dist')
}

function safeJoin(root, relativeUrlPath) {
  const rootResolved = path.resolve(root)
  const decoded = decodeURIComponent((relativeUrlPath || '').split('?')[0]).replace(/^[/\\]+/, '')
  const filePath = path.resolve(rootResolved, decoded)
  const rel = path.relative(rootResolved, filePath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return filePath
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  res.setHeader('Content-Type', contentType(filePath))
  res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600')
  fs.createReadStream(filePath).pipe(res)
}

function proxyRequest(req, res, targetOrigin, rewritePrefix) {
  const u = new URL(req.url, 'http://127.0.0.1')
  const destPath = u.pathname.replace(rewritePrefix, '') + u.search
  const target = new URL(destPath, targetOrigin)
  const lib = target.protocol === 'https:' ? https : http
  const headers = {
    ...req.headers,
    host: target.host,
    'user-agent': 'ManaBinder/1.0 (desktop)',
  }
  delete headers['accept-encoding']

  const upstream = lib.request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )
  upstream.on('error', (err) => {
    res.statusCode = 502
    res.end(`Proxy error: ${err.message}`)
  })
  req.pipe(upstream)
}

/**
 * @returns {Promise<{ server: import('http').Server, port: number, collectionRoot: string, distRoot: string, collectionOk: boolean }>}
 */
function startLocalServer(app) {
  const distRoot = resolveDistRoot()
  const collectionRoot = resolveCollectionRoot(app)
  const collectionOk = fs.existsSync(path.join(collectionRoot, 'coleccion_maestra.json'))

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/'

    if (url.startsWith('/api/edhrec')) {
      proxyRequest(req, res, 'https://json.edhrec.com', '/api/edhrec')
      return
    }
    if (url.startsWith('/api/scryfall')) {
      proxyRequest(req, res, 'https://api.scryfall.com', '/api/scryfall')
      return
    }

    if (url.startsWith('/collection/')) {
      const rel = url.slice('/collection/'.length)
      const filePath = safeJoin(collectionRoot, rel)
      if (!filePath) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      sendFile(res, filePath)
      return
    }

    // Static UI
    let rel = url.split('?')[0]
    if (rel === '/' || rel === '') rel = '/index.html'
    const filePath = safeJoin(distRoot, rel.replace(/^\//, ''))
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }
    // SPA fallback
    sendFile(res, path.join(distRoot, 'index.html'))
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ server, port, collectionRoot, distRoot, collectionOk })
    })
  })
}

module.exports = {
  startLocalServer,
  resolveCollectionRoot,
  resolveDistRoot,
  pathToFileURL,
}
