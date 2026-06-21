# PGlite Admin

En lokal, generell webbhanterare för projektets PGlite-databas. Den listar tabeller och metadata direkt från `information_schema` och har stöd för att visa, skapa, redigera och radera rader.

## Kör lokalt

Stoppa först backend-processen. PGlite-datakatalogen ska bara öppnas av en process åt gången.

```bash
cd pglite-admin
npm install
npm run dev
```

Öppna <http://127.0.0.1:4173>. Som standard används `../backend/pgdata`.

Annan datakatalog eller port kan väljas med miljövariabler:

```bash
PGLITE_DATA_DIR=/absolut/sökväg/till/pgdata PORT=4180 npm run dev
```

Servern binder bara till `127.0.0.1` som standard. Sätt `HOST` uttryckligen om den ska exponeras på ett annat interface. Verktyget kör inga migreringar och skapar inga tabeller.

## Kontrollera

```bash
npm test
npm run build
```
