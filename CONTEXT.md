# CONTEXT — Ecosystem Planet

> Documento di contesto del progetto. Va letto prima di qualsiasi modifica al codice.
> Ogni decisione tecnica deve restare coerente con quanto scritto qui.

---

## 1. Obiettivo del progetto

Creare una **applicazione web** che sia la **simulazione di un ecosistema planetario**.

L'utente deve poter esplorare un pianeta simile alla Terra con una vista globo in
**stile Google Earth**, partendo dallo spazio e potendo zoomare fino a scala regionale
(es. deserto del Sahara) dove, in futuro, vedrà piante e animali che vivono in quell'ambiente.

Il pianeta deve essere **ragionevolmente fedele** alla realtà: conformazione territoriale,
distribuzione di mari/continenti, laghi, fiumi, fasce climatiche e temperature.

---

## 2. Requisiti funzionali (richiesti dall'utente)

| # | Requisito | Stato |
|---|-----------|-------|
| R1 | Vista della Terra in stile Google Earth, con **lo stesso stile di navigazione** (drag per ruotare, scroll per zoomare, tilt, fly-to) | **fatto** |
| R2 | Zoom **multi-scala**: dallo spazio fino a scala regionale (es. Sahara) | **fatto** (LOD 0→17, fino a 25 m dal suolo) |
| R3 | A scala regionale si devono poter vedere animali e piante **senza appesantire la grafica** | zoom pronto (25 m dal suolo, chiome disegnate nello shader); piante/animali 3D in fase 2 |
| R4 | Contenuto **ragionevolmente fedele**: ambienti, temperature, conformazione territoriale | **fatto** per il pianeta |
| R5 | **Per ora**: solo modello del pianeta — continenti, mari, oceani, laghi, fiumi, rilievi. **Niente piante né animali.** | **fatto** |
| R6 | Stile grafico **cartoon**, tipo Animal Crossing ma **meno bambinesco e più maturo** | **fatto** (illustrato: bande morbide, ombre fredde, chiome tonde, dune, rocce a strati) |
| R7 | Tasto **poco visibile "Salva"** che salva lo stato del pianeta | **fatto** |
| R8 | Lo stato salvato viene **ricaricato automaticamente** al prossimo avvio | **fatto** (verificato) |
| R9 | Repository GitHub con **commit + push dopo ogni prompt** | attivo |

---

## 3. Decisioni di design

### 3.1 Stile grafico

- **Cartoon maturo**: palette desaturata e "terrosa", non pastello.
  Riferimento: Animal Crossing per la pulizia delle forme, ma colori più spenti,
  ombre più profonde, zero elementi infantili (niente faccine, niente bordi neri spessi).
- Illuminazione **toon a bande morbide** (2-3 bande con `smoothstep`), non flat-shaded puro.
- Forme semplificate: nessun dettaglio fine inutile, silhouette leggibili.
- Niente texture fotografiche: tutto **procedurale** o a blocchi di colore.

### 3.2 Scala e dettaglio (R2 + R3)

- Il pianeta ha raggio `R = 6371 km` (Terra), unità di scena 1 = 1 km, con
  `logarithmicDepthBuffer` per gestire l'enorme intervallo di profondità.
- Navigazione a **modello camera su punto di superficie**:
  - `lat`, `lon` → punto sotto la camera
  - `altitude` → quota sopra la superficie, in km
  - `pitch` → inclinazione (90° = zenitale, 20-30° = vista radente)
  - `heading` → orientamento
  - La base della camera è costruita **esplicitamente** (destra, alto, avanti) invece che
    con `lookAt`: evita la degenerazione allo zenit e mantiene la terna destrorsa.
- **Un solo sistema di rendering**: `TerrainLOD`, un quadtree su cubo-sfera (6 facce) attivo
  a ogni quota. Non esiste una sfera separata per la vista dallo spazio: a quota alta
  bastano i livelli 0-3. Vantaggi: una sola `Planet.sample()` come verità, nessun pop
  nel passaggio tra "globo lontano" e "terreno vicino".
