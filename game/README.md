# MONSTER MASH: Slingshot Siege

A 16-bit physics launcher for the RUN.world **Monster Mash** game jam. Built with Phaser 3, Matter.js, Vite, TypeScript, and the RUN SDK.

See the full player and mechanics guide in the root [README.md](../README.md).

## Quick Start

```bash
npm install            # Install dependencies
npm run dev            # Start local dev server at http://localhost:5173
npm run check          # Run schema checks and TypeScript checks
npm run build          # Production build to dist/
```

## Architecture & Structure

- `src/scenes/` - Phaser scenes (Title, Map, Loadout, Shop, Battle, Results, Credits)
- `src/battle/` - Matter.js rigid-body physics, sling simulation, combat, and scoring
- `src/audio/` - Procedural chiptune synthesizer and sound effect generators
- `src/art/` - Mash32 palette, font5x7 bitmap renderer, and procedural 16-bit pixel textures
- `src/platform/` - RUN SDK adapter and local development mock
- `public/data/` - Content definitions (`content.json`), engine config (`config.json`), and levels (`levels/`)
- `schemas/` - JSON schemas for content, config, save, and levels
