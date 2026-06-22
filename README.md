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

## Projektstruktur

```text
kalle-fragesport/
├── backend/       Express-API, databaslogik och migreringar
├── frontend/      Angular-appen som visas i webbläsaren
├── compose.yaml   Konfiguration för den lokala PostgreSQL-databasen
└── README.md      Den här guiden
```