- LOD: una tile si suddivide quando supera `SPLIT_PIXELS = 110` pixel a schermo; livello
  massimo 17 (tile di ~76 m, maglie di ~1.7 m). Budget di generazione per frame (`buildBudgetMs`), priorità alle tile vicine.
- Risoluzione per tile (`tileResForLevel`): 10 → 44 vertici per lato secondo il livello,
  scelta per tenere ~2 pixel per maglia a schermo.
- `qualityForLevel()` restituisce sempre `1`: le quote devono essere **identiche a tutti i
  livelli LOD**, altrimenti sulle giunzioni compaiono gradini.
- **Skirt** (gonna) lungo i bordi di ogni tile per chiudere le crepe tra livelli diversi.
- **Invariante anti-buchi** (`terrainLOD.js`): `visit()` viene chiamata solo su nodi con
  mesh. Le 6 radici sono costruite subito; un nodo scende nei figli solo se tutti e quattro
  sono pronti, altrimenti disegna se stesso. Ogni nodo attraversato è marcato come usato
  nel frame, quindi la cache non scarica mai un antenato di ciò che è a schermo. La
  visibilità si basa sulla lista `drawn` del frame, non sulla cache. (Bug storico: radici
  mai costruite e nodi scaricati "disegnati" senza mesh e mai rimessi in coda → buchi.)
- **Vertici relativi al centro della tile** (`mesh.position`) e griglia estesa in Float64:
  con coordinate assolute in float32 (~6371 km) l'errore è ~0.5 m, inaccettabile a 25 m.

### 3.8 Rilievo esagerato (`render/relief.js`)

- Le tile sono costruite a esagerazione 1; il vertex shader sposta ogni vertice lungo la
  verticale di `aHeight * (k - 1)`. `k` dipende dalla quota della camera: 1.5 vicino al
  suolo, 4.2 dallo spazio. Cambia ogni frame senza ricostruire nulla.
- Le normali di illuminazione usano un'esagerazione ancora maggiore (`shadingExaggeration`),
  ricavata dalla normale a k=1: `N = normalize(R - (R - N1/dot(N1,R)) * kS)`.
- Luce: sole reale + "sole radente" con lo stesso azimut, così i pendii si leggono anche
  a mezzogiorno. Ombre fredde (bluastre), luce calda.
- La camera misura la quota **dal terreno** (`controls.groundKm`, stessa esagerazione):
  piante e animali dovranno usare `reliefExaggeration()` per appoggiarsi al suolo.
- Il generatore ha creste secondarie deformate sulle montagne (valli di ~2.5 km), colline
  di 6 km / 2 km e dossi di 400 m / 80 m. I laghi stanno al livello del bacino
  (`baseLevel - 200`), non scavati fino al livello del mare.

### 3.9 Dettaglio nello shader (`render/materials.js`)

- Posizione passata al fragment **relativa alla camera** (calcolata in view space) e
  rumore su reticolo ancorato al mondo: `uOrigin` è un multiplo di 64 km, le frequenze
  sono potenze di due ≥ 1/64, quindi l'offset del reticolo è un intero esatto. Il rumore è
  letto da una texture 3D 64³ (un accesso per ottava); le chiome usano un hash intero.
- Ogni scala si spegne in base al lato del pixel sul terreno (`scaleW(lambda, foot)`):
  niente moiré. Le ottave sono calcolate una volta e riusate da tutti gli strati.
- Strati: confini di bioma sfrangiati (`aSurf` = foresta, sabbia, roccia, neve),
  prati a due toni, chiome tonde con ombra portata (Worley 2×2×2 proiettato sul piano
  tangente), dune con lato al sole/sottovento, roccia a strati, neve e roccia d'alta quota
  dalla quota del fragment (isoipse, non scalini di maglia), acqua con battigia.
- **Risoluzione adattiva** in `main.js`: il pixel ratio scende fino a 0.6 se il frame
  supera ~26 ms e risale quando c'è margine.

### 3.5 Cuciture tra tile (importante)

