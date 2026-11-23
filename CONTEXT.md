# CONTEXT — The creation of ELYRA

> Documento di contesto del progetto. Va letto prima di qualsiasi modifica al codice.
> Ogni decisione tecnica deve restare coerente con quanto scritto qui.

---

## 1. Obiettivo del progetto

**The creation of ELYRA** è la creazione da zero di un **mondo fantasy-medievale vivo**,
come **applicazione web** esplorabile.

Il mondo si costruisce **per strati, in quest'ordine**:

1. **il pianeta**: continenti, mari, laghi, fiumi, rilievi, clima, biomi e i regni che si
   spartiscono la terraferma (stato attuale);
2. **le creature**: flora e fauna che popolano i biomi;
3. **i villaggi**: insediamenti medievali con i loro abitanti.

Lo scopo finale è che **ogni elemento abbia un proprio comportamento nella vita** del mondo:
le creature si muovono, si nutrono, si riproducono; i villaggi nascono, crescono, commerciano
e reagiscono all'ambiente (clima, risorse, confini). Ogni strato nuovo poggia sui dati di
quello sotto: biomi e clima del pianeta → dove vivono le creature → dove sorgono i villaggi.

L'utente esplora il mondo con una vista globo in **stile Google Earth**, dallo spazio fino a
pochi metri dal suolo, dove vedrà creature e villaggi vivere nel loro ambiente.

