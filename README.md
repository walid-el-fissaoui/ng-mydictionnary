# mydictionnary

The dictionary you build yourself. An Angular PWA with no backend: everything is stored in IndexedDB (via Dexie).

## Run

```bash
npm install
npm start            # dev server (service worker is off in dev)
npm run build        # production build in dist/ng-mydictionnary/browser
npx ng test --no-watch
```

To try the PWA (installable, offline), serve the production build:

```bash
npx http-server dist/ng-mydictionnary/browser -p 8080 -c-1
```

## Data model

- `words`: `{ id, lang, text, textNorm, meaning, collectionIds[], createdAt }`, unique per `[lang + textNorm]`
- `links`: `{ a, b }` translation pairs between any two words (many to many, works both ways)
- `collections`: `{ id, name, createdAt }`
- `settings`: primary language, secondary language, selected collection

Swapping languages only changes which side you manage; no data is duplicated or reversed.
