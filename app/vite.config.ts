import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'

const collectionRoot = path.resolve(__dirname, '../coleccion_organizada')

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.csv': 'text/csv; charset=utf-8',
  }
  return map[ext] ?? 'application/octet-stream'
}

function serveCollection(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url ?? ''
  if (!url.startsWith('/collection/')) {
    next()
    return
  }

  const relative = decodeURIComponent(url.slice('/collection/'.length).split('?')[0])
  const filePath = path.normalize(path.join(collectionRoot, relative))

  if (!filePath.startsWith(collectionRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  res.setHeader('Content-Type', contentType(filePath))
  fs.createReadStream(filePath).pipe(res)
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-collection-assets',
      configureServer(server) {
        server.middlewares.use(serveCollection)
      },
      configurePreviewServer(server) {
        server.middlewares.use(serveCollection)
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api/edhrec': {
        target: 'https://json.edhrec.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/edhrec/, ''),
        headers: {
          'User-Agent': 'ManaBinder/1.0 (local deckbuilder)',
        },
      },
      '/api/scryfall': {
        target: 'https://api.scryfall.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/scryfall/, ''),
        headers: {
          'User-Agent': 'ManaBinder/1.0 (local deckbuilder)',
        },
      },
    },
  },
  base: './',
})
