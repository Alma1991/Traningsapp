# Permanenta projektregler för FORMA

Reglerna gäller hela projektet och all vidareutveckling.

- Använd React, TypeScript och Vite. Behåll en mobilanpassad PWA med lokala appresurser och offlinefunktion.
- Lagra all träningsdata lokalt i IndexedDB. Använd inte localStorage, sessionStorage eller cookies för träningsdata.
- Använd inga externa API:er, externa databaser, molntjänster eller inloggning.
- Skicka aldrig användardata till externa servrar. Ingen analytics, telemetri, spårning eller fjärrloggning får införas.
- Använd inga externa CDN, typsnitt eller bildresurser. Alla resurser som appen använder ska ingå lokalt.
- Fråga användaren innan nya npm-paket installeras, även utvecklingspaket. Föredra befintliga verktyg och webbläsarens inbyggda API:er.
- Behåll befintliga funktioner vid vidareutveckling: pass, övningar, scheman, set, historik, rekord, backup och lokal lagring.
- Kör `npm test` och `npm run build` efter ändringar som påverkar appen eller granskningen. Åtgärda fel; kringgå inte granskningen för att få bygget att lyckas.
- Håll granskningen lokal. Använd inga externa granskningstjänster.
- Normal nätverksanvändning av utvecklingsverktyg (npm, Vite och pakethämtning) är tillåten, men den får inte byggas in som extern kommunikation i appen. Regeln om godkännande av nya paket gäller fortfarande.
- `node_modules` och `dist` ska undantas från källkodsgranskningen.
- När kontrollen ändras ska tester omfatta både förbjudna integrationer och tillåtna lokala resurser. Dokumentera kontrollens begränsningar; ett godkänt resultat är inte bevis på fullständig säkerhet.

## Lokal verifiering

`npm run audit:local` granskar appkällor och körningsberoenden. `npm run build` kör granskningen först och stoppar vid fynd. `npm test` testar själva granskningen med Node.js inbyggda testverktyg. Inga av dessa kontroller behöver externa tjänster.