Il pianeta resta **ragionevolmente credibile** (conformazione territoriale, mari e continenti,
laghi, fiumi, fasce climatiche e temperature), ma il tono è quello di un **mondo
fantasy-medievale**: nomi, regni e insediamenti devono suonare come su una carta antica.

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
| R10 | Terraferma divisa in **nazioni** con nomi inventati (medievali), nomi visibili avvicinandosi e confini **ben visibili** (inchiostro scuro tratteggiato su alone chiaro), regni **fitti** | **fatto** (79 regni) |
| R11 | Texture **realistiche da vicino** (erba, acqua che scorre, sabbia, neve) e **transizioni morbide** tra biomi | **fatto** |
| R12 | Navigazione: mouse = ruota, **Ctrl + mouse = traslazione rigida** (anche rotella premuta) | **fatto** |
| R13 | Interfaccia (HUD, caricamento, messaggi) **in inglese** | **fatto** |
| R14 | Scopo: mondo **fantasy-medievale** creato da zero (prima il pianeta, poi le creature, poi i villaggi) con **comportamenti propri** per ogni elemento | pianeta **fatto**; creature e villaggi da fare |
| R15 | Nomi dei regni **di sapore medievale** (originali), con un rango (Impero, Regno, Ducato, Marca, Contea…) | **fatto** |
| R16 | **Niente notte, per ora**: tutto il pianeta inquadrato è illuminato | **fatto** (sole che segue la camera) |
| R17 | Acqua (mari, fiumi, laghi) con **animazioni semplici di movimento** visibili zoomando, **già da lontano** | **fatto** (da ~3000 km di quota) |
| R18 | Risoluzione **molto più alta**, soprattutto durante lo zoom, **senza perdere fluidità** | **fatto** (mai sotto la risoluzione nativa, frame 30-40% più leggero) |
| R20 | **Pochi vulcani grandi** (anche isolati o su un'isola) e **piccoli arcipelaghi** di isole | **fatto** (vedi §3.3) |
| R19 | L'app si apre anche con **doppio clic su index.html** (senza server) | **fatto** (build IIFE in dist/, vedi §4) |

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
- LOD: una tile si suddivide quando supera `SPLIT_PIXELS = 124` pixel a schermo (corretti
  per lo scorcio: una tile vista di taglio verso l'orizzonte conta fino al 40%); livello
  massimo 17 (tile di ~76 m, maglie di ~1.7 m). Budget di generazione per frame (`buildBudgetMs`), priorità alle tile vicine.
- Risoluzione per tile (`tileResForLevel`): 40 maglie per lato ai livelli 0-1, poi 48
  (sempre pari, serve al morph), ~2.6 pixel per maglia a schermo. **Non tornare a 64**:
  si disegnavano ~3 triangoli per pixel (fino a 4.6 milioni) e su GPU integrate i soli
  vertici costavano 10-20 ms a frame; il dettaglio sotto la maglia lo disegna lo shader.
  Poche tile grandi invece di tante piccole: le draw call si dimezzano a parità di densità.
- **Culling dell'orizzonte** (`_belowHorizon`): oltre al frustum, una tile viene scartata se è
  tutta nascosta dalla curvatura del pianeta (test a coni con una sfera piena 12 km sotto il
  livello del mare e la cima della tile alla quota esagerata). Vicino al suolo toglie il
  25-30% dei triangoli.
- **Priorità**: le tile mancanti sono servite in ordine di dimensione a schermo del padre
  (prima ciò che si vede più grande, cioè vicino alla camera), non un livello alla volta.
- **Precaricamento**: oltre il 62% della soglia i figli vengono già chiesti ai worker, se
  resta capacità.
- **Morph**: ogni vertice porta la differenza tra la quota del padre in quel punto e la
  propria (`aMorph`); una tile appena comparsa parte dalla forma del padre e si raffina in
  450 ms (`uMorph` per mesh, caricato in `onBeforeRender` solo quando cambia). Niente
  scatti durante lo zoom.
- Nella scena ci sono solo le mesh disegnate nel frame (aggiunte/rimosse dal gruppo),
  non migliaia di mesh nascoste.
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
  verticale di `aHeight * (k - 1)`. `k` dipende dalla quota della camera: 1.7 vicino al
  suolo, 6.5 dallo spazio (pieno già da ~1500 km), così catene e vulcani sporgono anche sul
  bordo del disco. Cambia ogni frame senza ricostruire nulla.
- **Lettura della quota a ogni zoom** (oltre all'esagerazione):
  - *tinta per quota*: pianure e coste (sotto ~380 m) con colore pieno, un po' più scuro e
    saturo; alture via via più chiare e meno sature verso un grigio-bruno caldo (da ~300 m,
    più deciso oltre ~1800 m). Si legge anche dove la luce è piatta;
  - *luce per quota*: fondovalle a 0.87, cime a 1.08;
  - *prospettiva aerea*: viste da lontano (30-900 km), pianure e fondovalle sotto ~1400 m
    restano dietro un velo d'aria del 12%, le cime ne escono nitide;
  - *mare*: scala di profondità a cinque colori (lagune turchesi → piattaforma → scarpata
    blu → abisso blu notte → fosse quasi nere) e **rilievo del fondale visto attraverso
    l'acqua**, ombreggiato con una luce fissa da nord-ovest come nelle carte batimetriche
    (gradiente a schermo di `vHeight`, `gSea`), solo oltre ~60 m di profondità.
- Le normali di illuminazione usano un'esagerazione ancora maggiore (`shadingExaggeration`),
  ricavata dalla normale a k=1: `N = normalize(R - (R - N1/dot(N1,R)) * kS)`.
- Luce: sole + "sole radente" con lo stesso azimut, così i pendii si leggono anche
  a mezzogiorno. Ombre fredde (bluastre), luce calda.
- **Niente notte, per ora** (R16): il sole **segue la camera** (`updateSun()` in `main.js`):
  da nord-ovest, ~55° sopra l'orizzonte locale del punto sotto la camera, la luce classica
  delle carte in rilievo. Nel terreno `day = 1.0`, nell'atmosfera alone uniforme senza
  tramonto. `SUN_DIRECTION` resta il sole fisso per quando tornerà il ciclo giorno/notte
  (i commenti nello shader dicono cosa ripristinare). Il bagliore largo del sole sull'acqua
  è ridotto al minimo: con questo sole cadrebbe sempre al centro dell'inquadratura.
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
- **Ottave fini** (da ~2 m a ~6 cm, `lrnoise`) su un reticolo **ruotato**: allineato agli
  assi, da vicino dava un aspetto a blocchi. L'offset dell'origine ruotata per ciascuna
  frequenza (`uRotOff[k]`) è calcolato ogni frame in doppia precisione
  (`updateNoiseFrame`). Per f ≥ 1 l'offset del reticolo normale è nullo (uOrigin è multiplo
  di 64): così i prodotti oltre 2^24 non perdono gli interi.
- **Dettaglio realistico da vicino**: micro-rilievo (`hb`) che perturba la normale con il
  gradiente a schermo (`tangentGrad`, chiamata fuori dai rami): zolle, ciuffi e fili d'erba
  con chiazze secche/verdi e fiori; increspature del vento sulla sabbia (onde parallele a
  una direzione fissa `RIPPLE_DIR`, fase all'origine calcolata in doppia precisione) e
  granuli; neve con solchi del vento e brillii che cambiano con la vista; roccia con licheni
  e grana. Ogni dettaglio ha un peso tarato sulla sua lunghezza d'onda (niente moiré).
- **Acqua**: mare e laghi con tre treni d'onda animati (normale perturbata, scintille del
  sole solo dove le onde sono risolte, schiuma sulla battigia che va e viene). Fiumi con la
  tecnica della *flow map*: direzione lungo il letto (perpendicolare al gradiente di
  `vWater`), verso in discesa, due fasi sfalsate che si ripartono a vicenda.
- **Movimento dell'acqua a ogni quota** (R17, stile illustrato): le onde vere da 100 km
  sembrano ferme, quindi ogni scala si muove a **~0.12-0.2 lunghezze d'onda al secondo**
  (a velocità reali, o anche a 90 m/s, le onde da 2 km viste da 200 km facevano mezzo pixel
  al secondo). Tre treni di **creste d'onda** (`waveCrest`) di 48 km, 4 km e 400 m: fronti
  paralleli alla direzione del vento (`WAVES` in `materials.js`), appena ondulati e spezzati
  in tratti, che si passano il testimone con lo zoom. Il treno da 48 km si vede **già da
  ~3000 km** di quota. In più chiazze d'onda lunga che scorrono e correnti dei fiumi (flow
  map a ~500 m da ~120 km, a ~250 m da vicino). Laghi e fiumi più calmi del mare (`calm`).
  La **trama della superficie** (normale perturbata, scintillio del sole) usa anche due treni
  di onde lunghe (~250 m e ~60 m, `hwFar`), animati e trasportati dalla corrente nei fiumi:
  si vede da ~25 km di quota invece che solo dalle ultime centinaia di metri.
  Tre regole imparate a fatica:
  - l'ondulazione dei fronti deve usare un rumore **più largo** della lunghezza d'onda e
    un'ampiezza **sotto mezzo ciclo**, altrimenti i fronti si ripiegano in scarabocchi (le
    isolinee di un rumore, provate prima, disegnavano anelli e "vermicelli");
  - la fase all'origine del reticolo (`uWavePhase`) è calcolata sulla CPU in doppia
    precisione (`updateNoiseFrame`), come per le increspature della sabbia;
  - su una sfera i fronti paralleli a una direzione fissa diventano **cerchi concentrici**
    attorno ai due punti dove quella direzione è verticale: lì lo shader sfuma su una
    direzione alternativa perpendicolare (`uWaveDir[i + 3]`).
