# AEB — Laag, midden of hoog risico?

**Versie 1.3.1 · 4 november 2026.** Tien praktijkcases voor de AEB-training werkvergunningen, met drie knoppen **Laag**, **Midden** en **Hoog**, vijf vergrootbare illustraties en een live trainersoverzicht.

De complete website staat in **`dist/`**. Geen installatie of build nodig voor publicatie. Geen eigen server, serverfuncties, database of persoonlijke API-sleutels.

## Verbindingsreparatie in 1.3.1

Versie 1.2.1 verbeterde de aanmelding, maar behield uitsluitend het directe WebRTC-antwoordkanaal. Wanneer dat kanaal niet tot stand kwam, bleven telefoon en trainer op elkaar wachten. Het bereiken van de PeerJS-verbindingsdienst bewijst nog niet dat antwoorden tussen beide browsers kunnen stromen. De VCH-apps gebruiken dezelfde directe instellingen en bieden op dit punt geen andere route.

Deze versie behoudt PeerJS/WebRTC en voegt een tweede route toe: **versleutelde tijdelijke berichten via beveiligde WebSockets (TLS, poort 443)**. Zonder geopend direct antwoordkanaal schakelt de deelnemer na drie seconden automatisch over. Deze route vraagt geen onderlinge directe netwerkverbinding en werkt zonder account of vaste dienstsleutel. De vragen worden pas vrijgegeven nadat de trainer de deelname heeft bevestigd. Elke antwoordrevisie krijgt een afzonderlijke ontvangstbevestiging.

Het verwijderen van browsergeschiedenis lost een ontbrekend antwoordkanaal niet op. Sluit voor de nieuwe les de oude app-tabbladen, open beide apparaten opnieuw en controleer rechtsboven **v1.3.1**. Start een nieuwe sessie en scan de nieuwe QR. Controleer eerst één deelnemer en één proefantwoord bij de trainer.

## Publiceren via GitHub en Netlify

Repository: **JosvR/AEB-Werkvergunning-Laag-midden-hoog**. Publiceer de meegeleverde map `dist`.

| Instelling | Waarde |
| --- | --- |
| Production branch | `main` |
| Base directory | Leeg |
| Build command | Leeg |
| Publish directory | `dist` |
| Functions / database / omgevingsvariabelen | Niet nodig |

`netlify.toml` bevat deze instellingen. De bestaande GitHub-koppeling publiceert nieuwe commits op `main` automatisch. `downloads/AEB-Laag-midden-hoog-v1.3.1.zip` bevat deze handleiding, `netlify.toml` en de complete `dist/`. Bij handmatige publicatie uploadt u alleen de uitgepakte map `dist`.

## Gebruik in de les

1. Gebruik de vaste Netlify-link met **`?trainer=1`** in de PowerPoint. Start **Start groepssessie** en houd dit tabblad open.
2. Toon de actuele sessie-QR. **QR-code vergroten** toont hem groot genoeg voor achter in het lokaal; Escape of terug sluit de vergroting.
3. Deelnemers scannen de QR, vullen hun voornaam/roepnaam in en kiezen **Meedoen**. De vragen verschijnen pas na bevestigde deelname. Handmatig aansluiten kan met de twaalf tekens van de sessiecode.
4. Controleer vóór de oefening dat de trainer de deelnemer ziet en dat een proefantwoord verschijnt. Een ingevulde naam alleen betekent nog geen geslaagde verbinding.
5. De deelnemer kiest Laag, Midden of Hoog en kan antwoorden aanpassen. **Keuze ontvangen door de trainer** verschijnt pas na bevestiging. Bij korte uitval blijven keuzes in het geheugen van de open telefoonpagina en worden ze opnieuw verstuurd.
6. Selecteer cases en kies **Start nabespreking**. Telefoons volgen de gekozen case; antwoorden wijzigen is dan geblokkeerd. Goede antwoorden zijn standaard verborgen, ook na wisselen van case. **Toon goede antwoorden** maakt onderbouwing en procedurefeedback zichtbaar. **Laat de groep verder oefenen** hervat het oefenen. **Projectieweergave** vereenvoudigt het gezamenlijke scherm.
7. Sluit na afloop af met **Sessie afsluiten en wissen** en bevestig.

