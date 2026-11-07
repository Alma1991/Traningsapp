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
