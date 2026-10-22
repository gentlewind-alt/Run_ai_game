# Weapon-ability sound plan (for later)

Status: plan only. `src/audio/sfx.ts` already has WebAudio stand-ins (`saw`, `thunder`, `quake`, `omnitrix`, `brahmastra`, `thwip`, `repulsor`, `twang`, `ping`). This file says what replaces or layers on them.

## Routing and rules
1. Hero abilities (legendary and epic): RUN CLI `rundot generate sfx`, run `rundot generate estimate sfx` first and ask the owner before spending credits. Short one-shots, 0.5 to 2.5 s, mono, 22 kHz.
2. Everything else: keep WebAudio synthesis in `sfx.ts` (zero download, instant).
3. Files go in `game/public/audio/sfx/<id>.mp3`, preloaded in BootScene, decoded once into an `AudioBuffer` map; a missing file falls back to the synth stand-in so the game never goes silent.
4. One shared gain ceiling (-6 dB) and ducking: a hero ability ducks music by 40% for its length; no more than 3 one-shots at once (oldest is dropped).
5. Honour the mute setting (`sfx.setMuted`) and the `?mock=1` and headless paths (no AudioContext: all calls no-op).
6. Data owns names: each weapon row gets `sfx: { tap, hit?, loop? }` ids so a new weapon needs no code change.

## Per ability
| Weapon | Tap | Hit or tail | Loop |
|---|---|---|---|
| Militia Blade, Rolling Millstone | saw whine rising | stone crunch per tick (millstone) | grinding roll |
| Iron Cleaver (Crater) | ground slam, sub thud | rubble crackle | none |
| Ashwood Staff (Volley) | three ember whooshes | small fire pops | none |
| Scrapheap Scattergun | shotgun crack | pellet pings | none |
| Hunters Pike (Driller) | spear whoosh | metal bite, small blast | none |
| Boomerang | whirr | return whistle | whirr while flying |
| Blast Tube (Nuke) | charge whine, flash | big boom, long tail | none |
| Horned Scepter (Hellbrand) | dark chime | fire crackle | crackle while the pool burns |
| Comet Fists | deep thud | stone rumble, falling rubble | none |
| Bulwark Disc | metal ping per bounce, pitch rising | whoosh on redirect | none |
| Skyforge Maul | sky crack, thunder | electric hum | hum while the field is up |
| Steersong Arrow | string twang, tone that bends with steering | chime on hit | none |
| Silkline Shooters | thwip | web snap | none |
| Kinetic Palms | repulsor charge | air thump | none |
| Brahmastra Arrow | rising choral chord | low boom at the end | sustained shimmer for the beam |
| Omnitrix Dial | click, rising whine | five staggered rubbery thuds, whoosh as arms leave | none |
| Pinata MIRV | paper pop | five candy cracks | none |
| Hailstorm Cauldron | slosh, pour | sizzling splats | rain hiss |
| Earthworm Drill | drill whine | muffled eruption | whine while diving |
| Chain Rod | static zap | crackle per jump | none |
| Black Hole Marble | low suck, rising pitch | collapse boom, reverse swell | drone while it pulls |

Boss stingers: boss intro sting, weak point open chime, boss defeat fanfare (one per realm, can share a base with pitch shifts).

## Build order
1. Estimate credits for the hero set (Maul, Brahmastra, Omnitrix, Black Hole, Nuke, Crater, Hellbrand): seven clips.
2. Generate in one rate-limited script (pattern: `tools/gen_realm56_sfx.sh`, retry on rate limit).
3. Add the `sfx` data fields and the buffer loader, then replace the stand-ins one by one, checking the mix with all ability buttons in one level.
4. Add a regress check: every `sfx` id in `content.json` resolves to a file or a synth stand-in.
