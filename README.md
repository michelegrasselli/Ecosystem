# The creation of ELYRA

Simulazione esplorabile di un pianeta chiamato **ELYRA**: si parte dallo spazio e si scende
fino a 25 m dal suolo, su un pianeta generato proceduralmente (continenti, oceani, mari, laghi,
fiumi, rilievi, biomi e clima). Per ora il pianeta è **disabitato**: piante e animali
arriveranno nelle fasi successive.

Lo stile è illustrato ma adulto (tipo Animal Crossing, più serio): palette terrosa, luce a
bande morbide con ombre fredde, chiome degli alberi tonde, dune e rocce a strati, nessuna
texture fotografica. Il rilievo è esagerato in funzione della quota (come Google Earth),
così montagne e valli si leggono anche dallo spazio.


## La serie

L'app serve a produrre una serie di **video corti** che narrano, un atto alla volta, la
creazione del mondo fantasy di Elyra: il pianeta, poi flora, fauna, stagioni, atmosfere e
popoli, con un tono affascinante, misterioso e trascendente. Le idee di riferimento sono
raccolte nella cartella [`contesto/`](contesto/).

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

## Girare un episodio

Il pulsante 🎬 apre il pannello di regia:

1. scegli un episodio (le sceneggiature sono in `episodes/`) o modifica il JSON;
2. **Preview** lo fa girare in tempo reale nella cornice verticale 9:16;
3. **Render video** lo gira fotogramma per fotogramma a 1080×1920 e crea un MP4 (H.264)
   direttamente nel browser. Con `npm run dev` il file viene salvato in `videos/`,
   altrimenti viene scaricato.

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

Sul pianeta ci sono 46 vulcani sparsi, grandi e piccoli: trenta sulla terraferma e sedici
isole vulcaniche in mare aperto. Circa la metà è attiva: nel cratere, largo e con l'orlo
rialzato, c'è un lago di lava animata (crosta scura che si spacca, crepe incandescenti che
pulsano) e dai fianchi scendono colate accese. Attorno ai vulcani si stendono campi di colate
nere o, per i più vecchi, grigio-brune e in parte ricoperte dalla vegetazione; molti attivi
sono circondati da una zona di terra bruciata. In mare compaiono anche arcipelaghi di isole e isolotti
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
