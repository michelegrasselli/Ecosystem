// Testi dell'enciclopedia di Elyra: una scheda per ogni specie di
// planet/flora.js (chiave = key della specie) e una breve descrizione per
// bioma. In inglese, come il resto dell'interfaccia e i video.
//
// kind: che tipo di pianta è; tone: colore del pallino nell'elenco;
// toxic: [livello 0 innocua .. 3 mortale, descrizione]; traits: aspetto e
// caratteristiche; lore: storia; curio: curiosità.

export const PLANT_INFO = {
  elderoak: {
    kind: 'Broadleaf tree',
    tone: '#5c8c3a',
    toxic: [0, 'Harmless. Its acorns, as big as a fist, are rich in starch and fall by the thousand.'],
    traits: 'A broad, patient tree with a rounded crown of overlapping leaf-clouds. Its bark is deeply furrowed and its branches split low, so that a single Elderoak looks like a small green hill.',
    lore: 'The first Elderoaks sprouted when the rains of the First Breath reached the inland plains. Whole temperate forests grew up in their shade, and most of the undergrowth of Elyra still depends on it.',
    curio: 'An Elderoak drops its leaves all at once on a single autumn night, and the forest floor turns gold by morning.'
  },
  spirepine: {
    kind: 'Conifer',
    tone: '#2f6248',
    toxic: [1, 'Mildly irritant resin that burns on contact; its smoke is sweet and pleasant.'],
    traits: 'Tiered cones of dark needles stacked into a narrow spire. It thrives where snow lies half the year and bends under the wind without breaking.',
    lore: 'Spirepines were the first trees to climb north after the ice retreated. The tallest tip of each tree leans slightly toward the pole, so a whole taiga points the same way.',
    curio: 'Its resin hardens into a pale amber that hums faintly during a storm.'
  },
  canopyTitan: {
    kind: 'Giant umbrella tree',
    tone: '#47703a',
    toxic: [0, 'Harmless. The sap is sweet and runs like syrup from any wound in the bark.'],
    traits: 'Three trunks twist around each other into a single column and open into a vast umbrella of layered foliage. Ring-lights of turquoise glow-moss circle the underside of the canopy.',
    lore: 'Canopy Titans grow only in the hearts of the oldest forests. Each one takes nine centuries to braid its trunks, and none has ever been seen to die of old age.',
    curio: 'A single crown shades a whole glade; entire communities of smaller plants live in the twilight beneath it and never see the sun.'
  },
  fernpalm: {
    kind: 'Tree fern',
    tone: '#4d8a32',
    toxic: [0, 'Harmless. Young fronds are tender and full of water.'],
    traits: 'A slender trunk crowned by a rosette of long arching fronds that droop like a fountain. It loves warm, wet shores and the edges of rainforests.',
    lore: 'Fernpalms are among the oldest plants of Elyra: fossil fronds are found in rocks laid down before the first volcanoes cooled.',
    curio: 'In the dry season the fronds fold shut at noon and open again at dusk, a slow wave that ripples across whole coasts.'
  },
  glowcap: {
    kind: 'Giant fungus',
    tone: '#e7772a',
    toxic: [2, 'Poisonous. Its spores carry a toxin that causes fever, visions and days of confusion.'],
    traits: 'A pale stalk carrying a glowing cap, usually ember-orange but sometimes deep violet. The gills underneath shine brightest, lighting the forest floor at night.',
    lore: 'Glowcaps were the first light of the rainforest floor, long before any flower opened there. Their colour changes before the rains, as if they could feel the storm coming.',
    curio: 'Orange and violet Glowcaps are the same species: the colour depends on how much iron is in the soil.'
  },
  lanternpod: {
    kind: 'Flowering herb',
    tone: '#3fb4b0',
    toxic: [1, 'The pods are harmless when ripe, bitter and mildly toxic when green.'],
    traits: 'Thin stems that each end in a swollen turquoise pod freckled with dark spots. The pods glow softly from within, like paper lanterns.',
    lore: 'Lanternpods spread across the grasslands in the season after the First Seed, following the paths of the night winds.',
    curio: 'Each pod holds a pocket of luminous gas: when it bursts, it flashes green and scatters the seeds.'
  },
  bramble: {
    kind: 'Shrub',
    tone: '#a8314f',
    toxic: [0, 'Harmless. The crimson berries are sweet and full of juice.'],
    traits: 'A dense, rounded thicket of small leaves studded with crimson berries. It grows almost everywhere, from forest edges to dry scrub.',
    lore: 'Bramblebush is the great pioneer of Elyra: it is usually the first shrub to cover bare ground after a fire or a flood.',
    curio: 'Its seeds float and survive for years in salt water, which is why Bramblebush is found on every continent.'
  },
  sunshade: {
    kind: 'Savanna tree',
    tone: '#7f8b34',
    toxic: [1, 'The thorns are coated with an itching wax.'],
    traits: 'A leaning trunk that forks into a flat, layered umbrella of tiny leaves, casting wide pools of shade across the grasslands.',
    lore: 'The oldest Sunshades stand alone in the grasslands, each one the centre of a ring of younger trees grown from its seeds.',
    curio: 'The crown always grows flattest on the side facing the prevailing wind, so the shape of a Sunshade shows where the wind comes from.'
  },
  mistweeper: {
    kind: 'Weeping tree',
    tone: '#5aa595',
    toxic: [0, 'Harmless. Its bark is soft and fragrant.'],
    traits: 'A willow-like tree whose fronds hang in long cones, their tips glowing pale green. On cool mornings it seems to breathe out mist.',
    lore: 'Mistweepers grow where rivers slow down; their roots hold the banks together and shape the meanders.',
    curio: 'The tips glow brighter in fog: whole marshes light up on the dampest nights.'
  },
  prismbloom: {
    kind: 'Crystal flower',
    tone: '#8a6bf0',
    toxic: [1, 'Not poisonous, but its shards are razor-sharp.'],
    traits: 'A cluster of violet-blue shards that grow like petals from bare rock. Light passing through them scatters into small rainbows.',
    lore: 'Prismblooms were the first flowers of the high mountains, growing straight from bare rock where no soil had yet formed.',
    curio: 'A Prismbloom grows by drinking mineral-rich mist and adds one thin layer of crystal every year, like the rings of a tree.'
  },
  thornpillar: {
    kind: 'Columnar cactus',
    tone: '#3d7c4a',
    toxic: [1, 'Spines cause painful swelling; the flesh inside is pure stored water.'],
    traits: 'A tall ribbed column with upturned arms and a single pink flower on top that opens only at night.',
    lore: 'Thornpillars grow in long straight lines across the deserts, following ancient cracks in the rock where water still runs deep underground.',
    curio: 'A large Thornpillar stores thousands of litres of water, and swells visibly after the rare rains.'
  },
  sunspike: {
    kind: 'Desert grass',
    tone: '#e1b245',
    toxic: [1, 'The golden spines are mildly venomous and sting like nettles.'],
    traits: 'A spiky tuft of stiff golden blades that catch the low sun and shine like fire at dawn and dusk.',
    lore: 'Sunspike fields cover the places where the ground stays hottest, as if they had sprung from the sunlight itself.',
    curio: 'Its blades turn slowly through the day to keep their edges toward the sun, reducing the heat they absorb.'
  },
  ashwraith: {
    kind: 'Charred tree',
    tone: '#5c4f49',
    toxic: [2, 'The ash in its bark is caustic and burns the eyes and lungs.'],
    traits: 'A blackened, leafless tree whose cracks glow with living embers. It looks dead but grows slowly, feeding on volcanic heat.',
    lore: 'Ashwraiths were the first trees to return after the Ninety-Year Heartbeat, when every volcano of Elyra erupted at once.',
    curio: 'It never burns: fire only makes its embers brighter.'
  },
  cindercoral: {
    kind: 'Volcanic shrub',
    tone: '#c23a2a',
    toxic: [2, 'Its sap is hot enough to blister skin.'],
    traits: 'A branching crimson growth, shaped like sea coral, with tips that glow like embers. It covers cooling lava fields in red thickets.',
    lore: 'Cinder Coral looks so much like the corals of the shallows that it may share their origin: a sea plant that learned to live on fire instead of water.',
    curio: 'Its branches crackle softly as they cool at night, filling lava fields with a sound like distant rain.'
  },
  snowpuff: {
    kind: 'Cushion plant',
    tone: '#e8eef2',
    toxic: [0, 'Harmless. Its down is soft and very warm.'],
    traits: 'Round white tufts of fine down that cover tundra and snowfields. Under the fluff, the plant stays warm enough to never freeze.',
    lore: 'Snowpuff colonies are the only green that survives the polar winter: under the fluff, the plant stays warm enough to never freeze.',
    curio: 'In spring the tufts release their down all at once and the tundra looks as if it were snowing upward.'
  },
  rimeglass: {
    kind: 'Ice tree',
    tone: '#a9dbf0',
    toxic: [0, 'Harmless, but touching it freezes the skin.'],
    traits: 'A tree made of clear ice-like crystal that grows in the coldest places, its branches glittering pale blue.',
    lore: 'Rimeglass trunks never melt and never fade; the oldest ones hold, layer by layer, a record of every winter since the ice first formed.',
    curio: 'A Rimeglass sings: wind passing through its branches produces long glassy notes heard for kilometres.'
  },
  tidecrown: {
    kind: 'Sea giant',
    tone: '#b06ad0',
    toxic: [3, 'Deadly. The glowing tentacles carry a paralysing sting.'],
    traits: 'Rising from the sea floor on a single stem, it opens above the waves into a violet-pink bell fringed with luminous tentacles, like a jellyfish frozen in mid-air.',
    lore: 'Tidecrowns are the tallest living things of the open sea. Their glow is the light that rose from the oceans on the night of the First Seed.',
    curio: 'Its stem can be ten times longer under water than above it; no one knows where a Tidecrown truly begins.'
  },
  kelpspire: {
    kind: 'Giant seaweed',
    tone: '#3f8a63',
    toxic: [0, 'Harmless. Dried, it is salty and nourishing.'],
    traits: 'Tall green kelp stalks that pierce the surface of shallow seas and spread fan-like fronds in the air.',
    lore: 'Kelp Spires were among the first plants of Elyra: green forests grew in the shallow seas long before anything took root on land.',
    curio: 'It grows up to a metre a day in summer, the fastest-growing plant of Elyra.'
  },
  duskbloom: {
    kind: 'Flowering herb',
    tone: '#d43b8c',
    toxic: [1, 'The nectar is a mild sedative.'],
    traits: 'A magenta chalice flower with a glowing golden heart that opens only at sunset.',
    lore: 'Duskblooms open only at sunset, and whole meadows turn magenta within a few minutes as the light fades.',
    curio: 'A field of Duskblooms glows for about an hour after dark, then all the flowers close at the same moment.'
  },
  veilwood: {
    kind: 'Slender tree',
    tone: '#8a6bb0',
    toxic: [1, 'The violet leaves are bitter and cause nausea.'],
    traits: 'A tall, thin tree with a narrow violet crown that shimmers like a veil in the wind.',
    lore: 'Veilwood groves grow in the oldest forests, always in rings around a clearing whose origin is unknown.',
    curio: 'Its wood is so light and flexible that a Veilwood can bend to the ground in a storm and stand up again unharmed.'
  },
  moonshroom: {
    kind: 'Fungus colony',
    tone: '#4fd1c8',
    toxic: [2, 'Poisonous. Its flesh contains a toxin that causes vomiting and dizziness.'],
    traits: 'A colony of small turquoise mushrooms growing in clusters on fallen wood and forest floors, glowing like moonlight.',
    lore: 'Moonshrooms spread along the roots of dead trees: where a forest falls, a turquoise glow appears within a season.',
    curio: 'A colony is a single organism: its threads can spread underground for tens of kilometres.'
  },
  blushwood: {
    kind: 'Flowering tree',
    tone: '#e48ab4',
    toxic: [0, 'Harmless. Its petals are sweet and fragrant.'],
    traits: 'A twisted trunk crowned with clouds of pink blossom that last most of the year.',
    lore: 'Blushwoods bloom almost all year round; the first ones flowered in the warm valleys a single season after the First Seed.',
    curio: 'When a Blushwood drops its petals, the ground stays pink for weeks: the petals do not wither.'
  },
  emberbriar: {
    kind: 'Fire shrub',
    tone: '#ff7a2a',
    toxic: [2, 'Its flames are real: touching it causes burns.'],
    traits: 'Contorted dark branches tipped with small flames and studded with cool blue spheres. It grows on warm volcanic soil.',
    lore: 'Emberbriar grows only where the ground is still warm from the volcanoes, and dies back when the soil cools.',
    curio: 'The blue spheres are seed pods full of water: they cool the plant and burst when the flames get too hot.'
  },
  featherfern: {
    kind: 'Fern',
    tone: '#4f8fe0',
    toxic: [0, 'Harmless and soft as down.'],
    traits: 'Plume-shaped fronds of luminous blue that sway slowly even without wind.',
    lore: 'Featherferns carpet the floors of the temperate forests, where they glow blue under the canopy at night.',
    curio: 'The fronds turn toward any source of warmth nearby, so a warm wind crossing a fern glade raises a slow blue wave.'
  },
  jellybell: {
    kind: 'Pendant tree',
    tone: '#ef7fb3',
    toxic: [2, 'The trailing threads sting, causing a rash and numbness.'],
    traits: 'A trunk hung with pink bell-shaped blossoms that dangle like jellyfish, trailing luminous threads.',
    lore: 'Jellybells grow at the edge of swamps, and their bells are so similar to the jellyfish of the shallows that they may once have lived in the sea.',
    curio: 'The bells ring very softly when shaken; a whole grove in the wind sounds like distant chimes.'
  },
  mossfather: {
    kind: 'Ancient giant',
    tone: '#4e7a3a',
    toxic: [0, 'Harmless. The moss is soft, clean and slows bleeding.'],
    traits: 'An immense trunk wrapped in moss, standing on a tangle of exposed roots, with shelf fungi climbing its sides like staircases.',
    lore: 'Every Mossfather is older than the forest around it: the first ones sprouted from the ash in the season of the First Seed and have never stopped growing.',
    curio: 'Some Mossfathers are hollow: their trunks hide damp chambers lined with moss, where glowing fungi grow in the dark.'
  },
  petalcrown: {
    kind: 'Flowering tree',
    tone: '#e06b9a',
    toxic: [0, 'Harmless. Its nectar is very sweet.'],
    traits: 'Its whole crown is a single enormous flower of overlapping petals, in shades that range from rose to gold.',
    lore: 'A Petalcrown blooms only once every seven years; the whole rainforest smells of it for a month.',
    curio: 'Each tree has its own colour, inherited from the tree whose pollen fertilised it: no two groves look alike.'
  },
  candlewick: {
    kind: 'Flowering herb',
    tone: '#f29a3a',
    toxic: [1, 'The lanterns contain an oil that irritates the stomach.'],
    traits: 'Slender stems carrying orange lantern-like flowers that glow warmly at twilight.',
    lore: 'Candlewicks light the edges of the forests at twilight; their glow is the first to appear and the last to fade.',
    curio: 'Each lantern burns its own oil to stay warm on cold nights, and is a little dimmer every morning.'
  },
  starlily: {
    kind: 'Lily',
    tone: '#f2d06b',
    toxic: [1, 'The bulb is poisonous; the flowers are harmless.'],
    traits: 'A star-shaped lily with long pointed petals, in colours from white to deep blue, scattered across meadows and clearings.',
    lore: 'Starlilies spread across the meadows carried by the wind, one flower at a time, wherever the soil was deep enough to hold a bulb.',
    curio: 'It closes at noon and opens at night, when its petals line up with the brightest star in the sky.'
  },
  broadleaf: {
    kind: 'Giant herb',
    tone: '#3f8c3a',
    toxic: [0, 'Harmless. The leaves are tough and waterproof.'],
    traits: 'Enormous paddle-shaped leaves rising from a short stem, the largest leaves on Elyra.',
    lore: 'Broadleaves fill the gaps left when a giant of the rainforest falls, racing toward the light before the next tree can close it.',
    curio: 'In heavy rain the leaves channel water into small pools at their base, where tiny water plants live their entire lives.'
  },
  reedmace: {
    kind: 'Reed',
    tone: '#8c6a3a',
    toxic: [0, 'Harmless. The roots are rich in starch.'],
    traits: 'Dense beds of tall reeds topped with brown velvety spikes, filling the shallows of marshes and swamps.',
    lore: 'Reedmace was the first plant to colonise the marshes: its roots trap the mud and slowly turn open water into land.',
    curio: 'In late summer the spikes burst into clouds of fluff that drift for days over the marshes.'
  },
  bogcypress: {
    kind: 'Swamp tree',
    tone: '#3d6a46',
    toxic: [0, 'Harmless. Its wood never rots.'],
    traits: 'A tall cypress with a swollen base standing in the water, its branches draped with grey beards of moss in which fireflies live.',
    lore: 'Bog Cypresses can live for thousands of years with their feet in the water; the oldest groves are the hearts of the great swamps.',
    curio: 'The trunk sends knobbly "knees" up out of the water to breathe; old trees are surrounded by dozens of them.'
  },
  frostlantern: {
    kind: 'Ice flower',
    tone: '#8fd8f2',
    toxic: [0, 'Harmless. The spheres taste of mint and snow.'],
    traits: 'Stems carrying spheres of ice lit from within, growing on high slopes near the snow line.',
    lore: 'Frostlanterns mark the snow line on every mountain of Elyra: they grow exactly where the snow begins.',
    curio: 'The light comes from tiny organisms living inside the ice, which feed on the plant\'s sugar.'
  },
  dunepalm: {
    kind: 'Palm',
    tone: '#d1a54a',
    toxic: [0, 'Harmless. Its golden dates are the sweetest fruit of the deserts.'],
    traits: 'A slender palm with a golden trunk and fan-shaped fronds, growing around oases.',
    lore: 'Every oasis of Elyra began with a single Dunepalm, whose roots found the water and whose shade let other plants follow.',
    curio: 'Its roots go so deep that a Dunepalm is the surest sign of water under the sand.'
  },
  obsidianbloom: {
    kind: 'Volcanic flower',
    tone: '#ff5a1f',
    toxic: [2, 'The glass shards cut, and the magma heart burns.'],
    traits: 'A rosette of black glass shards around a heart that glows like magma.',
    lore: 'Obsidian Blooms grow from lava that cooled too fast to become rock: they are half mineral, half plant.',
    curio: 'Its shards are so clear and sharp that sunlight passing through them can start a fire.'
  },
  crystalspire: {
    kind: 'Living crystal',
    tone: '#3b8fe8',
    toxic: [1, 'Not poisonous, but standing near one for days causes headaches.'],
    traits: 'Giant hexagonal prisms of blue crystal, tilted like the masts of a sunken ship, with luminous veins running up to their tips.',
    lore: 'The Crystal Valleys formed when a deep, mineral-rich water rose through the crust. The Crystal Spires are the oldest structures of those valleys, growing a finger a year.',
    curio: 'When the sun sets, the spires keep glowing for hours, releasing the light they absorbed during the day.'
  },
  rosequartz: {
    kind: 'Living crystal',
    tone: '#e070c0',
    toxic: [0, 'Harmless.'],
    traits: 'A bouquet of pink-violet prisms growing from the ground in tight clusters.',
    lore: 'Rose Quartz clusters grow where the water of the Crystal Valleys is richest in iron, which gives them their pink colour.',
    curio: 'Its colour deepens with age: the darkest clusters are thousands of years old.'
  },
  shardwillow: {
    kind: 'Crystal tree',
    tone: '#6fb6ff',
    toxic: [1, 'Falling shards can be dangerous in storms.'],
    traits: 'A violet crystal trunk with glowing branches from which hang clusters of blue crystals, like a willow made of glass.',
    lore: 'Shardwillows grow along the dry riverbeds of the Crystal Valleys, where the mineral water once flowed.',
    curio: 'The hanging clusters chime in the wind, and each tree plays its own note.'
  },
  glimmermoss: {
    kind: 'Crystal moss',
    tone: '#5aa0ff',
    toxic: [0, 'Harmless.'],
    traits: 'Low blue-violet cushions dotted with luminous granules that sparkle as you move.',
    lore: 'Glimmermoss carpets the floors of the Crystal Valleys; at night its trails of light make the valleys look like rivers of stars.',
    curio: 'Each granule is a tiny crystal seed that can be carried kilometres away by the wind.'
  },
  geodebloom: {
    kind: 'Crystal flower',
    tone: '#a05ae8',
    toxic: [0, 'Harmless.'],
    traits: 'A dark rock shell split open to reveal a heart of violet crystals, like a geode blooming.',
    lore: 'Geode Blooms grow from round stones that lie closed in the ground for centuries, waiting for the right storm.',
    curio: 'A closed geode can wait for centuries before blooming, opening only after a thunderstorm.'
  },
  coralfan: {
    kind: 'Sea coral',
    tone: '#ff6a3d',
    toxic: [1, 'The edges are sharp and cuts heal slowly.'],
    traits: 'Wide fans of red-orange coral that rise out of shallow water, laced with veins and tipped with glowing beads.',
    lore: 'Coralfans grow at the edge of the shallows, and their fans always turn to face the open sea.',
    curio: 'At low tide the fans dry out and turn pale; the colour returns within minutes when the water rises.'
  },
  bubblekelp: {
    kind: 'Floating seaweed',
    tone: '#d9a52e',
    toxic: [0, 'Harmless. The bladders are crunchy and taste of salt.'],
    traits: 'Olive stalks that rise from the sea carrying golden bladders full of air, with more bladders floating on the surface around them.',
    lore: 'Bubblekelp drifts with the currents: torn stalks float across whole oceans on their bladders and take root on distant coasts.',
    curio: 'The bladders glow faintly gold at night, making the kelp beds look like scattered coins.'
  },
  anemone: {
    kind: 'Sea flower',
    tone: '#4fd8d0',
    toxic: [2, 'The tentacles sting and cause hours of burning pain.'],
    traits: 'A pink-violet column emerging from the sea with a crown of luminous turquoise tentacles that wave constantly.',
    lore: 'Seaglass Anemones grow wherever the sea floor is rich in light-plankton, the same glow that lights the oceans at night.',
    curio: 'It is half plant and half something else: it grows from the sea floor, yet its tentacles move on their own.'
  },
  pearlmouth: {
    kind: 'Giant clam plant',
    tone: '#f2dce6',
    toxic: [0, 'Harmless, but it can close very suddenly.'],
    traits: 'A huge shell lying ajar on the surface of the water, lined with mother-of-pearl, with a glowing pearl in its heart.',
    lore: 'Pearlmouths have opened and closed with the tides since the first seas formed; they are among the oldest living things of Elyra.',
    curio: 'The pearl is its seed: once a century the shell opens wide and lets it roll into the sea.'
  },
  tidelotus: {
    kind: 'Water lily',
    tone: '#bcd4ff',
    toxic: [0, 'Harmless. The seeds are nutty and edible.'],
    traits: 'Large floating pads with white-blue lotus flowers on tall stems, growing in coastal shallows and swamp lagoons.',
    lore: 'The Tide Lotus grows from the mud of the lagoons yet its flowers stay spotless; it is the first flower to open in a new swamp.',
    curio: 'The flowers follow the tide: they rise at high water and sink almost to the surface at low water.'
  },
  conchspire: {
    kind: 'Shell tower',
    tone: '#f0a08a',
    toxic: [0, 'Harmless.'],
    traits: 'A spiral tower of cream and coral shell rising from the sea, with a glowing blue tip and a pink mouth at the waterline.',
    lore: 'Conch Spires are older than the coasts themselves; some stand far from land, marking shores that the sea swallowed long ago.',
    curio: 'Wind blowing into the mouth makes the spire sound like a horn, a long low note that carries far across the fog.'
  },
  saltroot: {
    kind: 'Mangrove',
    tone: '#3c7a56',
    toxic: [0, 'Harmless. Its leaves are covered with crystals of salt that can be scraped off.'],
    traits: 'A tree raised above the water on arched stilt roots crusted with white salt, with a glossy crown and seedlings hanging like glowing spindles.',
    lore: 'Saltroot forests hold the coasts together: their roots trap sand and mud and break the storm waves before they reach the land.',
    curio: 'Its seedlings sprout while still on the tree, then fall like darts and plant themselves in the mud below.'
  }
}

