# AGENTS.md

Riktlinjer för all utveckling i det här projektet (Kalle Frågesport).

## TypeScript överallt

- All kod skrivs i **TypeScript** – både frontend och backend.
- Ingen ren JavaScript i källkoden. `.js`-filer hör bara hemma i byggoutput (t.ex. `dist/`).
- Kör med `strict`-läge påslaget. Undvik `any`; använd riktiga typer.

## TDD är obligatoriskt

All utveckling sker enligt **Test-Driven Development**, både i frontend och backend. Följ red–green–refactor:

1. **Red** – skriv ett test som beskriver det önskade beteendet. Kör det och se att det misslyckas.
2. **Green** – skriv minsta möjliga kod för att få testet att passera.
3. **Refactor** – städa upp koden medan alla tester fortsätter att passera.

Regler:

- Skriv aldrig produktionskod utan att det finns ett misslyckande test som motiverar den.
- Varje ny funktion eller buggfix börjar med ett test.
- Alla tester ska vara gröna innan arbete anses klart.
- För ändringar som uppenbart inte behöver tester behöver det inte tvingas fram några tester.

## Databas och migreringar

- **Starta inte databasen** (t.ex. `docker compose up` / `podman compose up`) åt användaren.
- **Kör inte migreringarna** (t.ex. `npm run migrate`) åt användaren.
- Användaren kör och testar detta manuellt själv. Skriv koden/migreringarna och låt användaren köra dem.

## Sammanfattning

- ✅ TypeScript (strict) – frontend och backend
- ✅ TDD (red–green–refactor) för all kod
- ❌ Ingen produktionskod utan test först
- ❌ Ingen ren JavaScript i källkoden
- ❌ Starta aldrig databasen eller kör migreringar åt användaren – det sköter hen manuellt
