# Kalle Frågesport

Kalle Frågesport är en webbapp där du kan bläddra bland frågesportsfrågor och
visa rätt svar. Det går också att skapa ett konto. En administratör kan lägga
till och redigera frågor samt ta fram förslag på uppdaterade svar med hjälp av
OpenAI.

Projektet består av tre delar:

- **Frontend:** det du ser i webbläsaren, byggt med Angular.
- **Backend:** servern som hanterar frågor, användare och inloggning, byggd med
  Express.
- **Databas:** PostgreSQL, som körs i Docker eller Podman.

## Kom igång – steg för steg

Instruktionerna är skrivna för dig som inte har arbetat med kod tidigare. Du
behöver bara följa stegen i ordning.

### 1. Installera programmen som behövs

#### Node.js 24

Installera **Node.js 24 LTS** från [nodejs.org](https://nodejs.org/). npm följer
med automatiskt och behöver inte installeras separat.

Kontrollera installationen genom att öppna Terminal (macOS/Linux), PowerShell
(Windows) eller terminalen i din kodeditor och skriva:

```sh
node --version
npm --version
```

Den första raden ska visa `v24.x.x`. Projektet kräver minst Node 20.19 eller
22.12, men Node 24 rekommenderas.

#### Docker eller Podman

Installera **ett** av följande alternativ:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Podman Desktop](https://podman-desktop.io/)

Starta programmet efter installationen och låt det fortsätta köra i bakgrunden.
Du behöver inte skapa någon container manuellt.

Kontrollera installationen med ett av dessa kommandon:

```sh
docker --version
```

eller:

```sh
podman --version
```

### 2. Hämta projektet

Om du har fått projektet som en zip-fil: packa upp filen och öppna den
uppackade mappen i en terminal.

Om du använder Git kan du i stället skriva:

```sh
git clone https://github.com/Drachbar/kalle-fragesport.git
cd kalle-fragesport
```

Alla följande instruktioner utgår från att terminalen står i projektets
huvudmapp, alltså mappen `kalle-fragesport`.

### 3. Installera projektets paket

Frontend och backend har var sin uppsättning paket. Installera båda:

```sh
cd backend
npm ci
cd ../frontend
npm ci
cd ..
```

Detta behöver normalt bara göras första gången, eller när projektets paket har
ändrats.

### 4. Starta databasen

Kontrollera först att Docker Desktop eller Podman Desktop körs.

Med Docker, kör detta från projektets huvudmapp:

```sh
docker compose up -d
```

Med Podman använder du i stället:

```sh
podman compose up -d
```

Flaggan `-d` betyder att databasen fortsätter köra i bakgrunden. Första gången
kan starten ta någon minut eftersom PostgreSQL behöver hämtas.

Du kan kontrollera att databasen körs med:

```sh
docker compose ps
```

eller:

```sh
podman compose ps
```

Tjänsten `db` ska visas som startad eller `healthy`.

### 5. Starta backend

Öppna ett **nytt terminalfönster**, gå till projektmappen och skriv:

```sh
cd backend
cp .env.example .env
npm run dev
```

På Windows PowerShell använder du detta kopieringskommando i stället:

```powershell
Copy-Item .env.example .env
```

Backend ansluter till den lokala databasen och skapar databastabellerna
automatiskt vid start. När du ser följande är servern redo:

```text
Servern lyssnar på http://localhost:3000
```

Låt terminalfönstret vara öppet.

### 6. Starta frontend

Öppna ytterligare ett **nytt terminalfönster**, gå till projektmappen och
skriv:

```sh
cd frontend
npm start
```

När bygget är klart, öppna [http://localhost:4200](http://localhost:4200) i en
webbläsare. Nu ska Kalle Frågesport vara igång.

## Nästa gång du vill starta projektet

Du behöver inte installera om paketen. Starta bara Docker Desktop eller Podman
Desktop och kör följande i tre terminalfönster:

1. Databas, från projektets huvudmapp: `docker compose up -d` eller
   `podman compose up -d`.
2. Backend, från mappen `backend`: `npm run dev`.
3. Frontend, från mappen `frontend`: `npm start`.

Öppna sedan [http://localhost:4200](http://localhost:4200).

## Skapa ett administratörskonto

Vanliga konton kan skapas via länken **Skapa konto** i appen. För att kunna
lägga till och redigera frågor behöver du ett administratörskonto.

Se till att databasen körs. Öppna sedan en ny terminal i mappen `backend` och
kör kommandot nedan. Byt ut e-postadressen och lösenordet mot dina egna:

```sh
npm run create-admin -- admin@example.com ett-langt-losenord
```

Lösenordet måste innehålla minst åtta tecken. Logga därefter in i appen med
uppgifterna du valde.

## OpenAI-funktionen (valfri)

Appens vanliga frågesport fungerar utan ett OpenAI-konto. En OpenAI API-nyckel
behövs bara om en administratör vill använda funktionen som tar fram förslag på
uppdaterade svar.

Lägg i så fall till nyckeln i `backend/.env`:

```dotenv
OPENAI_API_KEY=din-api-nyckel
```

Starta om backend efter ändringen. Lägg aldrig upp `.env` eller API-nyckeln på
GitHub och dela inte nyckeln med andra.

## Stoppa projektet

Stoppa frontend och backend genom att trycka `Ctrl+C` i deras terminalfönster.

Stoppa databasen med något av följande kommandon från projektets huvudmapp:

```sh
docker compose down
```

eller:

```sh
podman compose down
```

Frågorna och användarna finns kvar till nästa start. Om du även tar bort
volymen med `down -v` raderas all lokal data permanent.

## Vanliga problem

### `node` eller `npm` hittas inte

Node.js är inte installerat, eller så behöver terminalen startas om efter
installationen. Installera Node.js 24 och öppna ett nytt terminalfönster.

### Kan inte ansluta till databasen

Kontrollera att Docker Desktop eller Podman Desktop är startat och att `db`
visas när du kör `docker compose ps` eller `podman compose ps`. Vänta några
sekunder och starta sedan backend igen.

### Porten används redan (`address already in use`)

Projektet använder port `5432` för PostgreSQL, `3000` för backend och `4200`
för frontend. Stäng det andra program som använder porten eller stoppa en äldre
instans av projektet med `Ctrl+C`.

### `npm ci` misslyckas

Kontrollera `node --version`. Om du har en äldre Node-version, installera Node
24 och försök igen. Kontrollera också att du kör kommandot inuti rätt mapp:
`backend` respektive `frontend`.

### Podman säger att någon compose-provider saknas

Öppna Podman Desktop och installera Compose via **Settings > Resources >
Compose**. Kör sedan `podman compose up -d` igen.

## Kommandon för utvecklare

Kör kommandona i den del av projektet som de gäller:

```sh
# Backend
cd backend
npm test
npm run build

# Frontend
cd ../frontend
npm test
npm run build
```

Källkoden är skriven i TypeScript med strict-läge. Nya funktioner och
buggfixar utvecklas testdrivet enligt red–green–refactor.

## Driftsättning i produktion

Det här avsnittet är för dig som vill hosta appen på en egen server (t.ex.
Ubuntu) bakom nginx. Den lokala `compose.yaml` används bara för utveckling – i
produktion förutsätts en separat, redan körande PostgreSQL-databas.

### Översikt

Tre delar körs samtidigt, med nginx som enda sak som är öppen mot internet:

```text
                    ┌─────────── nginx (TLS, port 443) ───────────┐
   Webbläsare  ───► │  /api/ + /socket.io/  ──►  backend  :3000   │
                    │  allt annat           ──►  frontend :4000   │
                    └─────────────────────────────────────────────┘
                                   backend ──► PostgreSQL (separat server)
```

- **backend** – Express + Socket.IO, körs som container (`backend/Containerfile`).
  Kör databasmigreringarna automatiskt vid uppstart.
- **frontend** – Angular **SSR**-server, körs som container
  (`frontend/Containerfile`). Hämtar en fråga på servern så att den finns i
  HTML:en (bra för SEO och delningslänkar).
- **PostgreSQL** – körs separat; backend ansluter via `DATABASE_URL`.

### Miljövariabler

Sätt dessa vid körning (inte i imagen). Backend:

| Variabel | Krävs | Beskrivning |
|----------|-------|-------------|
| `NODE_ENV` | ja | `production` (slår på secure-cookies och `trust proxy`) |
| `SESSION_SECRET` | ja | Hemlighet för sessions-cookien. Backend vägrar starta utan den |
| `DATABASE_URL` | ja | T.ex. `postgres://user:pwd@db-server:5432/kalle` |
| `APP_PUBLIC_URL` | ja | Publik frontend-URL för verifieringsmejl, t.ex. `https://kalle.example.com` |
| `API_KEY_ENCRYPTION_KEY` | nej* | Krävs om admins ska kunna spara egna OpenAI-nycklar |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | nej | Delad OpenAI-nyckel för AI-uppdatering av svar |
| `SMTP_HOST` / `SMTP_FROM` | nej | SMTP för kontaktformulär och verifieringsmejl. Utan SMTP loggas mejl lokalt |
| `PORT` | nej | Default `3000` |

Frontend (SSR):

| Variabel | Krävs | Beskrivning |
|----------|-------|-------------|
| `NG_ALLOWED_HOSTS` | ja | Din publika domän, t.ex. `kalle.example.com`. Utan den svarar SSR `400` (Angulars SSRF-skydd) |
| `BACKEND_INTERNAL_URL` | ja | Var SSR-servern når backend internt, t.ex. `http://backend:3000` |
| `PORT` | nej | Default `4000` |

Generera hemligheter med:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1. Bygg containrarna

```sh
cd backend && podman build -t kalle-backend -f Containerfile .
cd ../frontend && podman build -t kalle-frontend -f Containerfile .
```

### 2. Kör med ett gemensamt nätverk

Containrarna måste ligga på samma podman-nätverk för att nå varandra på namn
(`BACKEND_INTERNAL_URL=http://backend:3000` pekar på backend-containerns namn):

```sh
podman network create kalle-net

podman run -d --name backend --network kalle-net \
  -p 127.0.0.1:3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=<hemlig> \
  -e DATABASE_URL=postgres://user:pwd@db-server:5432/kalle \
  -e APP_PUBLIC_URL=https://kalle.example.com \
  -e API_KEY_ENCRYPTION_KEY=<hemlig> \
  kalle-backend

podman run -d --name frontend --network kalle-net \
  -p 127.0.0.1:4000:4000 \
  -e NG_ALLOWED_HOSTS=kalle.example.com \
  -e BACKEND_INTERNAL_URL=http://backend:3000 \
  kalle-frontend
```

Portarna binds till `127.0.0.1` – bara nginx ska nå dem, inte internet direkt.

> **Tips:** för autostart vid omstart och inbyggd healthcheck, använd Quadlet
> (`.container`-filer som blir systemd-tjänster) i stället för lösa
> `podman run`-kommandon.

### 3. nginx som proxy

Ett färdigt server-block finns i [`deploy/nginx/kalle.conf`](deploy/nginx/kalle.conf).
Det proxar `/api/` och `/socket.io/` till backend och allt annat till Angular
SSR-servern. Lägg filen i `/etc/nginx/conf.d/` (eller `sites-available/` +
symlänk), justera `server_name`/`NG_ALLOWED_HOSTS`, och kör `sudo nginx -t`.

TLS termineras av en proxy framför nginx, så nginx lyssnar på vanlig HTTP.
Configen vidarebefordrar uppströmsproxyns `X-Forwarded-Proto` – det är viktigt:
backend sätter i produktion `trust proxy` och `secure`-cookies, så den måste se
`proto=https` för att inloggningen ska fungera. `/socket.io/` har dessutom
WebSocket-headrarna, annars slutar AI-statusuppdateringarna fungera.

### 4. Databas och migreringar

Backend kör migreringarna automatiskt vid uppstart, så "deploya = starta
backend-containern". Två saker att säkerställa:

- Din PostgreSQL måste tillåta anslutning från serverns IP (brandvägg/pg_hba).
- Databasen ska vara nåbar **innan** backend startar.

### Driftsättnings-checklista

- [ ] PostgreSQL körs och är nåbar via `DATABASE_URL`
- [ ] `SESSION_SECRET` och ev. `API_KEY_ENCRYPTION_KEY` genererade
- [ ] Båda imagerna byggda
- [ ] Gemensamt podman-nätverk skapat, containrar startade och bundna till `127.0.0.1`
- [ ] `NG_ALLOWED_HOSTS` satt till den publika domänen (matchar nginx `server_name`)
- [ ] `deploy/nginx/kalle.conf` på plats, `nginx -t` ok, TLS terminerad uppströms
- [ ] Adminkonto skapat (`npm run create-admin` mot produktionsdatabasen)

## Projektstruktur

```text
kalle-fragesport/
├── backend/                  Express-API, databaslogik och migreringar
│   └── Containerfile         Bygger backend-imagen (produktion)
├── frontend/                 Angular-appen som visas i webbläsaren
│   └── Containerfile         Bygger Angular SSR-imagen (produktion)
├── deploy/
│   ├── quadlet/              systemd/Quadlet-units för att köra containrarna
│   └── nginx/kalle.conf      Färdigt nginx-server-block (proxy)
├── compose.yaml              Lokal PostgreSQL-databas (endast utveckling)
└── README.md                 Den här guiden
```
