# FORMA

Fristående, mobilanpassad träningsapp med React, TypeScript och Vite. All användardata lagras i IndexedDB. Inga externa API:er, konton, molntjänster, webbtypsnitt eller analysverktyg används.

## Kör lokalt

```sh
npm install
npm run dev
```

Öppna adressen som Vite visar. Produktionsbygge: `npm run build`. Lokal kontroll av produktionsversionen: `npm run preview`.

## Funktioner

- Egna övningar, träningsmallar och veckodagar för schemaläggning.
- Fritt pass eller start från mall. Registrera och ta bort set med vikt och repetitioner.
- Pågående pass sparas vid varje ändring och kan återupptas efter omladdning.
- Historik, träningsvolym och tyngsta registrerade vikt per övning.
- JSON-export och validerad import under Inställningar. Import ersätter nuvarande data efter bekräftelse.

Startsidan visar verklig data, utan påhittade träningsresultat. Ett litet övningsbibliotek finns från början. Data hör till webbläsarens origin: samma adress och port krävs för att se samma data. Exportera innan adress, webbläsare eller enhet byts.

## PWA-förberedelser

Manifest, SVG-ikon och egen service worker ingår utan extra paket. Service worker aktiveras bara i produktionsbygget på HTTPS eller localhost. Efter första besöket cachas appens hämtade filer för offlineanvändning. Kör `npm run build` och `npm run preview`, öppna appen och vänta på service worker-aktivering innan offlinekontroll. Installerbarhet på Android och offlinefunktion behöver verifieras på fysisk enhet; komplettera med 192×192 och 512×512 PNG-ikoner för bredare installationsstöd. Det här är förberedelse, inte en verifierad Android-PWA.

Rensad webbläsardata kan radera träningshistoriken. Exportera säkerhetskopior regelbundet. Säkerhetskopior innehåller träningsdata i klartext.

Node.js 18.20.4 stöds av de valda grundversionerna. Inga andra körningsberoenden har lagts till. `presentation.html` är den fristående konceptpresentationen.

## Projektregler och lokal granskning

Permanenta regler finns i `AGENTS.md`. Kör `npm run audit:local` för lokal källkodsgranskning och `npm test` för granskningsskriptets tester. `npm run build` kör granskningen före TypeScript och Vite och avbryter vid fynd eller granskningsfel. Resultatet anger filnamn, radnummer och regel. Inga nya paket eller externa granskningstjänster används; TypeScript som redan finns i projektet används för att läsa JavaScript/TypeScript.

Granskningen söker efter externa URL:er, fjärrresurser, vanliga nätverkskanaler, dynamiska fetch-anrop, integrationsimporter, alternativ webbläsarlagring och dynamisk kod. Körningsberoenden har en uttrycklig tillåtelselista med React och React DOM. Andra körningspaket stoppas tills de har godkänts och granskats. SVG-namnrymder och relativa resurssökvägar är tillåtna. Appens befintliga service worker har ett begränsat undantag för cache av samma origins Request-objekt.

`node_modules`, `dist`, `.git`, `coverage`, `scripts` och `tests` undantas, liksom Vites utvecklingskonfiguration, TypeScript-konfiguration och låsfil. Paketmanifestets beroenden granskas separat. Utvecklingsverktygens normala nätverksanvändning blockeras inte. Lägg inte appkod i undantagna mappar och importera inte utvecklingsskript från appen.

### Begränsningar

Det här är en konservativ statisk kontroll, inte en säkerhetsgaranti eller en nätverksbrandvägg. Den kan ge falska positiva fynd, exempelvis en extern URL som bara visas som text. Relativa fetch-anrop tillåts som resurshämtning, så kontrollen kan inte avgöra om en relativ adress i verkligheten går till ett API. Den kan inte säkert upptäcka alias till nätverksfunktioner, sammansatta eller kodade adresser, indirekt exekvering, service worker-logik som flyttats runt, alla möjliga HTML-attribut eller skadligt beteende i tredjepartspaket. Undantaget för service worker bygger på ett identifierat kodmönster och bevisar inte att alla kodvägar skyddas. Importer över granskningsgränsen och symboliska länkar följs inte.

