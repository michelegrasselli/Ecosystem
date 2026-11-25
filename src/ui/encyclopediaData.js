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
    toxic: [0, 'Harmless. Its acorns, the size of houses, are roasted and eaten in hard winters.'],
    traits: 'A broad, patient tree with a rounded crown of overlapping leaf-clouds. Its bark is deeply furrowed and its branches split low, so that a single Elderoak looks like a small green hill.',
    lore: 'The first Elderoaks sprouted when the rains of the First Breath reached the inland plains. Most temperate kingdoms of Elyra were founded in their shade, and many still swear oaths "under the oak".',
    curio: 'An Elderoak drops its leaves all at once on a single autumn night; villages hold a feast called the Leaf-Fall to welcome the bare season.'
  },
  spirepine: {
    kind: 'Conifer',
    tone: '#2f6248',
    toxic: [1, 'Mildly irritant resin. Burns the throat if chewed; the smoke is pleasant.'],
    traits: 'Tiered cones of dark needles stacked into a narrow spire. It thrives where snow lies half the year and bends under the wind without breaking.',
    lore: 'The northern peoples steered by the Spirepines before they had compasses: the tallest tip of each tree leans slightly toward the pole.',
    curio: 'Its resin hardens into a pale amber that hums faintly when held to the ear during a storm.'
  },
  canopyTitan: {
    kind: 'Giant umbrella tree',
    tone: '#47703a',
    toxic: [0, 'Harmless. The sap is sweet and is tapped like maple syrup.'],
    traits: 'Three trunks twist around each other into a single column and open into a vast umbrella of layered foliage. Ring-lights of turquoise glow-moss circle the underside of the canopy.',
    lore: 'Canopy Titans grow only in the hearts of the oldest forests. Each one is said to take nine centuries to braid its trunks, and none has ever been seen to die of old age.',
    curio: 'A single crown shades an area wider than a city; whole ecosystems of smaller plants live in the twilight beneath it and never see the sun.'
  },
  fernpalm: {
    kind: 'Tree fern',
    tone: '#4d8a32',
    toxic: [0, 'Harmless. Young fronds are eaten boiled.'],
    traits: 'A slender trunk crowned by a rosette of long arching fronds that droop like a fountain. It loves warm, wet shores and the edges of rainforests.',
    lore: 'Fernpalms are among the oldest plants of Elyra: fossil fronds are found in rocks laid down before the first volcanoes cooled.',
    curio: 'In the dry season the fronds fold shut at noon and open again at dusk, a slow wave that ripples across whole coasts.'
  },
  glowcap: {
    kind: 'Giant fungus',
    tone: '#e7772a',
    toxic: [2, 'Poisonous. Its spores cause vivid dreams, fever and days of confusion.'],
    traits: 'A pale stalk carrying a glowing cap, usually ember-orange but sometimes deep violet. The gills underneath shine brightest, lighting the forest floor at night.',
    lore: 'Travellers through the rainforests once marked safe paths with Glowcaps. A whole order of night-wardens learned to read the colour of the caps as a sign of coming rain.',
    curio: 'Orange and violet Glowcaps are the same species: the colour depends on how much iron is in the soil.'
  },
  lanternpod: {
    kind: 'Flowering herb',
    tone: '#3fb4b0',
    toxic: [1, 'The pods are edible when ripe, bitter and mildly sickening when green.'],
    traits: 'Thin stems that each end in a swollen turquoise pod freckled with dark spots. The pods glow softly from within, like paper lanterns.',
    lore: 'Shepherds used to carry Lanternpods on poles to lead flocks home after sunset; the custom survives in festivals of floating lights.',
    curio: 'Each pod holds a pocket of luminous gas: popped near a flame, it flashes green.'
  },
  bramble: {
    kind: 'Shrub',
    tone: '#a8314f',
    toxic: [0, 'Harmless. The crimson berries are a staple fruit across Elyra.'],
    traits: 'A dense, rounded thicket of small leaves studded with crimson berries. It grows almost everywhere, from forest edges to dry scrub.',
    lore: 'Bramble jam was the currency of the early hill clans; debts were measured in jars.',
    curio: 'Birds that eat the berries carry the seeds across oceans, which is why Bramblebush is found on every continent.'
  },
  sunshade: {
    kind: 'Savanna tree',
    tone: '#7f8b34',
    toxic: [1, 'The thorns are coated with an itching wax.'],
    traits: 'A leaning trunk that forks into a flat, layered umbrella of tiny leaves, casting wide pools of shade across the grasslands.',
    lore: 'Councils of the savanna tribes are still held beneath the oldest Sunshade of each region, and the tree gives its name to the meeting: "the shade".',
    curio: 'The crown always grows flattest on the side facing the prevailing wind, so herders read the weather from its shape.'
  },
  mistweeper: {
    kind: 'Weeping tree',
    tone: '#5aa595',
    toxic: [0, 'Harmless. Its bark is brewed into a calming tea.'],
    traits: 'A willow-like tree whose fronds hang in long cones, their tips glowing pale green. On cool mornings it seems to breathe out mist.',
    lore: 'Mistweepers grow where rivers slow down. Old songs claim they weep for the water that leaves them.',
    curio: 'The tips glow brighter in fog: whole marshes light up on the dampest nights.'
  },
  prismbloom: {
    kind: 'Crystal flower',
    tone: '#8a6bf0',
    toxic: [1, 'Not poisonous, but its shards are razor-sharp.'],
    traits: 'A cluster of violet-blue shards that grow like petals from bare rock. Light passing through them scatters into small rainbows.',
    lore: 'Prismblooms were the first "flowers" the mountain folk ever saw; they believed the stars had fallen and taken root.',
    curio: 'A Prismbloom grows by drinking mineral-rich mist and adds one thin layer of crystal every year, like the rings of a tree.'
  },
  thornpillar: {
    kind: 'Columnar cactus',
    tone: '#3d7c4a',
    toxic: [1, 'Spines cause painful swelling; the flesh is drinkable in an emergency.'],
    traits: 'A tall ribbed column with upturned arms and a single pink flower on top that opens only at night.',
    lore: 'Desert caravans count distances in "pillars". The oldest specimens mark ancient trade routes in straight lines across the dunes.',
    curio: 'A large Thornpillar stores enough water to fill a small lake, and swells visibly after the rare rains.'
  },
  sunspike: {
    kind: 'Desert grass',
    tone: '#e1b245',
    toxic: [1, 'The golden spines are mildly venomous and sting like nettles.'],
    traits: 'A spiky tuft of stiff golden blades that catch the low sun and shine like fire at dawn and dusk.',
    lore: 'Sunspike fields are said to mark places where the sun touched the ground on the first day of Elyra.',
    curio: 'Its blades turn slowly through the day to keep their edges toward the sun, reducing the heat they absorb.'
  },
  ashwraith: {
    kind: 'Charred tree',
    tone: '#5c4f49',
    toxic: [2, 'The ash in its bark is caustic and burns the eyes and lungs.'],
    traits: 'A blackened, leafless tree whose cracks glow with living embers. It looks dead but grows slowly, feeding on volcanic heat.',
    lore: 'Ashwraiths were the first trees to return after the Ninety-Year Heartbeat, when every volcano of Elyra erupted at once.',
    curio: 'It never burns: fire only makes its embers brighter. Smiths plant them near forges for luck.'
  },
  cindercoral: {
    kind: 'Volcanic shrub',
    tone: '#c23a2a',
    toxic: [2, 'Its sap is hot enough to blister skin.'],
    traits: 'A branching crimson growth, shaped like sea coral, with tips that glow like embers. It covers cooling lava fields in red thickets.',
    lore: 'Sailors who first saw Cinder Coral on the slopes believed the sea had once covered the volcanoes.',
    curio: 'Its branches crackle softly as they cool at night, filling lava fields with a sound like distant rain.'
  },
  snowpuff: {
    kind: 'Cushion plant',
    tone: '#e8eef2',
    toxic: [0, 'Harmless. Herders stuff pillows with its fluff.'],
    traits: 'Round white tufts of fine down that cover tundra and snowfields. Under the fluff, the plant stays warm enough to never freeze.',
    lore: 'Polar travellers survive blizzards by digging into Snowpuff colonies, an act called "sleeping in the cloud".',
    curio: 'In spring the tufts release their down all at once and the tundra looks as if it were snowing upward.'
  },
  rimeglass: {
    kind: 'Ice tree',
    tone: '#a9dbf0',
    toxic: [0, 'Harmless, but touching it with bare hands freezes the skin.'],
    traits: 'A tree made of clear ice-like crystal that grows in the coldest places, its branches glittering pale blue.',
    lore: 'The ice-folk carve their calendars into Rimeglass trunks, which never melt and never fade.',
    curio: 'A Rimeglass sings: wind passing through its branches produces long glassy notes heard for kilometres.'
  },
  tidecrown: {
    kind: 'Sea giant',
    tone: '#b06ad0',
    toxic: [3, 'Deadly. The glowing tentacles carry a paralysing sting.'],
    traits: 'Rising from the sea floor on a single stem, it opens above the waves into a violet-pink bell fringed with luminous tentacles, like a jellyfish frozen in mid-air.',
    lore: 'Tidecrowns are the tallest living things of the open sea. The first navigators used their glow as lighthouses, and still sing to them for safe passage.',
    curio: 'Its stem can be more than a kilometre long under water; no one has yet seen where a Tidecrown truly begins.'
  },
  kelpspire: {
    kind: 'Giant seaweed',
    tone: '#3f8a63',
    toxic: [0, 'Harmless. Dried, it is salty and nourishing.'],
    traits: 'Tall green kelp stalks that pierce the surface of shallow seas and spread fan-like fronds in the air.',
    lore: 'Coastal villages build their boats from dried Kelpspire, light and hard as horn.',
    curio: 'It grows up to a metre a day in summer, the fastest-growing plant of Elyra.'
  },
  duskbloom: {
    kind: 'Flowering herb',
    tone: '#d43b8c',
    toxic: [1, 'The nectar is a mild sedative.'],
    traits: 'A magenta chalice flower with a glowing golden heart that opens only at sunset.',
    lore: 'Lovers in the temperate kingdoms exchange Duskblooms at dusk; one picked at noon is a sign of rejection.',
    curio: 'Its glow attracts night moths the size of birds, which are its only pollinators.'
  },
  veilwood: {
    kind: 'Slender tree',
    tone: '#8a6bb0',
    toxic: [1, 'The violet leaves are bitter and cause nausea.'],
    traits: 'A tall, thin tree with a narrow violet crown that shimmers like a veil in the wind.',
    lore: 'Veilwood groves were sacred to the oracles of the old forests, who listened to the rustle of the leaves for prophecies.',
    curio: 'Its wood is so light and flexible that it is used to make bows that never break.'
  },
  moonshroom: {
    kind: 'Fungus colony',
    tone: '#4fd1c8',
    toxic: [2, 'Poisonous raw; when dried it is used as a weak lamp oil.'],
    traits: 'A colony of small turquoise mushrooms growing in clusters on fallen wood and forest floors, glowing like moonlight.',
    lore: 'Children in the forest kingdoms are told that every Moonshroom marks a place where a star once fell asleep.',
    curio: 'A colony is a single organism: its threads can spread underground for tens of kilometres.'
  },
  blushwood: {
    kind: 'Flowering tree',
    tone: '#e48ab4',
    toxic: [0, 'Harmless. Its petals flavour wine and pastries.'],
    traits: 'A twisted trunk crowned with clouds of pink blossom that last most of the year.',
    lore: 'Blushwood orchards were planted around every royal palace of the old age; a court without them was a court in mourning.',
    curio: 'When a Blushwood drops its petals, the ground stays pink for weeks: the petals do not wither.'
  },
  emberbriar: {
    kind: 'Fire shrub',
    tone: '#ff7a2a',
    toxic: [2, 'Its flames are real: touching it causes burns.'],
    traits: 'Contorted dark branches tipped with small flames and studded with cool blue spheres. It grows on warm volcanic soil.',
    lore: 'Fire-priests of the volcanic marches carried Emberbriar torches that never went out.',
    curio: 'The blue spheres are seed pods full of water: they cool the plant and burst when the flames get too hot.'
  },
  featherfern: {
    kind: 'Fern',
    tone: '#4f8fe0',
    toxic: [0, 'Harmless and soft as down.'],
    traits: 'Plume-shaped fronds of luminous blue that sway slowly even without wind.',
    lore: 'Featherfern fronds were the quills of the first scribes of Elyra; their ink glowed in the dark.',
    curio: 'The fronds turn toward any warm body nearby, so a walker in a fern glade is followed by a slow blue wave.'
  },
  jellybell: {
    kind: 'Pendant tree',
    tone: '#ef7fb3',
    toxic: [2, 'The trailing threads sting, causing a rash and numbness.'],
    traits: 'A trunk hung with pink bell-shaped blossoms that dangle like jellyfish, trailing luminous threads.',
    lore: 'Jellybells grow at the edge of swamps; marsh folk believe they are jellyfish that climbed out of the sea and forgot how to return.',
    curio: 'The bells ring very softly when shaken; a whole grove in the wind sounds like distant chimes.'
  },
  mossfather: {
    kind: 'Ancient giant',
    tone: '#4e7a3a',
    toxic: [0, 'Harmless. The moss is used to dress wounds.'],
    traits: 'An immense trunk wrapped in moss, standing on a tangle of exposed roots, with shelf fungi climbing its sides like staircases.',
    lore: 'Every Mossfather is older than any kingdom. Treaties between forest nations are signed at their roots, and breaking one is breaking faith with the forest itself.',
    curio: 'Some Mossfathers are hollow: entire villages have lived inside them for generations.'
  },
  petalcrown: {
    kind: 'Flowering tree',
    tone: '#e06b9a',
    toxic: [0, 'Harmless. Bees make a very sweet honey from it.'],
    traits: 'Its whole crown is a single enormous flower of overlapping petals, in shades that range from rose to gold.',
    lore: 'A Petalcrown blooms only once every seven years; the whole rainforest smells of it for a month.',
    curio: 'Each tree has its own colour, inherited from the tree whose pollen fertilised it: no two groves look alike.'
  },
  candlewick: {
    kind: 'Flowering herb',
    tone: '#f29a3a',
    toxic: [1, 'The lanterns contain an oil that irritates the stomach.'],
    traits: 'Slender stems carrying orange lantern-like flowers that glow warmly at twilight.',
    lore: 'Candlewick oil lit the lamps of Elyra\'s first libraries.',
    curio: 'Each lantern burns its own oil to stay warm on cold nights, and is a little dimmer every morning.'
  },
  starlily: {
    kind: 'Lily',
    tone: '#f2d06b',
    toxic: [1, 'The bulb is toxic to animals but not to people.'],
    traits: 'A star-shaped lily with long pointed petals, in colours from white to deep blue, scattered across meadows and clearings.',
    lore: 'Starlilies were the badge of the first wandering bards, who planted one wherever they sang.',
    curio: 'It closes at noon and opens at night, when its petals line up with the brightest star in the sky.'
  },
  broadleaf: {
    kind: 'Giant herb',
    tone: '#3f8c3a',
    toxic: [0, 'Harmless. The leaves are used as roofs and plates.'],
    traits: 'Enormous paddle-shaped leaves rising from a short stem, the largest leaves on Elyra.',
    lore: 'In the rainforest kingdoms, "under one leaf" means under one roof: a whole family.',
    curio: 'In heavy rain the leaves channel water into small pools at their base, where frogs live their entire lives.'
  },
  reedmace: {
    kind: 'Reed',
    tone: '#8c6a3a',
    toxic: [0, 'Harmless. The roots are ground into flour.'],
    traits: 'Dense beds of tall reeds topped with brown velvety spikes, filling the shallows of marshes and swamps.',
    lore: 'Marsh peoples weave everything from Reedmace: boats, houses, mats and even armour.',
    curio: 'In late summer the spikes burst into clouds of fluff that drift for days over the marshes.'
  },
  bogcypress: {
    kind: 'Swamp tree',
    tone: '#3d6a46',
    toxic: [0, 'Harmless. Its wood never rots.'],
    traits: 'A tall cypress with a swollen base standing in the water, its branches draped with grey beards of moss in which fireflies live.',
    lore: 'Bog Cypress groves were the hiding places of exiles and outlaws; many swamp villages descend from them.',
    curio: 'The trunk sends knobbly "knees" up out of the water to breathe; old trees are surrounded by dozens of them.'
  },
  frostlantern: {
    kind: 'Ice flower',
    tone: '#8fd8f2',
    toxic: [0, 'Harmless. The spheres taste of mint and snow.'],
    traits: 'Stems carrying spheres of ice lit from within, growing on high slopes near the snow line.',
    lore: 'Mountain guides read the glow of Frostlanterns: when they dim, an avalanche is near.',
    curio: 'The light comes from tiny organisms living inside the ice, which feed on the plant\'s sugar.'
  },
  dunepalm: {
    kind: 'Palm',
    tone: '#d1a54a',
    toxic: [0, 'Harmless. Its golden dates are the sweetest fruit of the deserts.'],
    traits: 'A slender palm with a golden trunk and fan-shaped fronds, growing around oases.',
    lore: 'Every oasis of Elyra is named after its oldest Dunepalm, and travellers greet it before drinking.',
    curio: 'Its roots go so deep that a Dunepalm is the surest sign of water under the sand.'
  },
  obsidianbloom: {
    kind: 'Volcanic flower',
    tone: '#ff5a1f',
    toxic: [2, 'The glass shards cut, and the magma heart burns.'],
    traits: 'A rosette of black glass shards around a heart that glows like magma.',
    lore: 'It is said that Obsidian Blooms grow where a dragon\'s tear fell. No dragon has ever been seen on Elyra, which only makes the story more popular.',
    curio: 'Glassmakers grind the shards into a powder that makes the clearest lenses in the world.'
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
    lore: 'Healers of the Crystal Valleys place Rose Quartz shards on the sleeping to bring calm dreams.',
    curio: 'Its colour deepens with age: the darkest clusters are thousands of years old.'
  },
  shardwillow: {
    kind: 'Crystal tree',
    tone: '#6fb6ff',
    toxic: [1, 'Falling shards can be dangerous in storms.'],
    traits: 'A violet crystal trunk with glowing branches from which hang clusters of blue crystals, like a willow made of glass.',
    lore: 'Shardwillows inspired the chandeliers of the great halls of Elyra; the first chandelier was a branch of Shardwillow hung upside down.',
    curio: 'The hanging clusters chime in the wind, and each tree plays its own note.'
  },
  glimmermoss: {
    kind: 'Crystal moss',
    tone: '#5aa0ff',
    toxic: [0, 'Harmless.'],
    traits: 'Low blue-violet cushions dotted with luminous granules that sparkle as you move.',
    lore: 'Travellers in the Crystal Valleys follow trails of Glimmermoss at night, which is how the valleys earned the name "the roads of stars".',
    curio: 'Each granule is a tiny crystal seed that can be carried kilometres away by the wind.'
  },
  geodebloom: {
    kind: 'Crystal flower',
    tone: '#a05ae8',
    toxic: [0, 'Harmless.'],
    traits: 'A dark rock shell split open to reveal a heart of violet crystals, like a geode blooming.',
    lore: 'The first Geode Blooms were mistaken for treasure; the "crystal rush" that followed founded half the towns of the valleys.',
    curio: 'A closed geode can wait for centuries before blooming, opening only after a thunderstorm.'
  },
  coralfan: {
    kind: 'Sea coral',
    tone: '#ff6a3d',
    toxic: [1, 'The edges are sharp and cuts heal slowly.'],
    traits: 'Wide fans of red-orange coral that rise out of shallow water, laced with veins and tipped with glowing beads.',
    lore: 'Fishermen orient themselves in the shallows by the Coralfans: their fans always face the open sea.',
    curio: 'At low tide the fans dry out and turn pale; the colour returns within minutes when the water rises.'
  },
  bubblekelp: {
    kind: 'Floating seaweed',
    tone: '#d9a52e',
    toxic: [0, 'Harmless. The bladders are crunchy and taste of salt.'],
    traits: 'Olive stalks that rise from the sea carrying golden bladders full of air, with more bladders floating on the surface around them.',
    lore: 'Children of the coast build rafts from Bubblekelp bladders, and some have crossed whole straits on them.',
    curio: 'The bladders glow faintly gold at night, making the kelp beds look like scattered coins.'
  },
  anemone: {
    kind: 'Sea flower',
    tone: '#4fd8d0',
    toxic: [2, 'The tentacles sting and cause hours of burning pain.'],
    traits: 'A pink-violet column emerging from the sea with a crown of luminous turquoise tentacles that wave constantly.',
    lore: 'Pearl divers say that a Seaglass Anemone guards every pearl bed, and they leave it an offering of fish before diving.',
    curio: 'It is half plant and half animal: it grows from the sea floor but catches fish with its tentacles.'
  },
  pearlmouth: {
    kind: 'Giant clam plant',
    tone: '#f2dce6',
    toxic: [0, 'Harmless, but it can close very suddenly.'],
    traits: 'A huge shell lying ajar on the surface of the water, lined with mother-of-pearl, with a glowing pearl in its heart.',
    lore: 'The pearls of the Pearlmouths lit the throne rooms of the first coastal kings. Taking one is said to bring a storm.',
    curio: 'The pearl is its seed: once a century the shell opens wide and lets it roll into the sea.'
  },
  tidelotus: {
    kind: 'Water lily',
    tone: '#bcd4ff',
    toxic: [0, 'Harmless. The seeds are eaten roasted.'],
    traits: 'Large floating pads with white-blue lotus flowers on tall stems, growing in coastal shallows and swamp lagoons.',
    lore: 'The Tide Lotus is the emblem of the marsh kingdoms: it grows from the mud yet stays spotless.',
    curio: 'The flowers follow the tide: they rise at high water and sink almost to the surface at low water.'
  },
  conchspire: {
    kind: 'Shell tower',
    tone: '#f0a08a',
    toxic: [0, 'Harmless.'],
    traits: 'A spiral tower of cream and coral shell rising from the sea, with a glowing blue tip and a pink mouth at the waterline.',
    lore: 'Conch Spires are older than the coasts themselves; some stand far from land, marking shores that the sea swallowed long ago.',
    curio: 'Wind blowing into the mouth makes the spire sound like a horn; sailors hear it in fog and know where the reefs are.'
  },
  saltroot: {
    kind: 'Mangrove',
    tone: '#3c7a56',
    toxic: [0, 'Harmless. Its leaves are covered with crystals of salt that can be scraped off.'],
    traits: 'A tree raised above the water on arched stilt roots crusted with white salt, with a glossy crown and seedlings hanging like glowing spindles.',
    lore: 'Saltroot forests protect the coasts from storm waves; the coastal kingdoms punish anyone who cuts one with exile.',
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