Een sessie-QR geldt voor één les. De app gebruikt afzonderlijke deelnemersidentificaties; twee gelijke voornamen verstoren elkaar niet. De code begrenst een sessie op tachtig deelnemers; dat is geen gemeten capaciteit.

**Zelf oefenen** heeft geen naam of groepsverbinding nodig. Feedback verschijnt na tien antwoorden. Anonieme zelfstandige voortgang staat maximaal acht uur in sessionStorage van het eigen tabblad. Groepsnamen en groepsantwoorden worden daar niet opgeslagen.

## Gegevens en openbare verbindingsdiensten

Trainer en deelnemer bewaren groepsgegevens uitsluitend in werkgeheugen. De directe route gebruikt PeerJS 1.5.5 en WebRTC. De aanvullende route gebruikt `nostr-tools` 2.25.5 met NIP-44 v2-versleuteling en ondertekende NIP-01-berichten. Elke pagina krijgt een tijdelijke willekeurige sleutel, uitsluitend in het geheugen. De sessiecode is afgeleid van de openbare trainerssleutel; de deelnemer controleert dat die bij de code hoort. Deelnemers kunnen de berichten van andere deelnemers niet ontsleutelen.

De publieke relays zijn **`wss://relay.damus.io`** en **`wss://nos.lol`**. De app verzendt berichten van het tijdelijke type **20049**, waarvoor het protocol geen opslag verwacht, plus een vervaltijd van zestig seconden. Zij ontvangen alleen versleutelde namen/antwoorden; sessie-identificaties, tijdelijke openbare sleutels, berichtgrootte, tijdstip en netwerkmetadata blijven zichtbaar. De app maakt geen externe deelnemerslijst of resultatenbestand. Gedrag of logging van onafhankelijke relaybeheerders kan de app niet afdwingen; claim daarom geen gegarandeerde onmiddellijke verwijdering bij die diensten. De aanvullende route heeft geen persoonlijke accountaanmelding, vaste toegangssleutel of betaald abonnement nodig.

**Afsluiten en wissen** verwijdert namen en antwoorden uit het trainersgeheugen en verstuurt een afsluitbericht. Bereikbare deelnemers wissen hun gegevens; een onbereikbare telefoon wist na tien minuten zonder trainercontact, of bij hervatten na een langere browserpauze. Tijdelijke cryptografische sleutels worden bij afsluiten overschreven. Onmiddellijke wissing op een offline apparaat is niet mogelijk. Iedere nieuwe les krijgt een nieuwe willekeurige sessie.

Houd de trainerpagina open. Bij internetherstel of terugkeer naar de pagina probeert de app de verbinding opnieuw. Vernieuwen, sluiten of verwijderen van het tabblad verliest het werkgeheugen. Er is geen serverkopie of herstelbestand. De maximale sessieduur is acht uur.

Live deelname heeft internet nodig. Publieke verbindingsdiensten hebben geen beschikbaarheidsgarantie. Een bedrijfsfilter kan ook WebSockets blokkeren. Test vooraf op de leslocatie met de echte trainerlaptop en telefoons. Het exacte Honor-toestel en het netwerk van de gebruiker zijn niet vanuit deze ontwikkelomgeving getest.

