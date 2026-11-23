// Pannello di regia: scelta dell'episodio, sceneggiatura modificabile,
// anteprima, ripresa in MP4 e salvataggio.
//
// Le sceneggiature stanno in episodes/*.json (incluse nel bundle).

const EPISODES = import.meta.glob('../../episodes/*.json', { eager: true, import: 'default' })

function episodeList() {
  return Object.entries(EPISODES)
    .map(([path, script]) => ({ file: path.split('/').pop(), script }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function createDirectorPanel(director) {
  const episodes = episodeList()

  // pulsante discreto accanto agli strumenti della navigazione
  const btn = document.createElement('button')
  btn.className = 'tool'
  btn.id = 'btn-director'
  btn.title = 'Director: preview and render episodes'
  btn.textContent = '🎬'
  document.querySelector('.hud-tools')?.appendChild(btn)

  const panel = document.createElement('div')
  panel.className = 'director-panel'
  panel.innerHTML = `
    <div class="dp-head">
      <span class="dp-title">Director</span>
      <button class="dp-close" title="Close">×</button>
    </div>
    <label class="dp-row">Episode
      <select class="dp-episode"></select>
    </label>
    <textarea class="dp-script" spellcheck="false"></textarea>
    <div class="dp-buttons">
      <button class="dp-preview">Preview</button>
      <button class="dp-stop">Stop</button>
      <button class="dp-render">Render video</button>
      <button class="dp-save" disabled>Save</button>
    </div>
    <div class="dp-progress"><div class="dp-fill"></div></div>
    <div class="dp-status">ready</div>
    <canvas class="dp-thumb" width="108" height="192"></canvas>
  `
  document.body.appendChild(panel)

  const $ = (sel) => panel.querySelector(sel)
  const sel = $('.dp-episode')
  const ta = $('.dp-script')
  const status = $('.dp-status')
  const fill = $('.dp-fill')
  const thumb = $('.dp-thumb').getContext('2d')
  const saveBtn = $('.dp-save')

  for (const ep of episodes) {
    const o = document.createElement('option')
    o.value = ep.file
    o.textContent = ep.script.name || ep.file
    sel.appendChild(o)
  }
  function showEpisode(file) {
    const ep = episodes.find((e) => e.file === file)
    if (ep) ta.value = JSON.stringify(ep.script, null, 2)
  }
  if (episodes.length) showEpisode(episodes[0].file)
  sel.addEventListener('change', () => showEpisode(sel.value))

  function readScript() {
    try {
      return JSON.parse(ta.value)
    } catch (e) {
      status.textContent = 'script error: ' + e.message
      throw e
    }
  }

  function setBusy(busy) {
    document.body.classList.toggle('director-busy', busy)
    $('.dp-render').disabled = busy
    $('.dp-preview').disabled = busy
  }

  btn.addEventListener('click', () => panel.classList.toggle('open'))
  $('.dp-close').addEventListener('click', () => panel.classList.remove('open'))

  $('.dp-preview').addEventListener('click', () => {
    try {
      director.preview(readScript())
      status.textContent = 'preview…'
    } catch (e) {
      status.textContent = 'error: ' + e.message
    }
  })
  $('.dp-stop').addEventListener('click', () => {
    director.stop()
    status.textContent = 'stopped'
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && director.mode === 'preview') director.stop()
  })

  let lastResult = null
  $('.dp-render').addEventListener('click', async () => {
    let script
    try {
      script = readScript()
    } catch {
      return
    }
    setBusy(true)
    saveBtn.disabled = true
    try {
      const res = await director.render(script, {
        onProgress(i, total, canvas) {
          fill.style.width = ((i / total) * 100).toFixed(1) + '%'
          status.textContent = `rendering frame ${i} / ${total}`
          if (i % 3 === 0) thumb.drawImage(canvas, 0, 0, 108, 192)
        }
      })
      lastResult = res
      const out = await director.save(res)
      status.textContent =
        `done in ${res.seconds.toFixed(0)} s (${res.codec}) — ` +
        (out.saved ? 'saved to ' + out.saved : 'downloaded ' + out.downloaded)
      saveBtn.disabled = false
    } catch (e) {
      status.textContent = 'error: ' + e.message
    } finally {
      setBusy(false)
    }
  })
  saveBtn.addEventListener('click', async () => {
    if (!lastResult) return
    const out = await director.save(lastResult)
    status.textContent = out.saved ? 'saved to ' + out.saved : 'downloaded ' + out.downloaded
  })

  return {
    open: () => panel.classList.add('open'),
    close: () => panel.classList.remove('open'),
    episodes
  }
}
