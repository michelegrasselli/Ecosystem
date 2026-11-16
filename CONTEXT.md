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
| R1 | Vista della Terra in stile Google Earth, con **lo stesso stile di navigazione** (drag per ruotare, scroll per zoomare, tilt, fly-to) | da implementare |
| R2 | Zoom **multi-scala**: dallo spazio fino a scala regionale (es. Sahara) | da implementare |
| R3 | A scala regionale si devono poter vedere animali e piante **senza appesantire la grafica** | rimandato (fase 2) |
| R4 | Contenuto **ragionevolmente fedele**: ambienti, temperature, conformazione territoriale | da implementare |
| R5 | **Per ora**: solo modello del pianeta — continenti, mari, oceani, laghi, fiumi, rilievi. **Niente piante né animali.** | da implementare |
| R6 | Stile grafico **cartoon**, tipo Animal Crossing ma **meno bambinesco e più maturo** | da implementare |
| R7 | Tasto **poco visibile "Salva"** che salva lo stato del pianeta | da implementare |
| R8 | Lo stato salvato viene **ricaricato automaticamente** al prossimo avvio | da implementare |
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

- Il pianeta ha raggio `R = 6371 km` (Terra), unità di scena 1 = 1 km per comodità nei calcoli,
  poi scalato nella scena 3D.
- Navigazione a **modello camera look-at su punto di superficie**:
  - `lat`, `lon` → punto target
  - `range` → distanza camera↔target
  - `pitch` → angolo di inclinazione (90° = zenitale)
  - `heading` → rotazione
- **Due livelli di rendering del pianeta**:
  1. **FarGlobe**: sfera unica ad alta risoluzione per la vista dallo spazio. Economica.
  2. **TerrainLOD**: quadtree su cubo-sfera (6 facce), attivo solo sotto una certa quota.
     Risoluzione adattiva per livello, skirt per nascondere le crepe, budget di tile per frame.
- Il dettaglio *non* deve crescere all'infinito: tetto massimo di livello LOD e risoluzione
  per tile tarata per restare fluido su un laptop medio.

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
│   │   ├── globe.js           orchestrazione: FarGlobe + TerrainLOD
│   │   ├── farGlobe.js        sfera unica per la vista dallo spazio
│   │   ├── terrainLOD.js      quadtree cubo-sfera
│   │   ├── tileBuilder.js     costruzione geometria tile
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
```

---

## 6. Convenzioni di codice

- Moduli ES, `export` nominati.
- Nessun uso di classi per la matematica pura; classi solo per oggetti con stato (renderer, controlli).
- Niente allocazioni per-vertice nei loop caldi: usare oggetti scratch riutilizzati.
- `SEA_LEVEL = 0`, quote in **metri**, raggi in **metri** dentro il livello `planet/`.
  La scena 3D usa `SCENE_SCALE` per portare i metri in unità di scena.
- Il campionamento del pianeta **deve essere identico** tra FarGlobe e TerrainLOD:
  una sola funzione `Planet.sample()` come sorgente di verità.

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
