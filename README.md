# Hexagon Miner (Web First)

Minimal stack:
- Phaser
- TypeScript
- esbuild

No framework wrappers are used.

## Game Rules Implemented

- Default map size is 6 columns x 12 rows.
- Hex neighborhood follows odd-row offset logic.
- Left click reveals a tile.
- Revealed non-mine tile shows count of neighboring mines.
- If count is zero, neighboring safe tiles are auto-revealed.
- Right click toggles flag.
- Clicking a mine ends the game.
- Win when all safe tiles are revealed, or all mines are correctly flagged.
- Timer tracks seconds while game state is playing.

## Commands

Install dependencies:

```bash
npm install
```

Build bundle:

```bash
npm run build
```

Watch mode during development:

```bash
npm run watch
```

Serve static app (optional):

```bash
npm run serve
```

Open in browser:

- http://localhost:8080

## Project Structure

- `serverexpress.js` (not necessary, static files open directly in browser)
- `website/index.html`
- `website/styles.css`
- `website/dist/game.js` (generated)
- `src/main.ts`
- `src/ui/HexMinesScene.ts`
- `src/game/HexMinesGame.ts`
- `src/game/hexLayout.ts`
- `src/game/types.ts`
- `scripts/build.mjs`

## Android Later (Capacitor)

When web gameplay is stable, add only these packages:

```bash
npm install @capacitor/core
npm install -D @capacitor/cli @capacitor/android
npx cap init
```

Set Capacitor webDir to `website` or `website/dist` depending on your preferred hosting layout, then:

```bash
npx cap add android
npx cap sync android
npx cap open android
```