- **Transizioni tra biomi**: colore e pesi `aSurf` sono la media della classificazione con
  il clima spostato (±2.5 °C, ±0.05 umidità, ±0.14 varietà, `SOFT_OFFSETS` in
  `planet.js`), e le soglie dello shader sono più larghe. Niente alberi su neve e roccia.
- **Confini delle nazioni**: per pixel, distanza dal bisettore tra i due capoluoghi più
  vicini nello spazio deformato da `nationWarp` (GLSL generato dalle stesse costanti JS).
  Sono una **linea d'inchiostro scura** (`vec3(0.20, 0.17, 0.15)`) larga ~1.7 px su un
  **alone chiaro continuo** di ~3 px (`bw = min(foot, 25)`): si legge sia sul bosco scuro sia
  sulla sabbia chiara. La vecchia linea grigia di 1 px non si vedeva. Il tratto scuro è
  tratteggiato (pieno ~0.66 del periodo, i vuoti restano al 35%), a lunghezza costante sullo
  schermo. Solo sulla terraferma; opacità `uBorderAlpha = 0.95 → 0.60` fra 1500 e 9000 km:
  i confini restano leggibili anche dallo spazio.
  **Candidate per tile**: il ciclo su tutti i capoluoghi costava fino a 8 ms a frame. Ora ogni
  tile (livello ≥ 1) porta le nazioni che possono comparirvi (`Nations.candidatesForTile`:
  griglia 9×9, margine conservativo che include l'alone, max 24) e lo shader confronta solo
  quelle (`uNatCand`, caricate in `onBeforeRender` come `uMorph`). Una sola candidata =
  nessun confine nella tile; troppe = ciclo completo (con 79 regni non capita più dal
  livello 3 in giù: al massimo 16 candidate).
- **Risoluzione adattiva** in `main.js`: **mai sotto la risoluzione nativa del display**
  (`MIN_PIXEL_RATIO = devicePixelRatio`; prima era 1, e su uno schermo al 125% durante lo
  zoom scendeva all'80% della nativa: immagine sgranata), fino a 2× se la
  GPU ha margine. La decisione è presa **prima** del render (ridimensionare il drawing buffer
  dopo aver disegnato mostrava un frame di solo sfondo, cioè un lampo nero), con isteresi
  (scende se la media mobile supera 1/27 s per 2 finestre, sale sotto 1/56 s per 3 finestre),
  attesa di 3 s fra un cambio e l'altro e salita solo da fermi (`controls.idleSeconds > 0.6`):
  altrimenti la risoluzione "pompava" a ogni zoom.

### 3.5 Cuciture tra tile (importante)

Tre accorgimenti, tutti necessari, altrimenti compaiono righe scure sui confini:

1. **Normali da griglia estesa**: `buildTileMesh` campiona una griglia più larga di una
   cella per lato e calcola le normali con differenze centrali usando le coordinate
   *globali* (`(ix + (i-1)/res)/div`). Due tile adiacenti ottengono così normali
   identiche bit per bit; con differenze unilaterali il toon shading creava una riga scura.
2. **Nessuna inversione di normale sulle facce posteriori**: le skirt, viste di taglio dal
   lato interno attraversando una crepa, venivano illuminate al contrario. Il fragment
   shader usa `N` così com'è.
3. **Skirt proporzionate** (maglia × 0.6 + quota massima della tile × 0.45, max 60 unità,
   scalate con l'esagerazione nello shader): gonne troppo profonde bucano il terreno delle
   tile vicine. **Verso dei triangoli**: la faccia esterna deve guardare fuori dalla tile; i
   bordi nord e ovest vanno percorsi al contrario rispetto a sud ed est. Con il verso sbagliato
   il backface culling scartava metà delle gonne e nelle giunzioni tra livelli restavano
   **crepe nere** (verificato da `tools/check-skirt.mjs`).

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
**Il terreno** calcola la profondità logaritmica **nel vertex shader** (stessa formula del
chunk di three.js, `logDepthBufFC` dichiarato a mano) e non scrive `gl_FragDepth`: così
l'early-z scarta il terreno coperto prima dello shader (rendering da ~106 a ~24 ms in una
vista radente a 2 km). Le maglie vicino alla camera sono piccole, quindi l'interpolazione
lineare della profondità è accurata.
Gli altri `ShaderMaterial` custom (atmosfera) devono includere i chunk
`<logdepthbuf_pars_vertex/fragment>` e `<logdepthbuf_vertex/fragment>`: senza, scrivono una
profondità "normale" non confrontabile con quella dei materiali built-in e le stelle
comparivano come puntini bianchi **sopra** il pianeta.

### 3.3 Fedeltà geografica (R4 + R5)

Generazione **procedurale deterministica** da un seed:

- **Vulcani** (R20, `pickVolcanoes` in `planet.js`): **pochi e grandi**, non più "province
  vulcaniche" piene di coni piccoli. Una lista fissa scelta dal seed: **7 sulla terraferma e
  5 isole vulcaniche in mare aperto** (fondale sotto i 1500 m), a distanza minima di ~2200 km
  l'uno dall'altro, entro ~60° di latitudine. Coni di **40-95 km** di raggio, 3.2-6 km sopra
  il terreno (isole: 2.6-5 km sul livello del mare, profilo più pieno così la parte emersa è
  larga). Fianchi concavi, **costole e canaloni radiali** (un cono liscio, con la luce alle
  spalle della camera, sembrava un disco piatto), cratere all'8% del raggio. Hanno un
  **lago di lava** solo i vulcani la cui cima resta sotto la linea delle nevi (gli altri sono
  giganti innevati dormienti): con il seed di default 2 attivi, un'isola e uno sulla
  terraferma. Basalto scuro (`BIOME.VOLCANIC`) solo sul cono alto; i fianchi bassi restano
  del paesaggio attorno. Centri e distanze sulla direzione **non deformata**, così i coni
  restano rotondi. Costo: 12 confronti per campione.
- **Arcipelaghi** (`planet/features.js`): elementi puntuali trovati con una griglia 3D di
  celle (hash intero per cella, centro spostato e proiettato sulla sfera, finestra 2×2×2: il
  raggio deve restare ≤ 1/4 della cella), sulla direzione non deformata.
  - **Arcipelaghi**: solo in mare, in fasce dedicate; isole di 6-16 km (celle di ~130 km) e
    isolotti di 2-4 km (celle di ~38 km), ciascuno con una piattaforma di acqua bassa di
    due raggi. Le isole ricevono colline proprie (la terraferma le ha dai passi 5 e 5b).
  - Costo di `Planet.sample()`: da 2.75 a 3.24 µs (+18%).

- **Continenti**: tre scale di fBm su sfera (3D noise → niente distorsione ai poli) con
  pesi `0.35 / 0.65 / 0.2`, scale `0.6 / 1.9 / 4.5` (`CONTINENT_TUNING` in `planet.js`),
  warp del dominio `0.17` e soglia mare/terra `0.08`. Calibrati con `tools/continents.mjs`
  (variabile `VARIANTS` per provare combinazioni): ~41% di terre emerse in 13 masse
  (la maggiore ~37%, poi 17%, 16%, 5%…), né un supercontinente né un arcipelago. Con un
  warp più forte (0.3) le coste diventavano "pennellate" stirate.
- **Catene montuose**: *ridged multifractal* mascherato da un campo di "orogenesi" esteso
  (anche vicino alle coste), più un secondo sistema di sierre minori (ridged a scala ~700
  km), creste secondarie deformate e valli. Linea delle nevi `4500 - 30·|lat|` m
  (`SNOW_LINE_BASE/LAT` in `biomes.js`, ripetuta nello shader).
- **Oceani**: quota 0 = livello del mare, profondità fino a ~-6700 m. Il fondale ha un
  rilievo proprio lontano dalle coste: **dorsali oceaniche** (ridged, creste che salgono di
  ~2 km), **fosse** strette e profonde ~2.6 km ai piedi delle scarpate continentali (solo dove
  lo decide un rumore a grande scala) e colline abissali. Non emerge mai (resta sotto -60 m).
- **Laghi**: bacini chiusi portati sotto il livello del mare → si riempiono.
- **Fiumi**: canali incisi lungo isolinee di due campi di rumore (fiumi maggiori con letto
  di ~3.2 km e affluenti più fitti di ~2 km); in montagna scavano valli più profonde.
- **Clima**: temperatura da latitudine + quota (gradiente -6.5 °C/km) + rumore;
  umidità da fasce latitudinali (ITCZ umida, alte subtropicali secche, westerlies umide)
  + distanza dal mare.
- **Biomi**: diagramma di Whittaker (temperatura × umidità) → tundra, taiga, foreste
  temperate, praterie, savana, deserto, foresta pluviale, ghiacciai d'alta quota, più biomi
  "rari" guidati da un rumore di varietà regionale: paludi (con pozze), calanchi rossi,
  saline, praterie alpine. Il colore varia con continuità dentro ogni bioma (più verde dove
  è umido, più bruno dove è secco, più spento dove è freddo).
  Il deserto del Sahara deve emergere naturalmente dalla fascia secca subtropicale.
- **Nazioni** (`planet/nations.js`): 31 stati, regioni di Voronoi sferiche di capoluoghi
  scelti sulla terraferma a distanza minima di ~3200 km (in media ~6.8 milioni di km²),
  con coordinate deformate da sinusoidi 3D per confini sinuosi. Nomi **inventati di sapore
  fantasy** (Aethermoor, Ashenvale, Starfall, Umbrafen, Farrowmere…), mescolati in modo
  deterministico dal seed.
- **Etichette delle nazioni** (`ui/labels.js`, HTML):
  - ogni nazione ha un **centro visivo** (`Nations.center`): il campione di terraferma più
    interno, cioè quello che massimizza `min(distanza dal confine, 450 km × quota di terra
    propria in un disco di 450 km)`. Il baricentro poteva cadere in mare o oltre un confine;
    il centro visivo dista almeno ~200 km da ogni confine;
  - se il centro visivo è ben inquadrato (entro il 78% dello schermo) il nome sta lì, al
    centro della regione; altrimenti va al **centro della parte visibile** della nazione
    (media dei raggi della griglia che la colpiscono, riportata sulla sua terra se cade
    fuori). Così zoomando il nome resta nell'inquadratura e segue lo zoom, e **su un confine
    si vedono entrambi i nomi**, ciascuno dal proprio lato;
  - il nome è appoggiato a un punto del terreno (posizione = proiezione esatta, ogni frame);
    quando il bersaglio cambia il punto scivola sulla sfera (`GLIDE = 2.6/s`); se il punto
    è fuori schermo (salto della camera) salta subito al bersaglio, mai trascinato lungo il
    bordo;
  - compaiono sotto i ~7000 km di quota e **scompaiono sotto ~40 km** (sfumano tra 70 e 25
    km), dove la nazione riempie lo schermo; se due nomi si sovrappongono resta quello con
    più terra inquadrata. Griglia di 16×12 raggi spalmata su 3 frame; costo ~0.4 ms/frame.
    L'HUD mostra la nazione sotto la camera ("international waters" solo sul mare).
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

**Apertura con doppio clic** (R19): `npm run build` produce in `dist/` un unico script
classico IIFE con il worker delle tile incorporato (`tileWorker.js?worker&inline`, avviato da
un Blob): da `file://` il browser blocca gli script `type="module"`, le richieste
`crossorigin` e i worker da file separati. Il plugin `file-protocol-html` in `vite.config.js`
riscrive lo script come `defer`. L'`index.html` di sorgente, aperto da file, reindirizza a
`dist/index.html` (script `data-source-only`, tolto dalla build). Il doppio clic mostra
l'ultima build: dopo ogni modifica va rilanciato `npm run build`.

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
│   │   ├── nations.js         nazioni: capoluoghi, confini, nomi
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
│       ├── labels.js          nomi delle nazioni in sovrimpressione
│       └── styles.css
└── tools/
    ├── continents.mjs         taratura terre emerse / masse continentali (node)
    ├── planet-stats.mjs       validazione statistica dei biomi (node)
    ├── check-skirt.mjs        controllo del verso delle facce delle gonne (node)
    └── shot-server.mjs        cattura frame dal browser in sviluppo
```

---

## 6. Convenzioni di codice

- Moduli ES, `export` nominati.
- **Lingua dell'interfaccia: inglese** (HUD, etichette di caricamento, messaggi, nomi dei
  biomi e delle nazioni). I commenti del codice restano in italiano.
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

L'ordine segue lo scopo del progetto (§1): **pianeta → creature → villaggi**, poi la vita.

- **Fase 1 (attuale): il pianeta**. Continenti, oceani, laghi, fiumi, rilievi, biomi, clima,
  regni medievali con confini, acqua animata, navigazione, salvataggio.
- **Fase 2: le creature**. Flora (boschi, arbusti, campi) e fauna istanziate per bioma,
  ciascuna con un comportamento proprio: muoversi, nutrirsi, riprodursi, fuggire, migrare.
- **Fase 3: i villaggi**. Insediamenti medievali dove l'ambiente lo permette (acqua dolce,
  terra fertile, legname, pietra), legati al regno in cui sorgono, con abitanti che lavorano,
  commerciano e crescono di numero.
- **Fase 4: il mondo vive**. Simulazione nel tempo: stagioni, catene alimentari, villaggi
  che crescono o si spopolano, rapporti tra regni. Il ciclo giorno/notte torna qui.

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
| Quota massima | ~8400 m |
| Masse continentali | 13 (37%, 17%, 16%, 5% della terraferma, poi minori) |
| Laghi | ~0.7% della superficie |
| Fiumi | ~1.7% della superficie |
| Neve perenne + roccia d'alta quota | ~0.8% (prima 0.1%) |
| Primo caricamento | ~0.9 s (6 worker) |
| Tile visibili a 900 km | ~410 (max livello 7) |
| Tile visibili a 6 km | ~1380 (max livello 14) |
| Costo `lod.update()` | 0.6 - 1.2 ms per frame |
| Costruzione tile | ~2.3 ms (L7) - ~4.5 ms (L12) |
| Riempimento a freddo | spazio (16 000 km): ~0.5 s · 900 km: ~0.4 s · 6 km: ~2.7 s |

Limiti noti / prossimi passi tecnici:

- **Generazione in Web Worker** (`tilePool.js`): fino a 6 worker, 3 richieste in volo
  per worker (contando anche i risultati non ancora trasformati in mesh, altrimenti la coda
  cresce senza limite), scelte ogni frame in ordine di priorità. Le mesh vengono create con
  un budget di 4 ms per frame. Gli
  array tornano come `ArrayBuffer` trasferibili. Un risultato viene scartato se il nodo
  è stato scaricato o richiesto di nuovo (`requestId`). Senza worker si torna alla
  generazione nel thread principale con budget per frame. Le tabelle di costo qui sopra
  per tile e riempimento sono quelle pre-worker.
- **Nitidezza**: maglie fitte anche sui livelli grossi, foschia leggera solo verso
  l'orizzonte, correzione di contrasto e saturazione a fine shader. Risoluzione di rendering
  mai sotto quella nativa del display (devicePixelRatio); se la GPU ha margine sale fino a 2×.
- **Zoom fluido**: la quota è smorzata in scala logaritmica (velocità percepita costante da
  15 000 km a pochi metri). I voli durano in proporzione al salto di scala e alla distanza
  (fino a 5.5 s), con smootherstep; lo spostamento orizzontale avviene in quota e la
  discesa finale è verticale.
- **Volo dallo spazio a 2 km** (GPU integrata AMD, finestra ~800×700): ~50-55 fps durante il
  volo (mediana 12.8 ms a 2300 km, 18.2 ms a 350 km, 21.8 ms a 35 km a 1.8× di risoluzione),
  livello 14 sotto la camera all'atterraggio. Restano picchi isolati di 25-40 ms in
  corrispondenza dei cambi di livello LOD (caricamento dei buffer sulla GPU): sono mitigati
  creando al massimo **8 mesh nuove per frame**. I vecchi picchi di 100-300 ms erano in parte
  un primo frame di assestamento della scena, non un problema di shader.
- **Costi del frame** (GPU integrata AMD, 1920×1080 fisici con display al 125%, misure da
  Edge headless con GPU reale, tempo di render sincrono): prima delle ottimizzazioni
  32 / 33 / 44 / 46 ms a 3000 km / 200 km / 8 km / 0.5 km; ora circa 22 / 19 / 26 / 33 ms
  (maglie 48 invece di 64, confini con nazioni candidate per tile, culling dell'orizzonte).
  Il costo rimasto è soprattutto lo shader per pixel; la CPU pesa ~1.5 ms. Con onde a ogni
  quota, vulcani e 79 regni: circa 28 / 21 / 29 / 36 ms (da lontano l'acqua costa ~4 ms in più).
- **Alberi dipinti sul terreno**: da 25-100 m le chiome sono dischi piatti. In fase 2 vanno
  affiancate da alberi 3D istanziati vicino alla camera, posizionati con lo stesso hash
  di `canopy()` (stessi punti) e la stessa esagerazione del rilievo.
- **Il tasto "salva" salva solo seed + camera**: quando arriveranno piante e animali andrà
  versionato lo stato dell'ecosistema (lo schema è già versionato).