Tre accorgimenti, tutti necessari, altrimenti compaiono righe scure sui confini:

1. **Normali da griglia estesa**: `buildTileMesh` campiona una griglia più larga di una
   cella per lato e calcola le normali con differenze centrali usando le coordinate
   *globali* (`(ix + (i-1)/res)/div`). Due tile adiacenti ottengono così normali
   identiche bit per bit; con differenze unilaterali il toon shading creava una riga scura.
2. **Nessuna inversione di normale sulle facce posteriori**: le skirt, viste di taglio dal
   lato interno attraversando una crepa, venivano illuminate al contrario. Il fragment
   shader usa `N` così com'è.
3. **Skirt proporzionate** (maglia × 0.35 + quota massima della tile × 0.18, max 40 unità, scalate con l'esagerazione nello shader): gonne troppo profonde
   bucano il terreno delle tile vicine.

### 3.6 Colore e LOD (importante)

Il **colore non dipende dal livello LOD**. All'inizio i fiumi venivano allargati solo nel
colore sui LOD grossi (per renderli visibili), ma questo faceva comparire un **quadrato di
colore diverso** al confine tra tile di livello 2 e 3: una singola lettura per vertice
"pescava" un fiume largo pochi km e lo spalmava su tutta la maglia (89-178 km).

Ora:

- fiumi con **letto fisico di ~3.2 km** (più fascia valliva colorata di ~7 km), uguale a
  ogni livello: a scala regionale si leggono, dallo spazio restano invisibili (come in
  natura);
- **mottle di albedo a bassa frequenza** (periodo ~600 km): le maglie da 178 km non la
  aliasano;
- sui livelli grossolani (≤ 5) il colore per vertice è la **media d'area di 4 sotto-campioni
  per cella**: fiumi e spiagge sottili contribuiscono in proporzione all'area che coprono
  invece di diventare macchie. È un filtro anti-aliasing del colore (come una mipmap);
  la quota resta quella del centro cella, quindi la geometria è identica tra LOD.

### 3.7 Profondità logaritmica e materiali custom

Il renderer usa `logarithmicDepthBuffer` per gestire la scala (raggio 6371 → quota 42 000).
I materiali `ShaderMaterial` custom (terreno e atmosfera) devono includere i chunk
`<logdepthbuf_pars_vertex/fragment>` e `<logdepthbuf_vertex/fragment>`: senza, scrivono una
profondità "normale" non confrontabile con quella dei materiali built-in e le stelle
comparivano come puntini bianchi **sopra** il pianeta.

### 3.3 Fedeltà geografica (R4 + R5)

Generazione **procedurale deterministica** da un seed:

- **Continenti**: tre scale di fBm su sfera (3D noise → niente distorsione ai poli) con
  pesi `0.35 / 0.65 / 0.2`, scale `0.6 / 1.9 / 4.5` (`CONTINENT_TUNING` in `planet.js`),
  warp del dominio `0.17` e soglia mare/terra `0.08`. Calibrati con `tools/continents.mjs`
  (variabile `VARIANTS` per provare combinazioni): ~41% di terre emerse in 13 masse
  (la maggiore ~37%, poi 17%, 16%, 5%…), né un supercontinente né un arcipelago. Con un
  warp più forte (0.3) le coste diventavano "pennellate" stirate.
- **Catene montuose**: *ridged multifractal* mascherato da un campo di "orogenesi".
- **Oceani**: quota 0 = livello del mare, profondità fino a ~-8000 m.
- **Laghi**: bacini chiusi portati sotto il livello del mare → si riempiono.
- **Fiumi**: canali incisi lungo isolinee di un campo di rumore *warpato*.
- **Clima**: temperatura da latitudine + quota (gradiente -6.5 °C/km) + rumore;
  umidità da fasce latitudinali (ITCZ umida, alte subtropicali secche, westerlies umide)
  + distanza dal mare.
- **Biomi**: diagramma di Whittaker (temperatura × umidità) → tundra, taiga, foreste
  temperate, praterie, savana, deserto, foresta pluviale, ghiacciai d'alta quota, più biomi
  "rari" guidati da un rumore di varietà regionale: paludi (con pozze), calanchi rossi,
  saline, praterie alpine. Il colore varia con continuità dentro ogni bioma (più verde dove
  è umido, più bruno dove è secco, più spento dove è freddo).
  Il deserto del Sahara deve emergere naturalmente dalla fascia secca subtropicale.
- **Due calotte polari**: a nord terre ghiacciate, a sud un continente polare (tipo
  Antartide) aggiunto al campo di continentalità oltre i ~64-80°. In entrambi i poli il
  mare gelato diventa **banchisa** (lastra di ghiaccio piatta, bioma `ICE`).

### 3.4 Persistenza (R7 + R8)

- Salvataggio su **`localStorage`** (dati piccoli: seed, parametri, camera).
- Il tasto "Salva" è **poco visibile**: piccolo, opacità bassa, si evidenzia solo in hover.
- Al boot l'applicazione legge il salvataggio e ricostruisce **lo stesso identico pianeta**
  (seed deterministico) e ripristina la camera.
- Autosalvataggio leggero della camera (posizione di navigazione) su `beforeunload`.

---

## 4. Stack tecnico

| Ambito | Scelta | Motivo |
|--------|--------|--------|
| Build | **Vite** | dev server veloce, zero config, output statico |
| 3D | **three.js** | standard de-facto, controllo pieno su shader e geometrie |
| Linguaggio | **JavaScript ES modules** | nessun passo di compilazione aggiuntivo |
| Geometria | procedurale, **cubo-sfera quadtree** | LOD corretto su tutta la sfera |
| Noise | **simplex 3D + fBm propri** | deterministico dal seed, nessuna dipendenza |
| Persistenza | `localStorage` | sufficiente, sincrono, nessun server |

Nessun backend. L'applicazione è **statica** e può essere pubblicata su GitHub Pages.

---

## 5. Struttura del progetto

```
/
├── CONTEXT.md                 questo file
├── README.md                  descrizione + istruzioni
├── index.html
├── vite.config.js
├── src/
│   ├── main.js                bootstrap, loop di render
│   ├── core/
│   │   ├── noise.js           PRNG + simplex 3D + fBm + ridged
│   │   └── math.js            helper (clamp, smoothstep, lerp, coordinate sferiche)
│   ├── planet/
│   │   ├── planet.js          campionamento quota/clima/bioma (deterministico)
│   │   ├── biomes.js          palette e classificazione dei biomi
│   │   └── constants.js       costanti fisiche e geografiche
│   ├── render/
│   │   ├── terrainLOD.js      quadtree cubo-sfera
│   │   ├── tileData.js        dati di una tile (puro, griglia estesa + skirt)
│   │   ├── tileBuilder.js     mesh three.js dai dati di tileData
│   │   ├── tileWorker.js      Web Worker che calcola le tile
│   │   ├── tilePool.js        pool di worker con priorità
│   │   ├── relief.js          esagerazione del rilievo
│   │   ├── materials.js       shader toon del terreno/acqua
│   │   ├── atmosphere.js      alone atmosferico
│   │   └── sky.js             sfondo + stelle
│   ├── camera/
│   │   └── globeControls.js   navigazione stile Google Earth
│   ├── state/
│   │   └── saveSystem.js      serializzazione/ripristino stato
│   └── ui/
│       ├── hud.js             HUD + tasto "Salva"
│       └── styles.css
└── tools/
    ├── continents.mjs         taratura terre emerse / masse continentali (node)
    ├── planet-stats.mjs       validazione statistica dei biomi (node)
    └── shot-server.mjs        cattura frame dal browser in sviluppo
```

---

## 6. Convenzioni di codice

- Moduli ES, `export` nominati.
- Nessun uso di classi per la matematica pura; classi solo per oggetti con stato (renderer, controlli).
- Niente allocazioni per-vertice nei loop caldi: usare oggetti scratch riutilizzati.
- `SEA_LEVEL = 0`, quote in **metri**, raggi in **metri** dentro il livello `planet/`.
  La scena 3D usa `SCENE_SCALE` per portare i metri in unità di scena.
- Il campionamento del pianeta **deve essere identico** per ogni consumatore:
  una sola funzione `Planet.sample()` come sorgente di verità.
- Il colore **non dipende dal LOD**: geometria e colore devono restare continui tra livelli,
  altrimenti il confine tra tile si vede come un blocco. Sulle maglie grosse il colore viene
  filtrato per area (4 sotto-campioni), non alterato con soglie legate allo spacing.

---

## 7. Roadmap

- **Fase 1 (attuale)** — modello del pianeta: continenti, oceani, laghi, fiumi, rilievi,
  biomi, clima, navigazione, salvataggio.
- **Fase 2** — vegetazione procedurale a scala regionale (cluster di alberi, arbusti, cactus).
- **Fase 3** — fauna: popolamenti per bioma, comportamenti semplici.
- **Fase 4** — simulazione: temperatura, stagioni, catene trofiche.

---

## 8. Regole operative per l'agente

1. Dopo **ogni prompt** dell'utente: `git add -A && git commit && git push`.
2. Prima di esaurire il contesto/token: fermarsi, committare e pushare.
3. Mantenere l'applicazione **sempre eseguibile** (`npm run dev` senza errori).
4. Non introdurre dipendenze pesanti senza motivo.
5. Aggiornare questo file quando cambiano i requisiti.

---

## 9. Stato attuale e limiti noti

Misure fatte sul seed `20261116` (laptop medio, Chrome):

| Voce | Valore |
|------|--------|
| Terre emerse | ~41% (+ banchisa polare) |
| Quota massima | ~7300 m |
| Masse continentali | 13 (37%, 17%, 16%, 5% della terraferma, poi minori) |
| Laghi | ~1.3% della superficie |
| Fiumi | ~1.0% della superficie |
| Primo caricamento | ~0.9 s (6 worker) |
| Tile visibili a 900 km | ~410 (max livello 7) |
| Tile visibili a 6 km | ~1380 (max livello 14) |
| Costo `lod.update()` | 0.6 - 1.2 ms per frame |
| Costruzione tile | ~2.3 ms (L7) - ~4.5 ms (L12) |
| Riempimento a freddo | spazio (16 000 km): ~0.5 s · 900 km: ~0.4 s · 6 km: ~2.7 s |

Limiti noti / prossimi passi tecnici:

- **Generazione in Web Worker** (`tilePool.js`): fino a 6 worker, 2 richieste in volo
  per worker, scelte ogni frame in ordine di priorità (livelli grossi, poi vicini). Gli
  array tornano come `ArrayBuffer` trasferibili. Un risultato viene scartato se il nodo
  è stato scaricato o richiesto di nuovo (`requestId`). Senza worker si torna alla
  generazione nel thread principale con budget per frame. Le tabelle di costo qui sopra
  per tile e riempimento sono quelle pre-worker.
- **Nitidezza**: maglie fitte anche sui livelli grossi (24-36 vertici per lato), split a
  96 px, foschia leggera solo verso l'orizzonte, correzione di contrasto e saturazione a
  fine shader, risoluzione adattiva mai sotto 0.85.
- **Alberi dipinti sul terreno**: da 25-100 m le chiome sono dischi piatti. In fase 2 vanno
  affiancate da alberi 3D istanziati vicino alla camera, posizionati con lo stesso hash
  di `canopy()` (stessi punti) e la stessa esagerazione del rilievo.
- **Costo GPU da vicino**: su GPU integrata ~25-50 ms/frame a 1280×960 prima della
  risoluzione adattiva. Il log depth buffer scrive `gl_FragDepth` e disattiva l'early-z:
  l'overdraw costa. Possibile rimedio: reversed-Z invece del log depth.
- **Il tasto "salva" salva solo seed + camera**: quando arriveranno piante e animali andrà
  versionato lo stato dell'ecosistema (lo schema è già versionato).
