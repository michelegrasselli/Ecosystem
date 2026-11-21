# The creation of ELYRA

Simulazione esplorabile di un pianeta chiamato **ELYRA**: si parte dallo spazio e si scende
fino a 25 m dal suolo, su un pianeta generato proceduralmente (continenti, oceani, mari, laghi,
fiumi, rilievi, biomi e clima). Per ora il pianeta è **disabitato**: piante e animali
arriveranno nelle fasi successive.

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

Senza server: dopo `npm run build` basta un doppio clic su `index.html` (o su
`dist/index.html`). Il bundle è un unico script classico con i worker incorporati,
quindi parte anche da `file://`. Il doppio clic apre l'ultima build: dopo aver
modificato il codice va rilanciato `npm run build`.

## Comandi di navigazione

| Azione | Comando |
|--------|---------|
| Ruotare il globo | trascinamento con il tasto sinistro |
| Traslare la vista | `Ctrl` + trascinamento con il tasto sinistro, oppure rotella premuta |
| Zoom verso il cursore | rotella del mouse |
| Inclinare e ruotare la vista | trascinamento con tasto destro o `Shift` + sinistro |
| Volo rapido su un punto | doppio clic |
| Tornare alla vista iniziale | tasto con la casa |
| Salvare il pianeta | tasto `salva` in basso a destra, oppure `Ctrl` + `S` |

## Salvataggio

Lo stato (seed del pianeta e posizione della camera) viene salvato in `localStorage`
sotto la chiave `ecosystem-planet/state` e ripristinato automaticamente al successivo
avvio. Il salvataggio automatico della sola camera avviene anche alla chiusura della pagina.

## Nazioni

La terraferma è divisa in 79 regni dai nomi inventati di sapore medievale (es. "Kingdom of Wendmere", "Duchy of Merrowdale"): il rango dipende dall'estensione del regno. Avvicinandosi
(sotto i ~7000 km) compaiono i nomi, ancorati a punti fissi del territorio: restano fermi sul
terreno anche durante zoom e spostamenti. I confini sono una linea scura
tratteggiata su un alone chiaro, leggibile da vicino e anche dallo spazio. L'HUD indica la nazione
sotto la camera.

## Vulcani e isole

Nelle province vulcaniche svettano coni di basalto scuro; metà sono attivi e hanno un lago di
lava nel cratere. In mare compaiono isole vulcaniche e arcipelaghi di isole e isolotti
circondati da acqua bassa. Il mare è animato a ogni quota: creste d'onda parallele che
scorrono, visibili già da ~3000 km.

## Lingua

L'interfaccia è in inglese (HUD, caricamento, messaggi). I nomi dei biomi e delle nazioni
sono in inglese.

## Com'è fatto

- **Vite + three.js**, nessun backend, output statico.
- Il pianeta è una funzione deterministica: `Planet.sample(direzione) → quota, clima, bioma, colore`.
  Lo stesso seed produce sempre lo stesso pianeta, a qualunque risoluzione.
- Il terreno è un **quadtree su cubo-sfera** con LOD continuo dallo spazio alla scala
  al suolo (fino al livello 17), normali coerenti tra tile adiacenti e gonne di chiusura
  sulle crepe.
- Le tile sono calcolate in un pool di **Web Worker**: il thread principale non si blocca.
  Le tile nuove nascono con la forma della tile padre e si raffinano in mezzo secondo
  (morph), così lo zoom dallo spazio a un singolo luogo è continuo.
- Il rumore è un simplex 3D scritto a mano (`src/core/noise.js`): nessuna dipendenza esterna.

Dettagli, decisioni e limiti noti sono in [CONTEXT.md](CONTEXT.md).

## Strumenti di sviluppo

```bash
node tools/planet-stats.mjs        # statistiche di biomi, quote, laghi e fiumi
node tools/continents.mjs          # terre emerse e dimensione delle masse continentali
node tools/check-skirt.mjs         # verso delle facce delle gonne (crepe nere)
node tools/shot-server.mjs 7788    # server locale per catturare frame dal browser
```
