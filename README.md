# Badminton Doubles Simulator v1

Lightweight **Vite + Three.js** doubles badminton court sim for Alex.

- BWF doubles court: **13.40 m × 6.10 m**
- Net: posts **1.55 m**, center **1.524 m**
- Scale: **1 Blender unit = 1 meter** = 1 Three.js unit
- 1 human + 3 simple AI, rally-point scoring (21, win by 2, cap 30)

## Quick start

```bash
cd /Users/alexwoon/Documents/github/87_undefined/badminton_3d
npm install
npm run export-court   # optional if court.glb already present
npm run dev
```

Open the URL Vite prints (often `http://localhost:5173/badminton_3d/` because of the Pages base).

## Live demo and deployment

Live demo: <https://noowxela.github.io/badminton_3d/>

GitHub Pages deploys from GitHub Actions on every push to `main`.

Production build:

```bash
npm run build
npm run preview
```

See **[docs/deploy-pages.md](docs/deploy-pages.md)** for Vite `base: '/badminton_3d/'` and Pages notes.

## Enter the hall

App starts **outside** a badminton-hall building.

- **Desktop:** hover the door to open it, **click** to walk inside (door-open + fade polish).
- **Mobile:** one-tap the door, or use **Enter hall** (`forceEnter`) so you never get stuck.
- **Watch rally:** from exterior, autoplays a short AI vs AI point, then **Play** to take control.

Full detail: **[docs/enter-and-controls.md](docs/enter-and-controls.md)**.

## Controls

| Input | Action |
|--------|--------|
| **Hover door** (desktop, outside) | Door opens |
| **Click / tap door** (outside) | Enter hall → gameplay |
| **Enter hall** button | Force enter (no raycast) |
| **Watch rally** button | Enter + AI vs AI demo → **Play** CTA |
| **Serve / Hit** (on-screen) | Touch-friendly serve & hit once inside |
| **New rally** | Reset rally when shuttle is dead / stuck |
| **W A S D** / arrows | Move (human, own half) |
| **Mouse** | Aim landing target (opponent half) |
| **Click** / **Space** | Serve or hit (inside, play mode) |
| **Right-drag** | Orbit camera (inside) |
| **Middle-drag** | Pan camera |
| **Wheel** | Zoom |
| **Reset view** (HUD) | Restore default broadcast camera |
| **R** | Reset rally / re-serve |

Scoring: rally point. First to 21 with a 2-point lead; continues until lead of 2 or **30** cap.

HUD always shows **You vs AI**, who serves, and side (You −Z / AI +Z).

## Project layout

```
badminton_3d/
├── blender/build_court.py   # BWF court + stubs → GLB
├── docs/                    # enter / controls / Pages notes
├── scripts/export-court.sh
├── public/assets/court.glb  # exported asset
├── src/
│   ├── main.js              # scene, loop, input, enter flow
│   ├── building/            # exterior hall + door enter
│   ├── court/               # dimensions, procedural hall court
│   ├── physics/shuttle.js   # gravity + drag arc
│   ├── players/player.js    # human + stubs
│   ├── ai/simpleAi.js       # cover / hit heuristics
│   ├── game/                # match + scoring
│   └── ui/hud.js
└── package.json
```

## Docs

- [Enter hall, door hover vs tap, OrbitControls](docs/enter-and-controls.md)
- [Vite base + GitHub Pages](docs/deploy-pages.md)

## Re-export court from Blender

Headless (recommended):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_court.py
```

Or:

```bash
npm run export-court
```

Override Blender path:

```bash
BLENDER=/path/to/Blender npm run export-court
```

Output: `public/assets/court.glb`.

### Scale & axes notes

- Script builds the court with **1 unit = 1 m**.
- Blender: width along **X**, length along **Y**, up along **Z**.
- Export uses `export_yup=True` so Three.js gets **Y-up**.
- Gameplay convention after load: **X = width**, **Y = up**, **Z = length** (human on −Z half).
- Baked Blender player meshes are **hidden** at runtime; live players are procedural so AI/human stay in sync. The GLB still provides floor, lines, net, posts, and markers.

If the GLB is missing, the app falls back to a procedural court so `npm run dev` still works.

## Verification (v1)

```bash
# 1) Export
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_court.py

# 2) Install + build
npm install
npm run build
```

## Known limits (v1)

- No photoreal materials, mocap, or multiplayer
- Shuttle physics is lite (gravity + quadratic drag, no cork spin / feather)
- AI is reactive cover + random deep/cross targets — not tactical doubles
- Partner AI on your team is simple; you control only one player
- Net collision is a thin plane test, not full mesh contact
- Serve rules (service courts, faults) are simplified
- Camera defaults to a broadcast elevated view; orbit via right-drag (clamped so the court stays framed)
- Soft shadows use a smaller map on touch devices; wood-hall point lights are toned down on phones
- Watch rally plays one spectator point then waits for **Play** (not a full AI match)

## License

Personal / project use for Alex Woon.
