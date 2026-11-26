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

### 1.1 Il fine: una serie di video corti sulla creazione di Elyra

L'app è lo **strumento di produzione** di una serie di **video corti** (YouTube Shorts,
TikTok, Reels) che narrano **la creazione di questo mondo fantasy**, un atto alla volta:
prima il pianeta, poi la flora, la fauna, le stagioni, le atmosfere, le popolazioni...
Il tono della narrazione è **fantasy, affascinante, misterioso e trascendente**: chi guarda
assiste alla nascita di un mondo da parte di un creatore, non a una simulazione tecnica né
a un documentario scientifico.

Idee di riferimento (vedi `contesto/`, in particolare `The_creation_of_Elyra.pdf`):

- **Ere della creazione**, ognuna con una serie di episodi: 01 *The Birth of a Planet*
  (pianeta, oceani, continenti, atmosfera) → 02 *The First Life* (piante, foreste, funghi)
  → 03 *The Animal Kingdom* (erbivori, predatori, creature marine e volanti) → 04 *The
  Changing World* (stagioni, tempeste, ere glaciali) → 05 *The Rise of Civilization*
  (popoli, culture, regni).
- **Struttura di uno short** (25-40 s): gancio iniziale ("Oggi ho dato al mio pianeta la
  sua prima foresta"), creazione, evoluzione, ripresa cinematografica del risultato, domanda
  finale al pubblico ("Cosa dovrei creare adesso?").
- **Il pubblico partecipa**: i commenti più votati possono decidere il prossimo atto.
- **Planet Bible**: un'unica fonte di verità sulle caratteristiche del mondo, perché ogni
  episodio mostri sempre **lo stesso** pianeta. Qui lo è già il generatore deterministico
  (stesso seed → stesso mondo) e lo saranno i dati degli strati successivi.

Tre regole che ne derivano e valgono per ogni scelta tecnica e visiva:

1. **Coerenza visiva assoluta**: geografia, identità e atmosfera di Elyra sono riconoscibili in
   ogni episodio. Niente cambiamenti che stravolgano il mondo già mostrato senza un motivo
   narrativo (ogni modifica al generatore cambia il pianeta: va fatta con attenzione).
2. **Progressione reale**: ogni atto lascia il mondo in uno stato nuovo e permanente; gli
   strati (flora, fauna, stagioni, popoli) si aggiungono, non sostituiscono.
3. **Spettacolo da riprendere**: ogni novità deve rendere bene **in un video verticale breve**,
   dallo spazio fino al suolo. In futuro serviranno strumenti di regia: percorsi di camera
   cinematografici, "comparsa" animata degli strati (la foresta che cresce, la prima pioggia),
   inquadratura verticale 9:16, registrazione.

La cartella **`contesto/`** raccoglie nel tempo immagini e documenti di ispirazione forniti
dall'utente: **va guardata a ogni nuova richiesta** e resta sempre nei commit.

---

## 2. Requisiti funzionali (richiesti dall'utente)

| # | Requisito | Stato |
|---|-----------|-------|
| R1 | Vista della Terra in stile Google Earth, con **lo stesso stile di navigazione** (drag per ruotare, scroll per zoomare, tilt, fly-to) | **fatto** |
| R2 | Zoom **multi-scala**: dallo spazio fino a scala regionale (es. Sahara) | **fatto** (LOD 0→17; dalla flora alla scala del pianeta la camera si ferma a 40 km dal suolo) |
| R3 | A scala regionale si devono poter vedere animali e piante **senza appesantire la grafica** | zoom pronto (25 m dal suolo, chiome disegnate nello shader); piante/animali 3D in fase 2 |
| R4 | Contenuto **ragionevolmente fedele**: ambienti, temperature, conformazione territoriale | **fatto** per il pianeta |
| R5 | **Per ora**: solo modello del pianeta — continenti, mari, oceani, laghi, fiumi, rilievi. **Niente piante né animali.** | **fatto** |
| R6 | Stile grafico **cartoon**, tipo Animal Crossing ma **meno bambinesco e più maturo** | **fatto** (illustrato: bande morbide, ombre fredde, chiome tonde, dune, rocce a strati) |
| R7 | Tasto **poco visibile "Salva"** che salva lo stato del pianeta | **fatto** |
| R8 | Lo stato salvato viene **ricaricato automaticamente** al prossimo avvio | **fatto** (verificato) |
| R9 | Repository GitHub con **commit + push dopo ogni prompt** | attivo |
| R10 | Terraferma divisa in **nazioni** con nomi inventati (medievali), nomi visibili avvicinandosi e confini **ben visibili** (inchiostro scuro tratteggiato su alone chiaro), regni **fitti** | **fatto** (76 regni: 71 storici + 5 delle terre nuove) |
| R11 | Texture **realistiche da vicino** (erba, acqua che scorre, sabbia, neve) e **transizioni morbide** tra biomi | **fatto** |
| R12 | Navigazione: mouse = ruota, **Ctrl + mouse = traslazione rigida** (anche rotella premuta) | **fatto** |
| R13 | Interfaccia (HUD, caricamento, messaggi) **in inglese** | **fatto** |
| R14 | Scopo: mondo **fantasy-medievale** creato da zero (prima il pianeta, poi le creature, poi i villaggi) con **comportamenti propri** per ogni elemento | pianeta **fatto**; creature e villaggi da fare |
| R15 | Nomi dei regni **di sapore medievale** (originali), con un rango (Impero, Regno, Ducato, Marca, Contea…) | **fatto** |
| R16 | **Niente notte, per ora**: tutto il pianeta inquadrato è illuminato | **fatto** (sole che segue la camera) |
| R17 | Acqua (mari, fiumi, laghi) con **animazioni semplici di movimento** visibili zoomando, **già da lontano** | **fatto** (da ~3000 km di quota) |
| R18 | Risoluzione **molto più alta**, soprattutto durante lo zoom, **senza perdere fluidità** | **fatto** (mai sotto la risoluzione nativa, frame 30-40% più leggero) |
| R20 | **Vulcani sparsi per il mondo** (grandi e piccoli, anche isolati o su un'isola) con **crateri e lava animata**, **campi di lava**, **terra bruciata** attorno ad alcuni, e **piccoli arcipelaghi** | **fatto** (vedi §3.3) |
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

- **Vulcani** (R20, `pickVolcanoes` in `planet.js`): lista fissa scelta dal seed di **46
  vulcani** (30 sulla terraferma, 16 isole in mare aperto con fondale sotto i 1500 m), a
  distanza minima di ~950 km, entro ~60° di latitudine. Coni di **38-140 km** di raggio,
  3.2-6 km sopra il terreno (isole: 2.6-5 km sul livello del mare). Fianchi concavi con
  costole radiali. **Cratere largo** (15% del raggio) con fondo piatto, pareti ripide e
  **orlo rialzato**. Circa uno su due è **attivo** (21 con il seed di default): lago di lava
  nel cratere e 4 **colate incandescenti** che scendono dai fianchi, sempre più strette.
  Centri e distanze sulla direzione non deformata.
- **Campi di colate** (`BIOME.LAVA_FIELD`): attorno a tutti gli attivi e a due dormienti su
  tre, fino a ~3.3 raggi, a lobi irregolari (rumore lungo l'angolo che cambia con la
  distanza). Recenti quasi nere con rade crepe ancora accese vicino al cono; vecchie
  grigio-brune e in parte ricolonizzate dalla vegetazione. ~0.3% della superficie.
- **Terra bruciata** (`BIOME.SCORCHED`): alone frastagliato fino a ~3.3 raggi attorno a tre
  attivi su quattro e a un dormiente su cinque: suolo carbonizzato e cenere, niente alberi,
  prati, fiori né neve. ~0.2% della superficie.
- **Lava nello shader**: il pianeta esporta `sample.lava` (lava fusa: lago, colate, crepe) e
  `sample.burn` (terra bruciata e colate), che arrivano allo shader come attributo
  `aVolc`. La lava fusa è un materiale **luminoso** (non illuminato dal sole) e **animato**:
  crosta scura che si rompe in placche e crepe arancio-gialle che pulsano e scorrono a valle
  (flow map a due fasi lungo la discesa del terreno; nei crateri piatti ribolle sul posto), con
  tre scale di disegno (~500 m, ~125 m, ~15 m) che si accendono con lo zoom e un bagliore ai
  bordi. La neve non si posa su lava e terra bruciata, così anche un gigante innevato può
  avere il cratere acceso. (Attenzione: `patch` è una parola riservata in GLSL.)
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
- **Terre nuove** (`NEW_LANDS` in `planet.js`, opzione `newLands`, default acceso): quattro
  masse aggiunte negli oceani più vuoti, lontane dalle coste esistenti, così la geografia di
  prima (e i luoghi degli episodi I–V) non cambia: una grande terra boreale (48°N 88°W,
  raggio 13°), una terra australe (35°S 92°E, 12°) e due grandi isole basse e paludose dei
  mari caldi (24°N 84°E e 21°S 88°W, 9.5°). Ogni voce alza il campo di continentalità con un
  profilo radiale inciso dal rumore `med`/`fine` (bordo organico, piattaforma di acque
  basse attorno) e ha `lift` (quota), `wet` (umidità in più) e `flat` (spegne montagne e
  colline: le isole paludose sono pianure). Le terre emerse passano da ~41% a ~44%.
  **Vulcani e regni storici si scelgono con `newLands = false`** (stessi vulcani, stessi 71
  regni con stessi nomi e capitali); poi `Nations` aggiunge i regni delle terre nuove, con
  capoluoghi solo nel cuore di ogni terra nuova (entro 0.62 r dal centro, distanza minima
  0.65 × quella normale) e un generatore a parte: Nethercombe (regno boreale), Hollinsgard,
  Greycairn e Maldane (terra australe), Corvennes (isola paludosa del nord). L'isola del sud
  resta divisa fra Brannoch e Vauclère. Lo 0.25% dei campioni di terraferma storica cambia
  regno lungo i nuovi confini e alcuni ranghi slittano di un gradino (dipendono dalla
  classifica delle superfici).
- **Catene montuose**: *ridged multifractal* mascherato da un campo di "orogenesi" esteso
  (anche vicino alle coste), più un secondo sistema di sierre minori (ridged a scala ~700
  km). Dentro le catene, **massicci e valli come in una catena vera**: ridged a 6 ottave
  con coordinate deformate, da massicci di ~130 km a creste di ~4 km, ampiezza 3.4 km; i
  dettagli fini nascono solo sulle creste e i fondovalle restano ampi e lisci. In montagna il
  rumore isotropo fine (2 km, 400 m, 80 m) è quasi spento: prima era moltiplicato per 5 e
  insieme a creste che partivano da ~60 km dava "un tappeto di bozze tutte uguali".
  Vicino al suolo anche l'ombreggiatura è meno esagerata (`shadingExaggeration`: 1.12× la
  geometria invece di 1.35×) e il micro-rilievo della roccia nello shader è dimezzato. Linea delle nevi `4500 - 30·|lat|` m
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
  "rari" guidati da un rumore di varietà regionale: paludi (Swamp calde e Marshland
  temperate, vaste e con acquitrini, vedi §3.11), Valle dei Cristalli (rumore proprio a
  grande scala), calanchi rossi,
  saline, praterie alpine. Il colore varia con continuità dentro ogni bioma (più verde dove
  è umido, più bruno dove è secco, più spento dove è freddo).
  Il deserto del Sahara deve emergere naturalmente dalla fascia secca subtropicale.
- **Nazioni** (`planet/nations.js`): 31 stati, regioni di Voronoi sferiche di capoluoghi
  scelti sulla terraferma a distanza minima di ~3200 km (in media ~6.8 milioni di km²),
  con coordinate deformate da sinusoidi 3D per confini sinuosi. Nomi **inventati di sapore
  fantasy** (Aethermoor, Ashenvale, Starfall, Umbrafen, Farrowmere…), mescolati in modo
  deterministico dal seed.
- **Etichette delle nazioni** (`ui/labels.js`, HTML, carattere **Cinzel** spaziato
  come su una mappa antica):
  - ogni nazione ha un **centro visivo** (`Nations.center`): il **polo di
    inaccessibilità**, cioè il campione di terraferma più lontano dal bordo della nazione =
    `min(distanza dal confine, distanza dalla costa)` (confine: misura esatta dello shader;
    costa: campione di mare più vicino, griglia di Fibonacci di 24000 punti), meno
    `0.2 × distanza dal baricentro` per centrare il nome nelle nazioni allungate. La
    versione precedente limitava la misura a 450 km: nelle nazioni grandi molti punti
    erano a pari merito e vinceva il primo, decentrato (es. Fennwald);
  - il nome è sempre **appoggiato a un punto fisso del terreno** (l'ancora): la posizione è
    la proiezione esatta di quel punto a ogni frame, quindi in zoom e pan si muove
    rigidamente con la mappa. Prima inseguiva il centroide della parte visibile, ricalcolato
    ogni 3 frame su una griglia grossolana: da qui gli scatti;
  - ancora = centro visivo finché è entro l'80% dell'inquadratura e sulla terra visibile
    della nazione; altrimenti il **punto più interno della parte visibile**: griglia di
    raggi a celle quadrate (24 sul lato lungo, giro completo in 3 frame), distanza di ogni
    cella dal bordo della sua regione (confini, coste e bordi dello schermo), cella
    migliore (a pari merito la più vicina al baricentro visibile) mediata con le vicine
    quasi altrettanto interne. Su un confine si vedono entrambi i nomi;
  - **isteresi**: un'ancora della parte visibile resta finché è entro il 90% dello schermo
    e la migliore non la batte di `1.25× + 0.5` celle;
  - **cambio d'ancora**: il punto del nome raggiunge il nuovo bersaglio con una **molla
    smorzata criticamente** sulla sfera (pulsazione 2 rad/s, ~2 s, sotto-passi di 1/60 s):
    posizione e velocità continue, niente salti né dissolvenze (le dissolvenze e lo
    scivolamento esponenziale risultavano scattosi). Solo se l'ancora esce dallo schermo
    il nome sfuma e riappare al bersaglio. Misura su zoom 3000→200 km + pan: velocità max
    ~15 px/frame (quella del terreno), accelerazione max ~6 px/frame²;
  - dimensione dei nomi 9–13 px secondo l'estensione della nazione;
  - compaiono sotto i ~7000 km di quota e **scompaiono sotto ~40 km** (sfumano tra 70 e 25
    km); se due nomi si sovrappongono resta quello con più terra inquadrata, con
    precedenza a quello già visibile (niente lampeggi).
  - **HUD**: descrive il punto **sotto il cursore** (lat, lon, quota del terreno, nazione,
    bioma, temperatura): raggio dalla camera intersecato con la sfera alla quota del
    terreno esagerata come nello shader, affinato in 3 passi. Fuori dalla finestra torna
    al centro della vista, sullo spazio mostra trattini. In fondo la quota della camera.
    Caratteri: chiavi in Cinzel, valori in Cormorant Garamond (cifre allineate).
- **Niente acqua nelle aree vulcaniche** (`planet.js`, sez. 9): cono, campi di colate e
  terra bruciata formano un'area vulcanica (`max(volc, lavaField, burn)`) dove fiumi,
  valli fluviali e laghi non esistono: i fiumi che arrivano da fuori si esauriscono al
  bordo (fattore `waterK`). Attorno ai vulcani **attivi** il reticolo maggiore diventa di
  **fiumi di lava** (`out.lava`, letto di basalto scuro, largo ~7 km perché più stretto
  della maglia appariva come una fila di puntini), sempre più sottili e spenti fra 0.4 e
  2.4 raggi dal cono; se il mare è vicino ci arrivano.
- **Due calotte polari**: a nord terre ghiacciate, a sud un continente polare (tipo
  Antartide) aggiunto al campo di continentalità oltre i ~64-80°. In entrambi i poli il
  mare gelato diventa **banchisa** (lastra di ghiaccio piatta, bioma `ICE`).

### 3.11 Flora: la vegetazione 3D (`planet/flora.js`, `render/plantModels.js`, `render/vegetation.js`)

Prima richiesta: ogni bioma con molte piante (anche inventate, mistiche, aliene), boschi
rigogliosi nei biomi verdi, piante bruciate/fantastiche nei suoli vulcanici e nei ghiacci, una
pianta che sale dal fondo del mare, spazio libero lasciato per altro, resa definita a ogni
zoom, effetto 3D e vento da vicino. Seconda richiesta: piante **sempre visibili**, già
distinguibili a 250-300 km di quota (proporzioni cambiate di proposito); distribuzione **non
uniforme** (boschi fittissimi e zone spoglie); altezze più varie, tra fantastiche e reali;
terreni più realistici da vicino (erba, neve, sabbia, lava); **vaste paludi** con acquitrini.
Terza richiesta: il mondo deve essere **esplorabile già a 300 km** di quota (non serve
scendere oltre), con gli alberi che compaiono a quella quota; anche da lontano, senza piante
3D, devono vedersi **macchie** dove sono i boschi; più paludi; un nuovo bioma vasto, la
**Valle dei Cristalli** (riferimento `contesto/cristalli.png`), con piante a tema.
Ispirazione: le immagini in `contesto/` (PDF: funghi giganti luminosi, baccelli turchesi,
alberi a ombrello con tronchi intrecciati, cristalli, vegetazione cremisi, batuffoli bianchi;
immagini sciolte: colonie di funghetti turchesi, alberi in fiore rosa dai tronchi
attorcigliati, rami in fiamme con sfere azzurre, felci-piuma blu, funghi-medusa pendenti,
giganti coperti di muschio con radici, alberi con chioma a fiore, lanterne arancio su steli,
gigli a stella, foglie enormi). Il PDF si legge estraendone le immagini JPEG (`/DCTDecode`)
con uno script Node: non c'è pdftoppm e caricare pdf.js da CDN nella pagina non è consentito.

- **Scala** (`FLORA_SCALE` = 8): invece di ridefinire la quota mostrata, tutta la flora è
  stata ingrandita 8 volte (potenza di due: i livelli delle tile scalano esattamente di 3).
  Alberi comuni ~8 km, alti 10-12 km, giganti (Canopy Titan, Mossfather) 18-22 km, fiori e
  cespugli 1.5-4 km, Tidecrown ~14 km sopra l'acqua; ogni specie varia del ±30-45%, nel
  cuore dei boschi le piante crescono di più e il 3.5% sono esemplari secolari 1.55 volte
  più grandi. A 300 km di quota un albero è ~30 px e si riconosce la specie; a 1000-2500 km
  le piante sono puntini. Con la flora sono scalati griglia, macchia, pozze, chiome dello
  shader e texture ravvicinate. La camera scende al massimo a **40 km** (`MIN_ALTITUDE`):
  sotto i ~420 km la vista si inclina verso l'orizzonte (a 40 km quasi radente). Le
  sceneggiature degli episodi impostano la quota direttamente e non sono limitate.
- **47 specie** (`SPECIES`): Elderoak, Spirepine, Canopy Titan, Fernpalm, Glowcap,
  Lanternpod, Bramblebush, Sunshade, Mistweeper, Prismbloom, Thornpillar, Sunspike,
  Ashwraith, Cinder Coral, Snowpuff, Rimeglass, **Tidecrown** (dal fondo del mare, campana
  viola-rosa e tentacoli luminosi), Kelp Spire, Duskbloom, Veilwood; e dalle immagini
  sciolte: Moonshroom (colonia di funghetti turchesi), Blushwood (fiori rosa, tronco
  attorcigliato), Emberbriar (rami in fiamme e sfere azzurre, suoli vulcanici), Featherfern
  (piume blu luminose), Jellybell (campane rosa pendenti con fili luminosi), Mossfather
  (gigante muschioso con radici e funghi a mensola), Petalcrown (chioma a fiore), Candlewick
  (lanterne arancio), Starlily (giglio a stella), Broadleaf (foglie enormi), Reedmace
  (canneto con tife), Bog Cypress (cipresso di palude con barbe di muschio e lucciole),
  Frostlantern (sfere di ghiaccio accese), Dunepalm (palma dorata delle oasi), Obsidian
  Bloom (schegge di vetro nero con cuore di magma); e della Valle dei Cristalli: Crystal
  Spire (prismi esagonali azzurri giganti con venature luminose), Rose Quartz (prismi
  rosa-viola), Shardwillow (albero di cristallo con grappoli pendenti, come quello che pende
  dalla volta nell'immagine), Glimmermoss (cuscini blu punteggiati di granuli luminosi),
  Geode Bloom (geode aperto con cristalli viola). Canopy Titan e Sunshade hanno chiome a
  "cuscini" sovrapposti a quote diverse: le chiome piatte, viste dall'alto, sembravano
  ninfee. Piante d'acqua (richiesta: meno fitte e più varie, con rimandi all'acqua, di
  altezze e colori diversi): Coralfan (ventagli di corallo rosso-arancio), Bubblekelp
  (alghe con vesciche dorate galleggianti), Seaglass Anemone (colonna rosa e tentacoli
  turchesi), Pearlmouth (conchiglia socchiusa con perla accesa), Tide Lotus (foglie
  galleggianti e loti bianco-azzurri, anche nelle lagune delle paludi), Conch Spire (torre
  a spirale di conchiglia), Saltroot (mangrovia su radici ad arco, solo nell'acqua bassa).
  Il mare basso ha ~metà delle piante di prima e nessuna specie supera il 17%.
- **Per bioma** (`FLORA`): densità nel cuore del bosco `d`, frazione coperta da boschi
  `cover`, densità nelle radure `sparse`, quanto la macchia è "bosco" per lo shader
  `tree`, specie del bosco `mix` e specie delle radure `open` (fiori, cespugli, funghi).
  Sopra la linea delle nevi solo piante di ghiaccio; vicino alla linea specie alpine. Niente
  piante su fiumi, laghi e lava; nelle lagune delle paludi solo qualche pianta galleggiante
  (`pond`: Tide Lotus, canne, mangrovie).
- **Distribuzione a macchie**: il campo di macchia somma rumori a ~320, ~72, ~20 e ~6 km.
  Sopra la soglia del bioma c'è il bosco: rado al margine, fittissimo nel cuore (chiome che
  si toccano); fuori restano radure quasi spoglie con qualche pianta isolata. I giganti solo
  nel cuore dei boschi. `node tools/veg-density.mjs [livello] [n]` misura piante per km² e
  quota di tile spoglie/fitte per bioma (foreste: ~0.05 piante/km² di media, cioè 1/64
  della prima versione).
- **Posizionamento** (nei worker, dentro `computeTileData`): griglia GLOBALE di candidati
  su ogni faccia del cubo (passo 2.88 km) con spostamento casuale; valori pseudo-casuali dalle
  coordinate intere: una tile e le sue figlie vedono le stesse piante. Bioma dal vertice più
  vicino; **quota sullo stesso triangolo che disegna il terreno** (con la bilineare finivano
  sotto il terreno). Da tile di livello >= 4 (~625 km): quota di piante tenute per livello
  `KEEP` (4: 10% ... 9+: 100%) sul **rango effettivo** rank^p, con p che cresce con la
  taglia: nelle tile lontane restano i grandi alberi e spariscono prima i fiori. ~20-30 ms
  per tile nel worker. `node tools/veg-stats.mjs [lat lon livello]` stampa piante e specie.
- **Copertura per lo shader** (`vegCover`, attributo `aEco` vec4): la stessa macchia,
  calcolata per vertice, dice al terreno dove sono i boschi (`aEco.x`), quanto è palude
  (`aEco.y`), quanto è Valle dei Cristalli (`aEco.z`) e il campo delle lagune (`aEco.w`).
  A ogni quota i boschi sono più scuri e saturi e le radure dei biomi verdi più chiare e
  asciutte: anche dallo spazio, senza piante 3D, si vedono le macchie dove sono le piante.
  Le chiome procedurali dello shader sono alla scala della flora (celle di 4 km) e da
  1000-5000 km disegnano il bosco a puntini.
- **Modelli** (`plantModels.js`): geometrie low-poly in stile illustrato alte 1, colori per
  vertice, `aWind` (oscillazione crescente con l'altezza, tremolio delle foglie) e
  `aGlow` (parti luminose). Tre livelli di dettaglio: completo (chiome su icosfera fine con
  "grumi" di fogliame), semplificato (senza dettagli minuti) e lontano (ottaedri, cilindri a
  3 lati senza tappi, niente rami sottili: 20-200 triangoli). Foglie e petali sottili usano
  sempre l'icosaedro semplice.
- **Disegno** (`vegetation.js`): una mesh istanziata per specie e per dettaglio (120). Il
  dettaglio si sceglie **per tile e per specie** dalla dimensione a schermo della pianta nel
  punto della tile più vicino (completo sopra 44 px, semplificato sopra 16 px), a gradini di
  un terzo d'ottava con isteresi. Ogni tile tiene le sue istanze già impaccate, ordinate per
  specie e rango: ricomporre i buffer è una serie di copie; le specie sotto il pixel non si
  disegnano e quelle lontane piccole si diradano (prese sempre le prime per rango).
  Posizioni divise in parte alta e bassa float32; base sul terreno esagerato (`uExag`),
  affondata del 6%. Vento, foglie che tremano, parti luminose che pulsano, tinta variata
  per istanza (rotazione in YIQ), stessa foschia del terreno. Sotto ~1-2 px la pianta
  sparisce in dissolvenza; le nuove crescono in 0.6 s, quelle già presenti nella tile padre
  no.
- **Prestazioni**: le piante si disegnano **prima del terreno** (renderOrder -1) con
  profondità logaritmica per vertice (niente gl_FragDepth): i pixel di terreno coperti dalle
  chiome vengono scartati dal test di profondità invece di essere ombreggiati. Nel bosco a
  300 km e nella palude a 40 km (vista radente): 30 fps (pannello del browser limitato a
  30); prima di questo accorgimento 16-20 fps.
- **Insidia di three.js**: quando il buffer delle istanze cresce bisogna creare una
  geometria NUOVA: three calcola il numero massimo di istanze una volta sola e con il
  buffer sostituito disegnava solo le prime.

#### Terreno da vicino e paludi (`render/materials.js`)

- **Paludi**: due biomi, **Swamp** (caldo: cipressi, salici, funghi e campane luminose) e
  **Marshland** (temperato: canneti, felci-piuma, funghetti), su pianure fino a ~700-750 m
  (soglie allargate: Swamp umidità > 0.37 e varietà > -0.2, Marshland > 0.34 e > -0.16;
  insieme ~8.3% della superficie del pianeta, prima ~5.9%);
  insieme ~14% delle terre. Le **lagune** vengono da un campo di rumore calcolato sulla CPU
  (`marshPond` in `flora.js`, scale ~30/10/4 km, passato per vertice in `aEco.w`): lo
  stesso campo apre l'acqua nello shader e tiene le piante fuori dalle lagune, così la
  palude è un mosaico di acqua ferma e isole boscose visibile da migliaia di km (con le
  pozze solo nello shader le piante le coprivano). Lo shader aggiunge rive e canali fini,
  acqua scura con lenticchie d'acqua e ninfee, fango e canneti sulle rive; niente treni di
  onde sulle acque ferme.
- **Valle dei Cristalli** (`BIOME.CRYSTAL_VALLEY`): regioni vaste e rare (~8% delle terre)
  da un rumore a ~2000 km con 5 ottave (contorni frastagliati, non macchie lisce), tra -6 e
  24 °C, dalle pianure ai piedi delle montagne. Lo shader (`aEco.z`) disegna roccia viola e
  blu a grandi chiazze, campi più chiari dove ci sono i cristalli, venature azzurre
  luminose e granuli che scintillano con la vista; niente boschi verdi.
- **Texture a scala media** (40-400 m, compaiono sotto i ~300 km di quota): erba pettinata
  dal vento (strisce allungate nel verso del vento) con chiazze di fiori selvatici;
  increspature della sabbia a ~200 m con lato al sole e lato in ombra; cumuli di neve
  modellati dal vento con il lato in ombra azzurro e brillii dei cristalli che cambiano con
  la vista; basalto spaccato in placche con crepe scure che vicino alla lava covano ancora
  (arancio, più forte durante le eruzioni).

### 3.12 Enciclopedia (`ui/encyclopedia.js`, `ui/encyclopediaData.js`, `ui/plantPortrait.js`, `ui/nationLore.js`)

Richiesta: fermando il mouse qualche istante su un bioma compare (senza cliccare) l'elenco
delle sue piante; passando su una pianta, più a lato, la sua pagina con una "foto"
renderizzata in stile fantasy (come le immagini di `contesto/`) e le informazioni (tipo,
altezza, caratteristiche, storia, tossicità, curiosità). Lo stesso sul nome di una nazione:
dimensioni, biomi, un po' di storia.

- **Comparsa**: mouse fermo per 1.3 s sul pianeta. Prima si controlla se sotto c'è il
  nome di una nazione (`nationLabels.hitTest`, sui riquadri dei nomi visibili), altrimenti
  il bioma del punto puntato (`pickGround` di main.js). Le finestre restano aperte finché
  il mouse ci sta sopra; si chiudono se il mouse torna sul pianeta a più di 40 px dal punto,
  a ogni clic, rotella o Esc. Mai durante la regia.
- **Bioma**: nome, descrizione breve (`BIOME_INFO`), specie ordinate per frequenza
  (`biomeFlora` in flora.js unisce bosco, radure e lagune; le rare hanno un'etichetta),
  con tipo e altezza tipica.
- **Altezze in metri**: sul pianeta le piante sono giganti (`SPECIES.h` in km di scena, già
  moltiplicato per `FLORA_SCALE`) perché si vedano da centinaia di km; l'enciclopedia legge
  lo stesso numero in **metri** (`fmtHeight`): Elderoak 8 m, Canopy Titan 22 m, Reedmace
  1.6 m. È voluto che sia fuori scala rispetto al rilievo del pianeta.
- **Pianta**: testi in `PLANT_INFO` (in inglese come il resto dell'interfaccia): tipo,
  tossicità su 4 livelli con nota, caratteristiche, storia naturale, curiosità; altezza e
  habitat calcolati da `SPECIES` e `speciesHabitats`.
- **Elyra non è abitata**: nessun testo dell'enciclopedia nomina persone, villaggi, città,
  regni, sovrani, mestieri o usi delle piante da parte di qualcuno (e nemmeno animali: nel
  canone non ci sono ancora). Le storie sono storia naturale legata agli episodi: First
  Breath, la Ninety-Year Heartbeat (Episodio IV), la First Seed (Episodio V).
- **Foto** (`plantPortrait`): un secondo canvas WebGL fuori schermo, una volta per specie
  (~40 ms, poi in cache). Scenario per habitat (foresta, giungla, palude, mare, ghiacci,
  fuoco, deserto, cristalli, prati): cielo crepuscolare in gradiente con bagliore, colline
  a strati nella foschia, ciuffi d'erba, lucciole; nel mare il pelo dell'acqua vela la
  parte sommersa. Accanto crescono specie dello stesso bioma **in proporzione** e due
  esemplari sullo sfondo. Luce principale calda, controluce colorato, poi una seconda
  passata con le sole parti luminose, sfocata e sommata (alone/bloom), e vignettatura.
- **Terra** (le "nazioni" della carta; `nationInfo`, calcolata alla prima apertura): pagina
  "Encyclopedia of Elyra · Land", senza popolazione, capitale, sovrano, stemma o rango.
  Superficie (campioni di terraferma sulla sfera) e quota delle terre, cuore della terra
  (baricentro), punto più alto con coordinate, temperatura media/minima/massima, quota di
  fiumi e laghi, vulcani (quelli di `planet.volcanoes` dentro i confini, con lago di lava),
  quando arrivò l'onda verde della First Seed (distanza dalla costa di Esmerault, 8.75°S
  66.65°E: il giro del pianeta = 13 settimane, "in a single season"), terre confinanti,
  biomi con barra a colori, flora tipica e una **storia naturale** in 5 paragrafi: origine
  geologica secondo il gruppo di biomi dominante, il fuoco (i suoi vulcani o la cenere
  portata dal vento), l'arrivo delle piante con la specie pioniera (la più piccola fra le
  più comuni del bioma principale), com'è oggi, una chiusa ("No foot has ever walked here.
  Not yet."). Le **terre nuove** (più di metà dei punti era mare senza `NEW_LANDS`) hanno
  una storia propria: emerse dopo il fuoco, mai toccate dalla cenere, piante arrivate col
  vento e le correnti. Tutto deterministico dal seed e dall'id della terra.

### 3.4 Persistenza (R7 + R8)

- Salvataggio su **`localStorage`** (dati piccoli: seed, parametri, camera).
- Il tasto "Salva" è **poco visibile**: piccolo, opacità bassa, si evidenzia solo in hover.
- Al boot l'applicazione legge il salvataggio e ricostruisce **lo stesso identico pianeta**
  (seed deterministico) e ripristina la camera.
- Autosalvataggio leggero della camera (posizione di navigazione) su `beforeunload`.

### 3.10 Regia: girare gli episodi (`src/director/`)

Strumento di produzione dei video della serie (§1.1). Tutto nel browser, niente ffmpeg.

- **Sceneggiatura** (`episodes/*.json`, inclusi nel bundle e scelti dal pannello):
  `shots` (punti chiave della camera: `at` in secondi, `lat`, `lon`, `alt` in km dal
  suolo, `pitch` 90 = zenit, `heading` 0 = nord, `cut: true` per uno stacco), `titles`
  (`from`, `to`, `text`, `sub`, `pos` top/center/bottom, `size`), `labels` (nomi dei
  regni: `true`, `false` o un intervallo `{ from, to }` con dissolvenza), `fade` (in/out dal nero), `fps`, `width`, `height` (default 1080×1920, 9:16),
  `fov`, `duration`, `music`, `narration`, `voiceFx`, `fx` (vedi sotto). `labels` è
  `false` di default: per ora i video non mostrano i nomi delle nazioni.
- **Movimento** (`timeline.js`): ogni canale (posizione sulla sfera come versore, quota in
  scala logaritmica, inclinazione, orientamento "srotolato") è interpolato con una cubica
  monotona PCHIP: velocità continua, niente oscillazioni oltre i punti chiave, partenza e
  arrivo da fermo.
- **Sovrimpressione** (`overlay.js`): titoli in Cinzel e sottotitoli in Cormorant Garamond
  (Google Fonts, con ripiego su Georgia), dissolvenze, vignettatura, nomi dei regni,
  dissolvenze dal/al nero. Identica in anteprima e nel video.
- **Anteprima**: la sceneggiatura gira in tempo reale in una cornice 9:16 al centro dello
  schermo (il resto è nero), con i titoli; `Esc` o *Stop* per uscire.
- **Ripresa** (`director.render`): fotogramma per fotogramma con un **orologio virtuale**
  (acqua, lava e morph delle tile seguono il tempo del video). Per ogni fotogramma si aspetta
  che tutte le tile necessarie siano pronte (max 12 s), poi l'immagine 3D viene composta con
  la sovrimpressione su un canvas 2D e codificata. Il risultato non dipende dalla velocità
  del computer ed è ripetibile. Il ciclo principale cede il controllo al regista
  (`step(dt, now, opts)` accetta `drive`, `viewportHeight`, `labelW/H`, `offline`,
  `clock`); per cedere il controllo al browser si usa `MessageChannel` (i timer sono
  rallentati a pagina nascosta).
- **Codifica** (`recorder.js`): WebCodecs `VideoEncoder` (H.264 High 4.2, ripiego VP9),
  16 Mbit/s, fotogramma chiave ogni 2 s, impacchettato in MP4 "fast start" da `mp4-muxer`.
  Audio: `AudioEncoder` AAC-LC 192 kbit/s (ripiego Opus), 48 kHz stereo; la colonna
  sonora è già calcolata e viene codificata tutta prima dei fotogrammi.
- **Voce narrante** (`tools/narrate.mjs`, `npm run narrate -- episodes/<ep>.json`): TTS
  locale **Kokoro-82M** (`kokoro-js`, licenza Apache 2.0, modello ONNX q8 scaricato da
  Hugging Face al primo uso, gira su CPU ~tempo reale). Lingua inglese. Le battute stanno in
  `narration: { voice, speed, lines: [{ at, text }] }`; lo script scrive
  `audio/<episodio>/NN.wav` (24 kHz) e `narration.json` con tempi e durate, salta le
  battute già generate (hash di testo|voce|velocità) e avvisa se due battute si
  sovrappongono o se l'ultima va oltre la fine. `audio/` è versionata (file piccoli).
  Voce scelta: `bm_lewis` (britannica, la più grave: ~89 Hz di fondamentale contro i
  111–138 Hz di am_michael, am_fenrir, bm_george), velocità 0.86.
- **Colonna sonora** (`audio.js`): mix calcolato una volta con un `OfflineAudioContext`
  (identico in anteprima e nel video). Voce: `playbackRate` 0.95 (tono più basso e
  più solenne), passa-alto 55 Hz, low-shelf +4 dB a 180 Hz (calore), +1.5 dB a 3.2 kHz
  (presenza), compressore morbido, riverbero sintetico da sala (2.6 s, mandata 0.2).
  Musica (`music: { src, volume, offset, fadeIn, fadeOut, duck }`): curva di guadagno a
  50 Hz con dissolvenze e **ducking** (scende a `duck` × volume mentre parla il narratore,
  con rampe di 0.4/0.7 s). Default volume 0.5, duck 0.6: musica ~14 dB sotto la voce
  (misurato: il brano di Vangelis da solo è già a −18/−23 dB RMS, con 0.16 spariva).
  Limitatore finale a −3 dB. Le battute diventano anche **sottotitoli** in basso
  (`narration.captions: false` per toglierli, `captionSize` per la dimensione).
- **Effetti** (`fx.js`, `particles.js`, attivi se la sceneggiatura ha `fx`): il fotogramma
  3D riceve prima le **particelle** (pulviscolo dorato con bokeh, braci che salgono) e poi
  passa in uno shader WebGL2 su un canvas separato: bagliore su due livelli (1/4 e 1/16
  della risoluzione), **messa a fuoco** (sfocatura che si apre), aberrazione cromatica,
  "respiro" dell'inquadratura, **nebbia mistica** animata (fbm), **light leak** caldi e
  viola negli angoli, color grading (ombre blu-viola, luci oro, saturazione, contrasto a S,
  tinta di scena), vignettatura e grana. Parametri in `fx`: valori base, `keys`
  (`{ at, ...parametri }`, interpolati con smoothstep), `flashes` (`{ at, power, rise,
  decay }`: lampo di luce, ideale per nascondere uno stacco) e `dips` (`{ at, dur }`:
  discesa al buio e sfocatura attorno a uno stacco). Default in `FX_DEFAULTS` (soglia del
  bagliore 0.72: più bassa "brucia" la neve). Titoli non-sottotitoli: emergono da una
  sfocatura con la spaziatura che si stringe e un alone dorato (`epic: false` per
  disattivarlo, `reveal` = durata). In anteprima l'intero fotogramma composto va nel canvas
  della sovrimpressione.
- **Prove di inquadratura**: `director.render(script, { only: [indici dei fotogrammi],
  onStill(canvas, t, i) })` calcola solo quei fotogrammi (niente video): utile per un
  provino a mosaico prima del render completo.
- **Resize bloccato durante la regia**: un `resize` della finestra (es. pannello del
  browser nascosto) durante una ripresa cambiava proporzioni della camera e dimensioni
  del canvas a metà video (pianeta ovale). Ora `resize()` di main.js non fa nulla
  mentre `director.busy`.
- **Montaggio dell'Episodio I (teaser, 48 s)**: spazio profondo che va a fuoco nel buio →
  lampo sulla parola "Elyra" e stacco su un orizzonte con l'atmosfera → discesa al buio e
  panoramica dal basso verso l'alto sulle cime innevate (esposizione 0.78 e soglia del
  bagliore 0.85: la neve bianca altrimenti si "bruciava") → discesa al buio, tinta rossa,
  braci e fiumi di lava sul vulcano → lampo su "This is Elyra" e lunga ripresa all'indietro
  fino al pianeta intero, che ruota piano; il titolo finale resta ~10 s.
  Le inquadrature migliori sulle montagne hanno la luce radente di lato (il sole è a nord-est
  della catena a 14°S 117°W: guardare verso nord o sud) e il cielo in alto (pitch 11–30).
- **Episodio II — The Nature of Elyra** (`episodes/ep02-the-nature-of-elyra.json`, 59 s,
  sotto il minuto): il narratore descrive le stranezze del pianeta, una per scena (spazio →
  costa con onde → oceano "notturno" con foschia turchese → ghiacci e vette → vulcano con
  due lampi a "battito" → ripresa all'indietro con i confini dei regni, "Not yet." e ~7 s
  di titolo finale).
  **Canone di Elyra** (da rispettare nei prossimi episodi):
  - dal generatore: raggio 6371 km, ~43% di terre emerse, vetta più alta ~9.5 km, fondali
    fino a ~7 km, 71 regni (nazioni) negli episodi I–V, 76 dopo le terre nuove, 46 vulcani di cui 21 attivi, due calotte di ghiaccio;
  - inventati, volutamente diversi dalla Terra: **nessuna luna**, eppure le maree salgono
    ("though nothing pulls them"); tutto è più leggero e la pioggia cade lenta (gravità
    bassa); di notte gli **oceani brillano** debolmente e nessuno sa perché; il ghiaccio dei
    poli è **più antico della luce** che lo illumina; **ogni novant'anni tutti i vulcani si
    risvegliano insieme**, come un unico battito; 71 regni che nessuno ha mai percorso
    ("Not yet."). Il narratore è il creatore (prima persona).
  - luoghi usati: costa con onde e catena innevata (10°N 4.5°W), valle verde con fiumi
    verso il mare (6°N 2.5°W), deserto (20°N 15°E), ghiacci e vette (63°N 140°W, luce
    radente), vulcano attivo (14.3°N 40.1°W), oceano profondo con isola (5.5°S 61°W).
    Il sole è fisso sopra 25°N 47°W: le zone con il sole alto sono più vivide, quelle
    lontane hanno luce radente e ombre lunghe.
- **Episodio III — The First Breath** (`episodes/ep03-the-first-breath.json`, 58 s):
  preannuncia la prima vita. Storia: Elyra ha atteso per mille ere; i suoi oceani
  brillavano di notte e nessuno sapeva perché ("But I knew."): sotto le onde, dove il
  fuoco dei vulcani incontra il mare freddo, qualcosa ha cominciato a muoversi, troppo
  piccolo per essere visto ("But it is alive."); un giorno lascerà l'acqua e salirà sulla
  terra ("The first breath of Elyra is coming."). **Canone**: la luce degli oceani è la
  prima vita, nata attorno ai vulcani sottomarini; non è ancora uscita dall'acqua.
  Scene: spazio → mare notturno (foschia turchese, plancton) → isola vulcanica attiva
  (58.2°N 64.2°W, raggio 63 km, sole alto) vista dall'alto e poi a pelo d'acqua con due
  lampi a battito → costa verde all'alba (6°N 2°W) → ripresa all'indietro e titolo.
  Nuove particelle in `particles.js`: **plancton luminoso** (`fx.plankton`), puntini
  turchesi con bokeh che pulsano a onde dal basso verso l'alto.
- **Episodio IV — The Ninety-Year Heartbeat** (`episodes/ep04-the-ninety-year-heartbeat.json`,
  47 s): il cuore di Elyra batte una volta ogni novant'anni e tutti i vulcani si
  risvegliano insieme; il fuoco squarcia il cielo, la cenere inghiotte il sole, il mondo
  brucia per una lunga notte; ma la cenere cade sulla terra come un dono e la luce dei
  mari la segue nel suolo: al ritorno del sole "something green is waiting".
  **Canone**: la prima vegetazione nasce dal battito (cenere fertile + la vita luminosa
  dei mari portata nel suolo); il prossimo episodio mostrerà le prime piante.
  Scene: spazio con battito (onda d'urto + tremore) → accensione a cascata di tutti i
  vulcani visti dallo spazio (onda d'urto grande) → eruzione ravvicinata del vulcano
  14.3°N 40.1°W (pennacchio, fontana di lapilli, lava accesa, fulmini, tremore) → il
  pianeta scuro che brucia → notte sulla costa con cenere e plancton → alba.
  **Nuovi effetti**: in `fx.js` `shakes` (`{ at, power, dur }`: tremore della camera) e
  `shocks` (`{ at, power, radius, dur, x, y }`: anello che deforma l'immagine e si
  allarga); fulmini = `flashes` brevissimi a coppie. In `eruption.js`: `volcanoGlow`
  (tutti i vulcani del pianeta si accendono a cascata, proiettati con la camera),
  `plume` (colonna di fumo con base accesa e fontana di lapilli sul vulcano di
  `fx.plumes [{ from, to, at: [lat, lon] }]` o `fx.plumeAt`), `ash` (cenere che cade).
  Nello shader del terreno `uLavaBoost` (parametro `fx.lavaBoost`, impostato dal regista
  prima del render di ogni fotogramma e azzerato alla fine): lava più accesa e bagliore
  più largo. Il regista riceve da main.js anche `planet`, `terrainMaterial` ed
  `exaggeration()`.
- **Episodio V — The First Seed** (`episodes/ep05-the-first-seed.json`, 61 s): dopo il
  fuoco Elyra tace, la cenere copre ogni terra ("Grey, and cold, and still."); a lungo
  niente si muove; poi, sotto la cenere, una luce ("Not fire. Something older."): la luce
  dei mari ha trovato la terra, e la terra risponde; semi che aspettavano da mille ere si
  aprono tutti insieme, le radici bevono la cenere; in una sola stagione Elyra diventa
  verde. Finale in sospeso: "And in the deepest forest, something began to stir."
  **Canone**: le prime piante nascono da un unico punto, sulla costa della giungla di
  Esmerault (8.75°S 66.65°E), e da lì l'onda verde copre il pianeta in una stagione;
  nelle foreste qualcosa comincia a muoversi (prossimo episodio).
  Scene: pianeta grigio di cenere dallo spazio → a terra, cenere che cade, silenzio →
  un punto di luce turchese con due battiti deboli → germogli e fiori che salgono davanti
  alla camera ("And the land answered": lampo, tremore, onda d'urto) → dall'alto l'anello
  di luce che corre sulla cenere lasciando la giungla → risalita fino allo spazio con il
  pianeta tutto verde e titolo.
  **Fronte di crescita** (nuovo strumento di regia): parametri `fx.growFront` (km dal
  centro fin dove la terra è già verde; -1 = spento) e `fx.growSoft` (larghezza della
  fascia), centro in `fx.growAt [lat, lon]` o `fx.grows [{ from, to, at }]`. Il regista
  li passa prima di ogni fotogramma alle uniform `uGrowFront/uGrowSoft/uGrowCenter` del
  terreno, condivise con le piante (azzerate alla fine). Terreno: oltre il fronte cenere
  scura (non su acqua e neve), sul fronte una fascia di luce turchese a puntini. Piante:
  dietro il fronte crescono con un leggero slancio, prima le piccole e poi i grandi alberi,
  e mentre crescono brillano di turchese; oltre il fronte non ci sono.
- **Attenzione**: dopo modifiche a `recorder.js` il server di Vite ha servito a lungo la
  versione vecchia (modulo in cache, watcher che non aveva visto il cambio): se il video
  esce "(no audio)" riavviare `npm run dev`.
- **Salvataggio**: con il server di sviluppo il video va in `videos/` del progetto (plugin
  `directorSave` in `vite.config.js`, POST `/__director/save`); nella build statica si
  scarica dal browser. `videos/` è escluso da git (file pesanti).
- Prova: 90 fotogrammi 1080×1920 in ~17 s su GPU integrata (senza tile nuove da generare).
- **Attenzione al morph**: con l'orologio virtuale una tile può risultare "nata nel futuro"
  (nata in tempo reale, ripresa che riparte da 0): in quel caso è considerata già formata,
  altrimenti il morph andava fuori scala e i vertici schizzavano via in lunghe schegge.

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
| Video | **WebCodecs + mp4-muxer** | MP4 generato nel browser, niente ffmpeg da installare |

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
├── contesto/                  ispirazione dell'utente (immagini, documenti): da guardare sempre
├── episodes/                  sceneggiature degli episodi (JSON)
├── videos/                    video girati (non in git)
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
│   │   ├── flora.js           specie vegetali e posizionamento delle piante
│   │   └── constants.js       costanti fisiche e geografiche
│   ├── render/
│   │   ├── terrainLOD.js      quadtree cubo-sfera
│   │   ├── tileData.js        dati di una tile (puro, griglia estesa + skirt)
│   │   ├── tileBuilder.js     mesh three.js dai dati di tileData
│   │   ├── tileWorker.js      Web Worker che calcola le tile (e le piante)
│   │   ├── plantModels.js     modelli 3D delle specie
│   │   ├── vegetation.js      piante istanziate, vento, dettaglio per distanza
│   │   ├── tilePool.js        pool di worker con priorità
│   │   ├── relief.js          esagerazione del rilievo
│   │   ├── materials.js       shader toon del terreno/acqua
│   │   ├── atmosphere.js      alone atmosferico
│   │   └── sky.js             sfondo + stelle
│   ├── director/              regia: sceneggiatura, anteprima, ripresa MP4, colonna sonora
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
Ogni fase è anche un'**era** della serie di video (§1.1): va pensata per essere raccontata e
ripresa, non solo simulata.

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
6. A ogni nuova richiesta **guardare la cartella `contesto/`** (immagini e documenti di
   ispirazione dell'utente) e tenerla sempre nei commit.

---

## 9. Stato attuale e limiti noti

Misure fatte sul seed `20261116` (laptop medio, Chrome):

| Voce | Valore |
|------|--------|
| Terre emerse | ~44% (+ banchisa polare; ~41% senza le terre nuove) |
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
