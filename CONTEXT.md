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
| R2 | Zoom **multi-scala**: dallo spazio fino a scala regionale (es. Sahara) | **fatto** (LOD 0→15) |
| R3 | A scala regionale si devono poter vedere animali e piante **senza appesantire la grafica** | rimandato (fase 2) |
| R4 | Contenuto **ragionevolmente fedele**: ambienti, temperature, conformazione territoriale | **fatto** per il pianeta |
| R5 | **Per ora**: solo modello del pianeta — continenti, mari, oceani, laghi, fiumi, rilievi. **Niente piante né animali.** | **fatto** |
| R6 | Stile grafico **cartoon**, tipo Animal Crossing ma **meno bambinesco e più maturo** | **fatto** (toon a bande morbide, palette spenta) |
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
  massimo 15. Budget di generazione per frame (`buildBudgetMs`), priorità alle tile vicine.
- Risoluzione per tile (`tileResForLevel`): 10 → 44 vertici per lato secondo il livello,
  scelta per tenere ~2 pixel per maglia a schermo.
- `qualityForLevel()` restituisce sempre `1`: le quote devono essere **identiche a tutti i
  livelli LOD**, altrimenti sulle giunzioni compaiono gradini.
- **Skirt** (gonna) lungo i bordi di ogni tile per chiudere le crepe tra livelli diversi.

### 3.5 Cuciture tra tile (importante)

Tre accorgimenti, tutti necessari, altrimenti compaiono righe scure sui confini:

1. **Normali da griglia estesa**: `buildTileMesh` campiona una griglia più larga di una
   cella per lato e calcola le normali con differenze centrali usando le coordinate
   *globali* (`(ix + (i-1)/res)/div`). Due tile adiacenti ottengono così normali
   identiche bit per bit; con differenze unilaterali il toon shading creava una riga scura.
2. **Nessuna inversione di normale sulle facce posteriori**: le skirt, viste di taglio dal
   lato interno attraversando una crepa, venivano illuminate al contrario. Il fragment
   shader usa `N` così com'è.
3. **Skirt poco profonde** (`min(max(lato*0.06, 0.6), 26)` unità): gonne troppo profonde
   bucano il terreno delle tile vicine.

### 3.6 Leggibilità cartografica dei fiumi

A LOD basso la maglia della mesh è più larga del letto del fiume (~2 km) e l'acqua si
sgretona in puntini. `Planet.sample()` riceve quindi anche `spacingKm` (lato della maglia)
e usa un`mapScale` per **allargare solo il colore** del fiume, mai la sua incisione:
le quote restano identiche a ogni livello, quindi nessuna crepa. Le linee esagerate sono
anche più tenui, come su una carta geografica.

### 3.3 Fedeltà geografica (R4 + R5)

Generazione **procedurale deterministica** da un seed:

- **Continenti**: fBm a bassa frequenza su sfera (3D noise → niente distorsione ai poli).
- **Catene montuose**: *ridged multifractal* mascherato da un campo di "orogenesi".
- **Oceani**: quota 0 = livello del mare, profondità fino a ~-8000 m.
- **Laghi**: bacini chiusi portati sotto il livello del mare → si riempiono.
- **Fiumi**: canali incisi lungo isolinee di un campo di rumore *warpato*.
- **Clima**: temperatura da latitudine + quota (gradiente -6.5 °C/km) + rumore;
  umidità da fasce latitudinali (ITCZ umida, alte subtropicali secche, westerlies umide)
  + distanza dal mare.
- **Biomi**: diagramma di Whittaker (temperatura × umidità) → tundra, taiga, foreste
  temperate, praterie, savana, deserto, foresta pluviale, ghiacciai d'alta quota.
  Il deserto del Sahara deve emergere naturalmente dalla fascia secca subtropicale.
- **Calotte polari** oltre i ~68-72° di latitudine.

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
│   │   ├── tileBuilder.js     costruzione geometria tile (griglia estesa + skirt)
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
- Il colore può dipendere dal LOD (`spacingKm`), la **quota no**: la geometria deve restare
  continua tra livelli, altrimenti si aprono crepe.

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
| Terre emerse | ~39% |
| Quota massima | ~6240 m |
| Laghi | ~1.0% della superficie |
| Fiumi | ~0.3% della superficie |
| Tile visibili a 900 km | ~410 (max livello 7) |
| Tile visibili a 6 km | ~1380 (max livello 14) |
| Costo `lod.update()` | 0.6 - 1.2 ms per frame |
| Costruzione tile | ~2.3 ms (L7) - ~4.5 ms (L12) |
| Riempimento a freddo | 900 km: ~0.4 s di calcolo · 6 km: ~2.7 s |

Limiti noti / prossimi passi tecnici:

- **Generazione sul thread principale**: scendendo velocemente a bassa quota le tile
  arrivano in streaming (budget 6.5 ms/frame). Rimedio previsto: pool di Web Worker con
  `ArrayBuffer` trasferibili.
- **Nessuna texture di dettaglio**: a 6 km il suolo è liscio (solo colore per vertice).
  Rimedio previsto: micro-rilievo nel fragment shader con attenuazione per distanza.
- **Nessun LOD di colore**: il passaggio di bioma è per vertice, quindi i confini tra biomi
  sono a scalini di una maglia.
- **Il tasto "salva" salva solo seed + camera**: quando arriveranno piante e animali andrà
  versionato lo stato dell'ecosistema (lo schema è già versionato).
