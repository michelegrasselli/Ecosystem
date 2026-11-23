import { defineConfig } from 'vite'

// La build deve aprirsi anche con doppio clic su dist/index.html (file://).
// Lì il browser blocca gli script `type="module"`, le richieste `crossorigin`
// e i worker caricati da file separati. Quindi:
//  - un unico bundle IIFE (script classico, nessun import dinamico);
//  - il worker è incorporato nel bundle (vedi render/tilePool.js);
//  - nell'HTML finale lo script diventa `defer` classico, senza crossorigin.
function fileProtocolHtml() {
  return {
    name: 'file-protocol-html',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/\s*<!--[^>]*?file:\/\/[\s\S]*?-->\s*<script data-source-only>[\s\S]*?<\/script>/, '')
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/ crossorigin(="[^"]*")?/g, '')
    }
  }
}

// Regia: con il server di sviluppo i video girati vengono salvati
// direttamente in videos/ del progetto (POST /__director/save?name=...).
// Nella build statica non c'è: il video si scarica dal browser.
function directorSave() {
  return {
    name: 'director-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__director/save', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        try {
          const { mkdirSync, writeFileSync } = await import('node:fs')
          const { join, resolve } = await import('node:path')
          const url = new URL(req.url, 'http://localhost')
          const raw = url.searchParams.get('name') || 'episode.mp4'
          const name = raw.replace(/[^\w.-]/g, '_').replace(/^\.+/, '') || 'episode.mp4'
          const dir = resolve(server.config.root, 'videos')
          mkdirSync(dir, { recursive: true })
          const chunks = []
          for await (const c of req) chunks.push(c)
          const file = join(dir, name)
          writeFileSync(file, Buffer.concat(chunks))
          res.end(file)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [fileProtocolHtml(), directorSave()],
  server: {
    port: 5173,
    open: false
  },
  worker: {
    format: 'iife'
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true
      }
    }
  }
})
