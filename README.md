# Ecosystem Planet

Simulazione esplorabile di un pianeta: si parte dallo spazio e si scende fino a
25 m dal suolo, su un pianeta generato proceduralmente (continenti, oceani, mari, laghi, fiumi,
rilievi, biomi e clima). Per ora il pianeta è **disabitato**: piante e animali arriveranno
nelle fasi successive.

Lo stile è illustrato ma adulto (tipo Animal Crossing, più serio): palette terrosa, luce a
bande morbide con ombre fredde, chiome degli alberi tonde, dune e rocce a strati, nessuna
texture fotografica. Il rilievo è esagerato in funzione della quota (come Google Earth),
così montagne e valli si leggono anche dallo spazio.

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
| Ruotare il globo | trascinamento con il tasto sinistro |
| Traslare la vista | trascinamento tenendo premuta la rotella |
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
  al suolo (fino al livello 17), normali coerenti tra tile adiacenti e gonne di chiusura
  sulle crepe.
- Le tile sono calcolate in un pool di **Web Worker**: il thread principale non si blocca.
- Il rumore è un simplex 3D scritto a mano (`src/core/noise.js`): nessuna dipendenza esterna.

Dettagli, decisioni e limiti noti sono in [CONTEXT.md](CONTEXT.md).

## Strumenti di sviluppo

```bash
node tools/planet-stats.mjs        # statistiche di biomi, quote, laghi e fiumi
node tools/continents.mjs          # terre emerse e dimensione delle masse continentali
node tools/shot-server.mjs 7788    # server locale per catturare frame dal browser
```