/** Livelli di tossicità. */
export const TOXIC_LEVEL = ['Harmless', 'Mildly toxic', 'Poisonous', 'Deadly']

/** Descrizione breve dei biomi (BIOME_NAME come chiave). */
export const BIOME_INFO = {
  'Deep ocean': 'The abyss: too deep for any plant to reach the light.',
  Ocean: 'Open sea, where only the giants of the deep reach the surface.',
  'Coastal shelf': 'Warm shallow seas where coral, kelp and sea flowers rise above the waves.',
  Lake: 'Fresh open water.',
  River: 'Running water: nothing takes root in the current.',
  'Sandy shore': 'Beaches and dunes at the edge of the sea, fringed with palms.',
  'Hot desert': 'Sun-scorched sand and rock where only the toughest plants survive.',
  'Arid steppe': 'Dry plains of thorn and golden grass.',
  Savanna: 'Warm grasslands dotted with umbrella trees.',
  Grassland: 'Open meadows with scattered groves and flowering clearings.',
  Scrubland: 'Low, tangled bush on dry hills.',
  'Temperate forest': 'Broadleaf woods of oak, pine and blossom, with luminous undergrowth.',
  Rainforest: 'Hot, wet jungle where giants, ferns and glowing fungi crowd every layer.',
  Taiga: 'Dark northern forests of spire pines.',
  Tundra: 'Cold treeless plains of fluff and ice flowers.',
  'High rock': 'Bare mountain rock above the tree line, where only crystals grow.',
  'Permanent snow': 'Eternal snow and ice.',
  'Ice sheet': 'Polar ice: a silent, frozen world.',
  Marshland: 'Temperate marshes of reeds, mist and still lagoons.',
  Badlands: 'Red eroded hills and gullies.',
  'Salt flat': 'White, cracked plains of salt.',
  'Alpine meadow': 'High pastures of flowers below the rocks.',
  'Volcanic slopes': 'Dark ash slopes where fire plants thrive.',
  'Lava lake': 'Molten rock: nothing can grow here.',
  'Lava field': 'Black flows of cooled basalt, still warm underneath.',
  'Scorched land': 'Ground burned by eruptions, slowly coming back to life.',
  Swamp: 'Warm swamps of cypress, lagoons and glowing bells.',
  'Crystal Valley': 'Vast valleys of violet rock where living crystals grow.'
}