Kontrollen analyserar inte paketens innehåll eller produktionsbundlen, verifierar inte manuellt paketgodkännande och kan inte bevisa att träningsdata faktiskt sparas korrekt i IndexedDB. Mobilanpassning, installation, offlinebeteende och bevarande av befintliga funktioner kräver egna funktionskontroller. Ändrade regler och undantag ska alltid granskas tillsammans med appändringen.

## Träningsprogram

Program använder samma IndexedDB-tillstånd och träningslogg som fria pass. Definitioner finns i `programs`, omgångar i `runs` och följda omgångar i `followedRunIds`. Vid läsning av äldre data blir omgången i `activeRunId` ett följt program. Pågående pass innehåller en kopia av planeringen och en referens till omgång, vecka och pass. Avslut sparar historik och progression i samma IndexedDB-transaktion.

Programmen i projektets mapp `programs/` visas direkt under **Program → Välj program**. PPLUL (6 veckor, 30 pass) och FORMA Hybrid (6 veckor, 24 pass) ingår. Använd **Följ program** för att lägga till ett program under **Mina träningsprogram** på Översikt. Varje följt program har egen progression. Om du slutar följa ett program sparas omgången och återupptas när du följer det igen. Efter sista passet kan du välja att starta en ny omgång. Första gången du följer ett katalogprogram sparas dess definition tillsammans med omgången. Om katalogen har samma id eller innehåll visas den sparade versionen.

Lägg till ett program i VS Code genom att skapa en JSON-fil direkt i `programs/`. Använd `examples/program.json` som mall. Exempelfilen ligger utanför katalogen och visas först om den kopieras dit. Ge programmet ett unikt och stabilt `id`, ett `name` och en ordnad lista `weeks`. Varje vecka har `name` och `sessions`, varje pass har `name` och `exercises`. Övningar har `name`, `sets`, `totalReps` och valfritt `repsPerSet`. Den uttryckliga fördelningen måste ha rätt antal set och summera till totalmålet. Gränserna är 104 veckor, 100 pass per vecka och 100 övningar per pass.

PPLUL-filen använder också det stödda platta formatet med numeriska `weeks`, `sessionsPerWeek` och `workouts` med `week`, `session`, `focus` och `exercises`. Alla pass måste finnas exakt en gång. Numeriska `repsPerSet` blir uttryckliga setmål och `null` lämnas ospecificerat. Alla 30 passen verifieras mot källfilen i testerna. Program kan exporteras från programdetaljen.

Säkerhetskopior innehåller program, alla omgångar och pågående pass. Äldre version 1-kopior utan programfält får tomma programlistor vid återställning. Återställning av backup har fortsatt sin befintliga funktion: den ersätter tillståndet efter bekräftelse. Exportera först om aktuell historik ska behållas.

Manuell kontroll:
1. Öppna Program med en tom profil. Kontrollera att PPLUL visas direkt under Välj program med 6 veckor och 30 pass.
2. Välj program, starta program och starta pass. Registrera vikt och faktiska reps med Markera set klart. Stäng och öppna appen: Fortsätt pass ska visa sparade set. Fält som ännu inte registrerats som set sparas inte.
3. Avsluta och spara. Kontrollera datum och nästa pass i vecka 2, samt resultatet i Historik och Utveckling.
4. Avsluta sista passet. Kontrollera färdigmarkering; starta ny omgång och verifiera att gamla resultat finns kvar.
5. Följ PPLUL och FORMA Hybrid samtidigt. Kontrollera att framsteg bara ändras för programmet vars pass avslutas. Sluta följa ett program, bekräfta och följ det igen för att kontrollera att progressionen finns kvar.
6. Exportera backup med pågående pass. Återställ den och kontrollera set, program och framsteg. Prova också en äldre backup på en separat webbläsarprofil.
7. Testa mobilvy och offline efter första laddningen av produktionsbygget.

`npm test` kör lokal granskningskontroll och programtester utan nya paket. Lagringstestet använder en liten IndexedDB-testdubbel; verklig beständighet, mobil interaktion och service worker behöver även manuell webbläsarkontroll. Godkänd lokal källkodsgranskning är inte bevis på fullständig säkerhet.
