# Vite base & GitHub Pages

## Live URL

<https://noowxela.github.io/badminton_3d/>

## Base path

`vite.config.js` sets:

```js
base: '/badminton_3d/',
```

That matches the GitHub Pages project site path (`/<repo>/`). Asset loads (and any future `public/assets/court.glb`) use `import.meta.env.BASE_URL` so they resolve under `/badminton_3d/` instead of the domain root.

Locally, `npm run dev` still works; Vite serves with the same base. Open the printed URL (often `http://localhost:5173/badminton_3d/`).

## Deploy

Push to `main`. The workflow under `.github/workflows/` builds with Vite and publishes `dist/` to GitHub Pages.

```bash
npm install
npm run build   # must pass before ship
git push origin main
```

Do **not** force-push `main`.

## Hard-refresh after deploy

Browsers cache hashed bundles under `dist/assets/`. After a Pages deploy, hard-refresh (or clear cache) so you pick up the new enter fade, touch buttons, and Watch rally UI.
