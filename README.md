# Ecosystem Planet

Simulazione esplorabile di un pianeta: si parte dallo spazio e si scende fino a scala
regionale, su un pianeta generato proceduralmente (continenti, oceani, mari, laghi, fiumi,
rilievi, biomi e clima). Per ora il pianeta è **disabitato**: piante e animali arriveranno
nelle fasi successive.

Lo stile è cartoon ma adulto: palette spenta, ombre a bande morbide, nessuna texture
fotografica.

## Avvio

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output statico in dist/
npm run preview
```

Serve Node 18+ (o 20+).

## Comandi di navigazione

| Azione | Comando |
|--------|---------|
| Ruotare / spostarsi | trascinamento con il tasto sinistro |
| Zoom verso il cursore | rotella del mouse |
| Inclinare e ruotare la vista | trascinamento con tasto destro o `Shift` + sinistro |
| Volo rapido su un punto | doppio clic |
| Tornare alla vista iniziale | tasto con la casa |
| Salvare il pianeta | tasto `salva` in basso a destra, oppure `Ctrl` + `S` |

## Salvataggio

Lo stato (seed del pianeta e posizione della camera) viene salvato in `localStorage`
sotto la chiave `ecosystem-planet/state` e ripristinato automaticamente al successivo
avvio. Il salvataggio automatico della sola camera avviene anche alla chiusura della pagina.

## Com'è fatto

- **Vite + three.js**, nessun backend, output statico.
- Il pianeta è una funzione deterministica: `Planet.sample(direzione) → quota, clima, bioma, colore`.
  Lo stesso seed produce sempre lo stesso pianeta, a qualunque risoluzione.
- Il terreno è un **quadtree su cubo-sfera** con LOD continuo dallo spazio alla scala
  regionale (fino al livello 15), normali coerenti tra tile adiacenti e gonne di chiusura
  sulle crepe.
- Il rumore è un simplex 3D scritto a mano (`src/core/noise.js`): nessuna dipendenza esterna.

Dettagli, decisioni e limiti noti sono in [CONTEXT.md](CONTEXT.md).

## Strumenti di sviluppo

```bash
node tools/planet-stats.mjs        # statistiche di biomi, quote, laghi e fiumi
node tools/shot-server.mjs 7788    # server locale per catturare frame dal browser
```
