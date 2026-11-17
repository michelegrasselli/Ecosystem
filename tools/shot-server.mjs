// Server di sviluppo: riceve dal browser un dataURL e lo salva come immagine.
// Serve a catturare frame quando l'anteprima del browser non è visibile.
//
//   node tools/shot-server.mjs [porta]
//
// Uso dalla pagina:
//   fetch('http://127.0.0.1:7788/shot?name=test', { method: 'POST', body: dataURL })

import { createServer } from 'node:http'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.argv[2] || 7788)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots')
mkdirSync(ROOT, { recursive: true })

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(200).end('ok')
    return
  }

  const url = new URL(req.url, 'http://localhost')
  const name = (url.searchParams.get('name') || 'shot').replace(/[^\w-]/g, '_')
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8')
      const comma = body.indexOf(',')
      const meta = body.slice(0, comma)
      const type = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';'))
      const ext = type.includes('png') ? 'png' : 'jpg'
      const file = join(ROOT, name + '.' + ext)
      writeFileSync(file, Buffer.from(body.slice(comma + 1), 'base64'))
      console.log('saved', file)
      res.writeHead(200).end(file)
    } catch (err) {
      console.error(err)
      res.writeHead(500).end(String(err))
    }
  })
}).listen(PORT, '127.0.0.1', () => console.log('shot server su http://127.0.0.1:' + PORT))
