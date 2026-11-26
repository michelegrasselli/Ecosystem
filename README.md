# The creation of ELYRA

Simulazione esplorabile di un pianeta chiamato **ELYRA**: si parte dallo spazio e si scende
fino a 40 km dal suolo (il mondo si esplora già da 300 km), su un pianeta generato proceduralmente (continenti, oceani, mari, laghi,
fiumi, rilievi, biomi e clima). Le piante ci sono già (vedi Flora); gli animali arriveranno nelle fasi successive.

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

### Episodi

- `ep01-the-birth-of-a-planet` — la nascita del pianeta (teaser, 48 s)
- `ep02-the-nature-of-elyra` — le stranezze di Elyra: niente luna ma maree, oceani che
  brillano di notte, ghiaccio più antico della luce, vulcani che si svegliano insieme (59 s)
- `ep03-the-first-breath` — la prima vita si risveglia nei mari attorno ai vulcani (58 s)
- `ep04-the-ninety-year-heartbeat` — tutti i vulcani eruttano insieme e la cenere prepara le prime piante (47 s)
- `ep05-the-first-seed` — sotto la cenere nasce una luce: le prime piante germogliano e un'onda verde copre il pianeta (61 s)

### Effetti e montaggio

Con il blocco `fx` nella sceneggiatura il video passa in una "post-produzione" nel
browser: bagliore, messa a fuoco, nebbia mistica, luci d'obiettivo, color grading, grana,
pulviscolo dorato e braci; i cambi di scena si nascondono con lampi di luce (`flashes`) o
discese al buio (`dips`). Vedi `episodes/ep01-the-birth-of-a-planet.json`.

### Voce narrante e musica

Le battute del narratore si scrivono nella sceneggiatura (`narration.lines`, con il
secondo d'inizio) e si trasformano in audio con una voce maschile profonda, in locale
(Kokoro TTS, nessun servizio esterno):

```
npm run narrate -- episodes/ep01-the-birth-of-a-planet.json
```

I file finiscono in `audio/<episodio>/`. Al render la voce viene mixata con la musica
(`music.src`, a volume basso e che si abbassa ancora quando parla il narratore) e il
video esce con la traccia audio AAC e i sottotitoli.

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

## Flora

Elyra è coperta da una flora colossale: 47 specie, alcune terrestri e molte inventate, alte
da 1.5 km a oltre 20 km, così da 300 km di quota si esplora tra gli alberi e dallo spazio si
vedono le macchie dei boschi. Le piante sono
raccolte a macchie: boschi fittissimi, boschetti, radure quasi spoglie. Foreste di
latifoglie, conifere, alberi in fiore rosa e giganti coperti di muschio; colonie di funghetti
turchesi, felci-piuma blu, lanterne arancio e gigli a stella nel sottobosco; vaste paludi di
lagune e isole boscose con cipressi dalle barbe di muschio, canneti e campane luminose come
meduse; le Valli dei Cristalli, vaste regioni di roccia viola con prismi azzurri e rosa
giganti, alberi di cristallo e granuli luminosi;
cactus, spine dorate e palme d'oasi nei deserti; alberi carbonizzati, rami in fiamme, coralli
di brace e schegge d'ossidiana sui suoli vulcanici; cristalli, sfere di ghiaccio accese e
batuffoli bianchi sui ghiacci; e nel mare basso ventagli di corallo, alghe dalle vesciche
dorate, anemoni dai tentacoli turchesi, conchiglie giganti con la perla accesa, loti, torri
a spirale di conchiglia, mangrovie e i Tidecrown, che salgono dal fondo e spuntano
dall'acqua con una campana viola e tentacoli luminosi.

**Enciclopedia**: fermando il mouse per un attimo su un punto del pianeta compare l'elenco
delle piante del bioma; passando su una pianta si apre la sua pagina, con una "foto"
renderizzata in stile fantasy, tipo, altezza (in metri), habitat, tossicità, caratteristiche,
storia naturale e curiosità. Fermando il mouse sul nome di una nazione compare la pagina
della sua terra: superficie, rilievi, clima, acque, vulcani, biomi, terre confinanti e
storia naturale. Elyra non è ancora abitata: niente popolazione, capitali o sovrani. Da vicino le piante sono in 3D e si
muovono nel vento, e il terreno mostra erba pettinata dal vento, increspature della sabbia,
cumuli di neve e basalto spaccato.

## Nazioni

La terraferma (~44% del pianeta, con quattro terre nuove negli oceani più vuoti: una grande terra boreale, una australe e due grandi isole paludose) è divisa in 76 regni dai nomi inventati di sapore medievale (es. "Kingdom of Wendmere", "Duchy of Merrowdale"): il rango dipende dall'estensione del regno. Avvicinandosi
(sotto i ~7000 km) compaiono i nomi, ancorati a punti fissi del territorio: restano fermi sul
terreno anche durante zoom e spostamenti. I confini sono una linea scura
tratteggiata su un alone chiaro, leggibile da vicino e anche dallo spazio. L'HUD descrive il punto
sotto il mouse: coordinate, quota del terreno, nazione, bioma e temperatura (più la quota
della camera).

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
