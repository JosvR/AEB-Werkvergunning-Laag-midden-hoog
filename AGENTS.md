# AEB laag – midden – hoog

- Deze app is volledig statisch. Publiceer uitsluitend de kant-en-klare map `dist` via Netlify. Build command leeg; publish directory `dist`. Geen database, eigen server, API-routes, Workers, Next.js of serverfuncties toevoegen.
- Gebruik de bestaande PeerJS/WebRTC-architectuur. Alleen publieke verbindingsdiensten, geen persoonlijke sleutels of geheimen. De trainer bewaart namen, antwoorden en groepsvoortgang alleen in werkgeheugen. Geen logging, analytics of permanente opslag van groepsgegevens.
- Deelnemers vullen een voornaam in en krijgen alleen hun eigen gegevens en de gedeelde nabespreking. De trainer ziet verbonden deelnemers, voortgang en de verdeling Laag/Midden/Hoog.
- Behoud ontvangstbevestiging, heartbeat, validatie, herstel en verlopen sessies. Sluit/wis geeft verbonden deelnemers een afsluitbericht; offline apparaten wissen na timeout of hervatten. Claim geen onmiddellijke wissing van een offline apparaat.
- Goede antwoorden blijven bij starten en bij wisselen van vraag verborgen. Behoud selectie, projectie, trainerfeedback en vergrootbare sessie-QR.
- Alleen zelfstandig oefenen mag anonieme voortgang tijdelijk in sessionStorage bewaren (maximaal acht uur). De groepssessie gebruikt die opslag niet.
- Behoud tien nieuwe cases met drie categorieën, vijf illustraties en relevante procedurefragmenten. Wijzigingen baseren op de aangeleverde 33.41P Werkvergunningen, revisie 07-05-2026. Een taaknaam, TRA of gewenst aandeel hoge vergunningen is geen automatische classificatieregel. Leg de conclusie uit voor de concrete feiten. Hoog betekent nooit starten met onbeheerst risico.
- De broninhoud staat in `src/questions.json`; `scripts/cases.py` is de redactionele generator. Houd beide gelijk bij wijzigingen. Zet nooit examen A/B in de app.
- Voer na wijzigingen `npm run check`, `npm run build` en `npm test` uit. Commit de bijgewerkte `dist` mee. Controleer de drie categorieknoppen en live sessies in de browser als preview beschikbaar is; onderscheid gesimuleerde tests van een echte netwerkproef.
- Werk versie, Nederlandse README, INHOUD_EN_BRONNEN.md en download-ZIP bij. Behoud relatieve assetpaden en de logo’s van AEB en Deltalinqs Training & Services.
