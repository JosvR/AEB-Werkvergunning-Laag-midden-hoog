# AEB — Laag, midden of hoog risico?

**Versie 1.1.0 · 3 november 2026.** Tien nieuwe praktijkcases voor de AEB-training werkvergunningen. Deelnemers kiezen met drie knoppen: **Laag**, **Midden** of **Hoog**. Slepen is niet meer nodig; toetsenbordbediening blijft mogelijk. Vijf cases hebben een vergrootbare schematische illustratie. De startpagina gebruikt een foto van de AEB-website en de logo’s van AEB en Deltalinqs Training & Services.

De complete website staat in **`dist/`**, met `index.html` direct in die map. **U hoeft niets te installeren of te bouwen.** Geen database, eigen server, serverfuncties of persoonlijke API-sleutels.

## Hersteld in versie 1.1.0

- Slepen is geheel vervangen door drie gewone knoppen: **Laag**, **Midden** en **Hoog**, voor telefoon, tablet en computer.
- Bij tijdelijk verbindingsverlies kan de deelnemer blijven kiezen. Antwoorden blijven alleen in het geheugen van de open telefoonpagina en worden na herstel doorgestuurd. Ontvangst wordt pas gemeld na bevestiging door de trainer.
- Terugkeren naar het trainers- of deelnemersscherm, internetherstel en terugkeer uit een browserpauze starten actief verbindingsherstel.
- Een kort onderbroken verbinding wordt niet meer na één minuut definitief gewist. De hersteltermijn is nu **tien minuten**; expliciet afsluiten en wissen blijft direct werken voor bereikbare deelnemers.
- Een mislukte verbinding van een nieuwe deelnemer maakt de bestaande trainerssessie niet ongeldig. Gelijke voornamen blijven afzonderlijke deelnemers.
- De trainerspagina vraagt, waar de browser dat ondersteunt, een schermvergrendeling aan om slaapstand tijdens de zichtbare les te voorkomen. Het systeem kan achtergrondtabbladen nog steeds pauzeren of verwijderen.

## Publiceren via GitHub en Netlify

1. Open Netlify en kies **Add new project → Import an existing project → GitHub**.
2. Selecteer **JosvR/AEB-Werkvergunning-Laag-midden-hoog**.
3. Gebruik onderstaande instellingen en publiceer.

| Instelling | Waarde |
| --- | --- |
| Production branch | `main` |
| Base directory | Leeg |
| Build command | Leeg |
| Publish directory | `dist` |
| Functions / database / omgevingsvariabelen | Niet nodig |

`netlify.toml` legt de lege buildopdracht en publicatiemap al vast. Wanneer de repository aan Netlify gekoppeld is, publiceert Netlify nieuwe commits op `main` automatisch, tenzij automatisch publiceren daar is uitgezet.

Het bestand `downloads/AEB-Laag-midden-hoog-v1.1.0.zip` bevat deze korte handleiding, `netlify.toml` en de complete `dist/`. Bij handmatige publicatie uploadt u alleen de uitgepakte map `dist`.

## Gebruik in de presentatie

- Neem de vaste **Netlify-link met `?trainer=1`** op als hyperlink in de PowerPoint. Bijvoorbeeld: uw gepubliceerde hoofdlink, gevolgd door `?trainer=1`.
- De trainer opent de app, klikt **Start groepssessie** en wacht op **Groepssessie actief**.
- Toon de actuele **sessie-QR**. Met **QR-code vergroten** wordt hij schermvullend, ook voor deelnemers achterin het lokaal. Escape of de terugknop sluit de vergroting.
- Deelnemers scannen de QR, voeren hun **voornaam/roepnaam** in en klikken **Meedoen**. Handmatig aansluiten kan via **Meedoen met de groep** met de twaalf tekens van de sessiecode.
- Een sessie-QR geldt voor één les. Gebruik dus de vaste trainerlink in de PowerPoint, en toon de QR vanuit de actieve app.

## Tijdens de oefening

Deelnemers lezen de case en drukken op **Laag**, **Midden** of **Hoog**. Via Tab/Enter en de pijltjestoetsen kan de categorie met het toetsenbord worden gekozen. De keuze kan tijdens het oefenen worden gewijzigd. **Keuze ontvangen door de trainer** verschijnt pas na ontvangstbevestiging.

De trainer ziet hoeveel deelnemers verbonden zijn, hun voortgang, keuzes en de verdeling over **Laag/Midden/Hoog**. Goede antwoorden en groene markeringen blijven standaard verborgen. Selecteer alle of enkele cases en kies **Start nabespreking**. De telefoons volgen de gekozen case; antwoorden wijzigen kan tijdens die nabespreking niet. Kies **Toon goede antwoorden** om categorie en feedback zichtbaar te maken. Bij de volgende case staan antwoorden weer uit. Met **Laat de groep verder oefenen** hervat u het oefenen. **Projectieweergave** maakt de gezamenlijke bespreking rustiger.

De feedback bevat de onderbouwing, waarom andere categorieën minder passen, een relevant tekstfragment uit **33.41P Werkvergunningen** en paragraaf/paginaverwijzing. In de trainertoelichting staat ook een bespreekvraag. Dit is formatieve oefening, zonder cesuur of examenstatus. Er worden geen vragen uit examen A of B getoond.

Bij **Zelf oefenen** zijn geen groepsverbinding of naam nodig. De feedback verschijnt na tien antwoorden. Daarna kunnen onjuiste cases opnieuw worden geoefend. **Oefenvoortgang wissen** verwijdert de anonieme oefenronde.

## Afsluiten en tijdelijke gegevens

