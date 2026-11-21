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

export default defineConfig({
  base: './',
  plugins: [fileProtocolHtml()],
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
