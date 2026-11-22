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

Program använder samma IndexedDB-tillstånd och träningslogg som fria pass. Definitioner finns i `programs`, omgångar i `runs` och vald omgång i `activeRunId`. Pågående pass innehåller en kopia av planeringen och en referens till omgång/vecka/pass. Avslut sparar historik och progression i samma IndexedDB-transaktion. Programbyte skapar en ny omgång och bevarar tidigare omgångar samt historik. Det kräver att pågående pass först avslutas eller kastas. Starta ny omgång efter sista passet görs uttryckligen av användaren.

JSON-formatet visas i `examples/program.json` (ett litet demonstrationsprogram, inte PPLUL). Importera genom Program → välj fil → kontrollera alla veckor → Bekräfta import. Program måste ha ett stabilt `id`, `name` och en ordnad lista `weeks`. Varje vecka har `name` och `sessions`; varje pass har `name` och `exercises`. Övningar har `name`, `sets`, `totalReps` och valfritt `repsPerSet`. Den uttryckliga repetitionsfördelningen måste ha rätt antal set och summera till totalmålet. När totalmålet är ojämnt delbart och fördelning saknas visas endast totalmålet. Importen hittar dubbletter med samma id eller samma normaliserade innehåll. Gränser: 5 MB, 104 veckor, 100 pass per vecka och 100 övningar per pass.

PPLUL finns i `programs/FORMA_PPLUL_6_veckor.json` och väljs med Välj PPLUL i Program. Den lokala filen byggs in i appen. Konverteraren stöder även det platta formatet med numeriska `weeks`, `sessionsPerWeek` och `workouts` med `week`, `session`, `focus` och `exercises`. Den kontrollerar att alla pass finns exakt en gång. Numeriska repsPerSet blir uttryckliga setmål; null lämnas ospecificerat. Alla 30 passen verifieras mot källfilen i testerna. Källfilens avskrift bör även kontrolleras mot originalet innan användning. Alla importerade program kan exporteras från programdetaljen.

Säkerhetskopior innehåller program, alla omgångar och pågående pass. Äldre version 1-kopior utan programfält får tomma programlistor vid återställning. Återställning av backup har fortsatt sin befintliga funktion: den ersätter tillståndet efter bekräftelse. Exportera först om aktuell historik ska behållas.

Manuell kontroll:
1. Importera `examples/program.json`, granska ordningen och totalmålet 31, bekräfta. Försök importera igen: dubbletten ska avvisas.
2. Välj program, starta program och starta pass. Registrera vikt och faktiska reps med Markera set klart. Stäng och öppna appen: Fortsätt pass ska visa sparade set. Fält som ännu inte registrerats som set sparas inte.
3. Avsluta och spara. Kontrollera datum och nästa pass i vecka 2, samt resultatet i Historik och Utveckling.
4. Avsluta sista passet. Kontrollera färdigmarkering; starta ny omgång och verifiera att gamla resultat finns kvar.
5. Importera ett annat program och byt. Kontrollera att historik och tidigare omgångar finns kvar. Programbyte ska vara avstängt under pågående pass.
6. Exportera backup med pågående pass. Återställ den och kontrollera set, program och framsteg. Prova också en äldre backup på en separat webbläsarprofil.
7. Testa ogiltig JSON, saknade fält och felaktig repsPerSet. Testa mobilvy och offline efter första laddningen av produktionsbygget.

`npm test` kör lokal granskningskontroll och programtester utan nya paket. Lagringstestet använder en liten IndexedDB-testdubbel; verklig beständighet, mobil interaktion och service worker behöver även manuell webbläsarkontroll. Godkänd lokal källkodsgranskning är inte bevis på fullständig säkerhet.