Klik na de les op **Sessie afsluiten en wissen** en bevestig. Namen en antwoorden verdwijnen uit het trainersgeheugen. Verbonden telefoons ontvangen het afsluitbericht en wissen hun gegevens. Een onbereikbare telefoon wist na tien minuten zonder trainercontact, of bij hervatten na browserpauze. Onmiddellijke wissing op een offline apparaat is niet mogelijk.

Houd de trainerspagina tijdens de les open. Een korte schermwisseling sluit de sessie niet af; bij terugkeer probeert de app de verbinding actief te herstellen. De browser kan een achtergrondpagina echter echt verwijderen en daarmee het werkgeheugen verliezen. Vernieuwen of sluiten verliest de sessie. Er is geen serverkopie of herstelbestand. De maximale sessieduur is acht uur. Zelfstandige, anonieme oefenvoortgang staat maximaal acht uur in sessionStorage van het eigen tabblad; groepsnamen en groepsantwoorden worden daar niet opgeslagen.

## Verbinding zonder eigen backend

Netlify levert uitsluitend statische bestanden. De gebundelde **PeerJS 1.5.5**-client gebruikt de publieke PeerJS Cloud voor het opbouwen van een WebRTC-verbinding. Google STUN en de publieke PeerJS TURN-dienst kunnen nodig zijn om browsers te verbinden. Antwoorden gaan versleuteld naar de trainersbrowser, eventueel via een TURN-doorverbinding. De app maakt geen externe deelnemerslijst of resultatenbestand. Verbindingsdiensten kunnen netwerkmetadata verwerken. Hun publieke verbindingsinstellingen zijn geen persoonlijke accountgeheimen.

Live deelname heeft internet nodig. Bedrijfswifi of een firewall kan WebRTC blokkeren; de gratis verbindingsdienst heeft geen beschikbaarheidsgarantie. Test na publicatie vooraf op de leslocatie met een trainer en twee telefoons. Zelf oefenen werkt zonder die live verbinding. De code heeft een limiet van tachtig deelnemers; dat is geen gemeten capaciteit of garantie.

Bronnen voor de netwerkarchitectuur: [PeerJS starten](https://peerjs.com/client/getting-started), [PeerJS Cloud](https://peerjs.com/server/cloud), [PeerJS FAQ](https://peerjs.com/client/faq).

## Inhoud en beelden

Hoofdbron: de door Jos aangeleverde **33.41P Werkvergunningen**, revisie **07-05-2026**, vooral §4.2–4.3, p.7–9. De verlener heeft volgens §4.3 het laatste woord. De tien cases oefenen de concrete afweging; taaknamen als hijsen en heetwerk leiden niet automatisch tot hoog. Ook midden kan een TRA vragen. Hoog is geen toestemming om onbeheerst risico te accepteren. De volledige inhoudsverantwoording en het antwoordoverzicht staan in **[INHOUD_EN_BRONNEN.md](INHOUD_EN_BRONNEN.md)**.

- Startfoto: AEB Amsterdam, [homepage](https://www.aebamsterdam.nl/), [afvalenergiecentrale](https://www.aebamsterdam.nl/media/derpmgcz/aeb-exterieur-08-08-2020-0824-2.jpg), geraadpleegd 3 november 2026. Lokaal opgenomen; geen hotlink nodig tijdens de les.
- AEB-logo: [AEB-website](https://www.aebamsterdam.nl/assets/img/logo-aeb.svg).
- DTS-logo: overgenomen uit het eerder aangeleverde AEB-trainingsmateriaal.
- Vijf nieuwe schema’s: warmtebeeldinspectie, aandrijfkap, slijpvonken, hijszone en graafwerk. Dit zijn schematische trainingsillustraties, geen foto’s of uitvoeringsinstructies van de echte AEB-werkplek.

## Voor de ontwikkelaar

De broncode is beschikbaar voor volgende wijzigingen. Alleen de ontwikkelaar gebruikt `npm ci`, `npm run check`, `npm run build` en `npm test`. Jos publiceert de al meegeleverde `dist`.

| Bestand | Functie |
| --- | --- |
| `src/questions.json` | Tien cases, samenvattingen, categorieën en feedback |
| `scripts/cases.py` | Redactionele generator voor dezelfde inhoud |
| `src/question-view.tsx` | Categorieknoppen, beelden en feedback |
| `src/live-session.ts` | Tijdelijke WebRTC-sessies, herstel en wissen |
| `src/live-trainer.tsx` | Sessie-QR, deelnemers en antwoordverdelingen |
| `src/live-learner.tsx` | Voornaam, deelname en volgen van nabespreking |
| `dist/` | De complete direct te publiceren website |

## Verificatie

De regressieset controleert de inhoud, categorieknoppen, ontvangstbevestiging, verborgen antwoorden, nabespreking, tijdelijke gegevens en afsluiten/wissen. Transporttests simuleren meerdere deelnemers (ook met dezelfde naam), nieuwe deelname tijdens het oefenen, antwoorden kiezen tijdens uitval, hervatten na twee minuten achtergrondpauze, vertraagde timers en herstel met dezelfde sessiecode na verlies van de verbindingspeer.

Een gesimuleerde verbinding bewijst geen bereikbaarheid door een bedrijfsfirewall. Een browser of besturingssysteem kan een tabblad volledig stoppen of uit het geheugen verwijderen; zonder server of permanente opslag is herstel van zo'n verwijderde trainerssessie niet mogelijk. Voorkom daarom sluiten of vernieuwen van het trainersscherm tijdens een les. De bestaande PeerJS- en WebRTC-diensten blijven nodig.