Bronnen: [PeerJS](https://peerjs.com/client/getting-started), [beëindigde PeerJS TURN-dienst](https://github.com/orgs/peers/discussions/1172), [NIP-01 tijdelijke berichten](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIP-44 versleuteling](https://github.com/nostr-protocol/nips/blob/master/44.md), [nostr-tools](https://github.com/nbd-wtf/nostr-tools), [Damus relay](https://relay.damus.io), [nos.lol](https://nos.lol).

## Inhoud en beelden

Hoofdbron: de door Jos aangeleverde **33.41P Werkvergunningen**, revisie **07-05-2026**, vooral §4.2–4.3, p.7–9. De verlener heeft volgens §4.3 het laatste woord. De tien cases oefenen de concrete afweging; taaknamen als hijsen en heetwerk leiden niet automatisch tot hoog. Ook midden kan een TRA vragen. Hoog is geen toestemming om onbeheerst risico te accepteren. De volledige inhoudsverantwoording en het antwoordoverzicht staan in **[INHOUD_EN_BRONNEN.md](INHOUD_EN_BRONNEN.md)**.

- Startfoto: AEB Amsterdam, [homepage](https://www.aebamsterdam.nl/), [afvalenergiecentrale](https://www.aebamsterdam.nl/media/derpmgcz/aeb-exterieur-08-08-2020-0824-2.jpg), geraadpleegd 3 november 2026. Lokaal opgenomen; geen hotlink nodig tijdens de les.
- AEB-logo: [AEB-website](https://www.aebamsterdam.nl/assets/img/logo-aeb.svg).
- DTS-logo: overgenomen uit het eerder aangeleverde AEB-trainingsmateriaal.
- Vijf nieuwe schema’s: warmtebeeldinspectie, aandrijfkap, slijpvonken, hijszone en graafwerk. Dit zijn schematische trainingsillustraties, geen foto’s of uitvoeringsinstructies van de echte AEB-werkplek.

## Voor de ontwikkelaar

Gebruik `npm ci`, `npm run check`, `npm test` en `npm run build`. Commit `dist` mee; Netlify hoeft geen build uit te voeren.

| Bestand | Functie |
| --- | --- |
| `src/questions.json` | Tien cases, categorieën en feedback |
| `scripts/cases.py` | Redactionele generator voor dezelfde inhoud |
| `src/question-view.tsx` | Categorieknoppen, beelden en feedback |
| `src/live-session.ts` | Groepsprotocol, ontvangstbevestiging, herstel en wissen |
| `src/relay-peer.ts` | Directe route met versleutelde WebSocket-terugval |
| `src/live-trainer.tsx` | Sessie-QR, deelnemers en antwoordverdelingen |
| `src/live-learner.tsx` | Voornaam, deelname en volgen van nabespreking |
| `dist/` | De complete direct te publiceren website |

## Verificatie

TypeScript-controle, productiebuild en **twintig geautomatiseerde tests** slagen. Vijftien bestaande sessietests controleren onder meer meerdere deelnemers, dezelfde namen, ontvangstbevestiging, vertraagde aansluiting, verloren bevestiging, uitval, hervatten en wissen. Eén configuratietest behoudt de directe VCH-route. Vier nieuwe tests gebruiken de echte versleuteling en ondertekening met een gesimuleerde relay: twee deelnemers met uitgeschakelde WebRTC, antwoordbevestiging en nabespreking/wissen; binding tussen code en trainerssleutel; herstel na verlies van alle WebSockets; en herbouw van het transport met behoud van de sessie-identiteit. De tests controleren ook dat namen en antwoorden niet leesbaar over de relay gaan en dat een derde deelnemer ze niet kan ontsleutelen. Een verlaten directe verbindingspoging geeft na geslaagde deelname via de tweede route geen onterechte aansluitwaarschuwing. Afbeeldingen reserveren vooraf hun ruimte, zodat de antwoordknoppen bij het laden op hun plek blijven. Inhoud, categorieknoppen en statische publicatie worden afzonderlijk gecontroleerd.

Daarnaast is in afzonderlijke browserpagina’s via de echte openbare verbindingsdiensten live gegevensoverdracht getest. Dit is aanvullend op de gesimuleerde tests, geen vervanging voor een proef op de leslocatie. Een browser kan een tabblad volledig uit het geheugen verwijderen; zonder permanente opslag kan die verwijderde trainerssessie niet worden teruggehaald.
