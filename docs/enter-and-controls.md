# Enter hall & controls

## Exterior → interior

The app boots **outside** the badminton hall (blue sky, facade, door on the near −Z face).

| Device | How to enter |
|--------|----------------|
| **Desktop** | **Hover** the door to swing it open, then **left-click** the door. Left-click is reserved for enter (OrbitControls rotate is **right-drag** only once inside). |
| **Mobile** | **One-tap** the door (hit target is enlarged). If orbit/pinch steals the gesture, use the **Enter hall** button. |
| **Any** | **Enter hall** always calls `forceEnter()` — no raycast required, so you cannot get stuck at the door. |
| **Watch** | **Watch rally** also `forceEnter()`s, then autoplays a short **AI vs AI** point. When the point ends, tap **Play** to take human control (serve). |

Enter polish: the door opens deliberately, then the camera dollies through the doorway with a brief full-screen fade so the cut to the broadcast camera feels intentional.

## Inside (gameplay)

| Input | Action |
|--------|--------|
| **Serve** / **Hit** (on-screen) | Large touch-friendly buttons — Serve while it is your serve; Hit during a rally |
| **New rally** | Resets the rally / re-serve. Highlights when the shuttle is dead or play is stuck |
| **W A S D** / arrows | Move (human, own half) |
| **Mouse** | Aim landing target (opponent half) |
| **Click** / **Space** | Serve or hit |
| **Right-drag** | Orbit camera (OrbitControls) |
| **Middle-drag** | Pan |
| **Wheel** / pinch | Zoom |
| **Reset view** | Restore default broadcast camera |
| **R** | Reset rally (keyboard) |

### OrbitControls vs pointer outdoors

- **Exterior:** OrbitControls are mostly disabled (no left-drag orbit). Pointer / tap is for **door raycast** only so enter stays reliable on phones.
- **Interior:** OrbitControls enabled — **right-drag** rotates, wheel zooms, middle pans. Left-click stays serve/hit.

## Match clarity

HUD always shows:

- Score: **You** vs **AI**
- Serve line: who serves and which side (You = near −Z, AI = far +Z)
- Status text for serve / rally / point

After a watched rally, **Play** hands control back so mobile is never stranded on the exterior door.

## Axes

Gameplay convention: **X = width**, **Y = up**, **Z = length** (human on −Z half). BWF doubles dimensions are unchanged (13.40 × 6.10 m).
