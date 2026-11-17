# LUDO 3D

A realistic 3D Ludo board game built with **Three.js + TypeScript**, inspired by Ludo King / Ludo Master. Play locally, against bots, or online with friends via **P2P (WebRTC)** — no game server needed.

![LUDO 3D](docs/screenshot-game.png)

## Features

- **Realistic 3D**: glossy pawns, raised tiles, soft shadows, cinematic camera that glides to the active player's side, free orbit at any time.
- **No dice cup**: the dice tumbles on the board with a natural bounce animation and lands showing the pre-decided value (host-authoritative sync for online play).
- **Full Ludo rules**: roll 6 to leave base, extra turn on 6 / capture / finish, safe stars and start cells, exact roll to enter home, triple-six forfeit, ranking for 2nd–4th places.
- **Bots**: heuristic AI with capture, escape, safe-cell and race priorities.
- **Online P2P multiplayer**: create a room, share the 5-char code, play 2–4 players over WebRTC (Trystero/nostr). Empty seats can be filled with bots. Host is authoritative; disconnected players become bots.
- **4 languages**: Português, English, Español, Français (auto-detected, switchable in Settings).
- **Clean UI**: custom SVG icon set only — no emojis anywhere.
- **Synthesized sound effects** (WebAudio, zero audio assets).

## Play

| Platform | How |
| --- | --- |
| **Web** | GitHub Pages (see *Deployments → github-pages* after the workflow runs) or `npm run preview` |
| **Android Beta APK** | `releases/tag/beta` (debug-signed, appId `com.carsaimz.ludo3d.beta`) — built automatically by GitHub Actions |
| **Desktop** | `npm run desktop` for development; `npm run dist:desktop` builds Windows/macOS/Linux installers |

## Online P2P how-to

1. One player opens *Online (P2P) → Create room* and shares the code.
2. Others use *Join room* with the code (works across web + APK builds).
3. Host presses Start. Host disconnect = game ends for guests; guest disconnect = replaced by a bot.

## Controls

- **Roll**: the round button (or the dice area) — keyboard `Space` also works on desktop.
- **Move**: tap/click any highlighted pawn (with the bouncing marker). Auto-moves when only one option.
- **Camera**: drag to orbit, pinch/scroll to zoom, camera button re-focuses the current player. Auto-camera can be disabled in Settings.

## Development

```bash
npm install
npm run dev        # vite dev server
npm test           # rules engine unit tests (vitest)
npm run build      # typecheck + production build to dist/
npx cap sync       # after changing web assets, for Android
```

Project layout:

```
src/
  game/    rules engine (pure) + AI + tests
  render/  Three.js scene, board builder, pawn, dice, cinematic camera
  net/     Trystero P2P host-authoritative layer
  ui/      HUD (DOM) and screens
  i18n.ts  pt / en / es / fr dictionaries
scripts/make_icons.py   icon pipeline (source PNG -> web/android/desktop)
electron/               desktop shell
.github/workflows/      CI, Android beta APK, desktop builds, GitHub Pages
```

## Release signing (Android)

The beta APK is debug-signed. To publish on Google Play later:

1. Generate a keystore: `keytool -genkey -v -keystore ludo3d-release.keystore -alias ludo3d -keyalg RSA -keysize 2048 -validity 10000`
2. Add repository secrets: `ANDROID_KEYSTORE_B64` (base64 of the keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. Switch `appId` in `capacitor.config.ts` to `com.ludo3d` and `appName` to `LUDO 3D`, then extend the workflow with a signed release build.

## License

MIT — see [LICENSE](LICENSE).
