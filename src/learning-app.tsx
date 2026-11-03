import { version } from '../package.json';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import QuestionView from './question-view';
import LiveLearner from './live-learner';
import { TrainerSessionPanel, QuestionStats } from './live-trainer';
import { useTrainerSession } from './live-hooks';
import { readRoomCode } from './live-protocol.mjs';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff, Monitor, QrCode, RotateCcw, ShieldCheck, X, ZoomIn } from 'lucide-react';
import questionData from './questions.json';
import { STORAGE_KEY, restore, score, isCorrect } from './quiz-core.mjs';

type Question = typeof questionData[number];
type Mode = 'home' | 'practice' | 'trainer' | 'join';
const questions: Question[] = questionData;
const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
const hasKey = (key: string | undefined, letter: string) => !!key?.split(',').map(v => v.trim()).includes(letter);
function initialMode(): Mode {
  const params = new URLSearchParams(window.location.search);
  return params.has('trainer') ? 'trainer' : params.has('join') || readRoomCode(window.location.href) ? 'join' : params.has('deelnemer') || params.has('join') || params.has('session') ? 'practice' : 'home';
}
function initialProgress() {
  try { return restore(window.sessionStorage.getItem(STORAGE_KEY), questions); }
  catch { return restore(null, questions); }
}


export default function LearningApp() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const live = useTrainerSession();
  const [progress, setProgress] = useState(initialProgress);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [reviewNumber, setReviewNumber] = useState(1);
  const [selected, setSelected] = useState<number[]>(questions.map(q => q.n));
  const [order, setOrder] = useState<number[]>(questions.map(q => q.n));
  const [trainerIndex, setTrainerIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const participantQrDialog = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState({ participant: '', trainer: '' });
  const [participantUrl, setParticipantUrl] = useState('');
  const totals = score(questions, progress.answers);
  const current = questions[progress.current - 1];
  const trainerQuestion = questions[order[trainerIndex] - 1];
  const reviewQuestion = questions[reviewNumber - 1];

  useEffect(() => {
    if (mode !== 'practice') return;
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch { setStorageAvailable(false); }
  }, [progress, mode]);
  useEffect(() => {
    let cancelled = false;
    const link = new URL(window.location.href); link.search = ''; link.hash = '';
    const learner = new URL(link); learner.searchParams.set('deelnemer', '1');
    const trainer = new URL(link); trainer.searchParams.set('trainer', '1');
    setParticipantUrl(learner.href);
    const opts = { width: 1600, margin: 4, errorCorrectionLevel: 'M' as const, color: { dark: '#00285b', light: '#ffffff' } };
    Promise.all([QRCode.toDataURL(learner.href, opts), QRCode.toDataURL(trainer.href, opts)]).then(([participant, trainer]) => { if (!cancelled) setQr({ participant, trainer }); }).catch(() => { if (!cancelled) setNotice('Gebruik de deelnamelink als de QR-code niet verschijnt.'); });
    const onBack = () => { if (live.client.current?.active) { const url = new URL(window.location.href); url.search = '?trainer=1'; url.hash = ''; window.history.replaceState({}, '', url); setMode('trainer'); setNotice('Sluit eerst de groepssessie af en wis de gegevens.'); return; } setMode(initialMode()); setRevealed(false); setProjecting(false); setNotice(''); };
    window.addEventListener('popstate', onBack);
    return () => { cancelled = true; window.removeEventListener('popstate', onBack); };
  }, []);

  useEffect(() => { setRevealed(false); }, [live.snapshot.code]);
  useEffect(() => {
    if (mode === 'practice') document.querySelector('.participant-page')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [mode, progress.current, progress.finished]);

  function go(next: Mode) {
    if (pending) { setNotice('Sla je gewijzigde antwoorden op of maak de wijziging ongedaan.'); return; }
    const url = new URL(window.location.href); url.search = ''; url.hash = '';
    if (next === 'trainer') url.searchParams.set('trainer', '1');
    if (next === 'practice') url.searchParams.set('deelnemer', '1');
    if (next === 'join') url.searchParams.set('join', '1');
    if (mode === 'trainer' && live.snapshot.active) { setNotice('Sluit eerst de groepssessie af en wis de gegevens.'); return; }
    window.history.pushState({}, '', url);
    setMode(next); setRevealed(false); setProjecting(false); setNotice('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function choose(choice: number) {
    setProgress(p => ({ ...p, answers: { ...p.answers, [p.current]: choice } }));
    setPending(false); setNotice('');
  }
  function changeQuestion(n: number) { setPending(false); setProgress(p => ({ ...p, current: n })); setNotice(''); }
  function startAgain(onlyWrong = false) {
    const keep = onlyWrong ? Object.fromEntries(questions.filter(q => isCorrect(q, progress.answers[q.n])).map(q => [q.n, progress.answers[q.n]])) : {};
    const next = onlyWrong ? questions.find(q => !isCorrect(q, progress.answers[q.n]))?.n || 1 : 1;
    setProgress({ startedAt: Date.now(), answers: keep, current: next, finished: false });
    setPending(false); setNotice('');
  }
  function clearPractice() {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* geheugen blijft leeg */ }
    setProgress(restore(null, questions)); go('home'); setNotice('Je anonieme oefenvoortgang is gewist.');
  }
  function trainerGo(index: number) { setTrainerIndex(index); setRevealed(false); setNotice(''); if (live.snapshot.phase === 'review') live.client.current?.review(order[index], false); }
  function discussSelection() { if (selected.length) { const next = [...selected].sort((a, b) => a - b); setOrder(next); setTrainerIndex(0); setRevealed(false); if (live.snapshot.active) live.client.current?.review(next[0], false); setNotice(''); } }
  async function copyLink() {
    try { await navigator.clipboard.writeText(participantUrl); setNotice('De deelnamelink is gekopieerd.'); }
    catch { setNotice(`Deelnamelink: ${participantUrl}`); }
  }
  const share = <section className="start-share static-share"><div>{qr.participant && <button className="static-qr-preview" aria-label="Vergroot de deelnemers-QR voor zelfstandig oefenen" onClick={() => participantQrDialog.current?.showModal()}><img src={qr.participant} alt="QR-code voor zelfstandig oefenen" /></button>}</div><div><p className="eyebrow">OEFENEN OP DE EIGEN TELEFOON</p><h2>Zelfstandig oefenen op je telefoon.</h2><p>Deze QR is voor zelfstandig oefenen. Voor live deelname start de trainer een groepssessie met een eigen sessie-QR.</p><div className="inline-actions"><button className="btn secondary qr-enlarge-button" disabled={!qr.participant} onClick={() => participantQrDialog.current?.showModal()}><ZoomIn size={18} /> QR-code vergroten</button><button className="text-btn" onClick={copyLink}><Copy size={17} /> Deelnamelink kopiëren</button>{qr.participant && <a className="text-btn" href={qr.participant} download="AEB-risico-deelnemers-QR.png"><Download size={17} /> Deelnemers-QR</a>}{qr.trainer && <a className="text-btn" href={qr.trainer} download="AEB-risico-trainer-QR.png"><Download size={17} /> Trainer-QR</a>}</div></div></section>;
  const trainerControls = <div className="review-controls"><button className="btn secondary" disabled={trainerIndex === 0} onClick={() => trainerGo(trainerIndex - 1)}><ChevronLeft size={18} /> Vorige</button><span>{trainerIndex + 1} van {order.length}</span><button className="btn primary" aria-pressed={revealed} onClick={() => { const next = !revealed; setRevealed(next); if (live.snapshot.phase === 'review') live.client.current?.review(trainerQuestion.n, next); }}>{revealed ? <EyeOff size={18} /> : <Eye size={18} />}{revealed ? 'Verberg goede antwoorden' : 'Toon goede antwoorden'}</button><button className="btn secondary" disabled={trainerIndex === order.length - 1} onClick={() => trainerGo(trainerIndex + 1)}>Volgende <ChevronRight size={18} /></button></div>;

  return <div className={`app-shell ${projecting ? 'static-projecting' : ''}`}>
    <small className="app-version" aria-label={`Versie ${version}`}>v{version}</small>
    {!projecting && <header className="site-header"><div className="header-inner"><div className="brand"><img src="./images/aeb-logo.svg" alt="AEB Amsterdam" /><span>WERKVERGUNNINGEN<br /><b>LAAG · MIDDEN · HOOG</b></span></div><div className="header-right"><img className="dts-logo" src="./images/deltalinqs.jpg" alt="Deltalinqs Training & Services" />{mode !== 'home' && <button className="text-btn" disabled={pending} onClick={() => go('home')}>Startpagina</button>}</div></div></header>}
    <main>
      {notice && <div className="message notice" role="status">{notice}<button aria-label="Melding sluiten" onClick={() => setNotice('')}><X size={18} /></button></div>}
      {mode === 'home' && <>
        <section className="home-hero"><div className="hero-copy"><p className="eyebrow">AEB AMSTERDAM · PRAKTIJKCASES</p><h1>Laag, midden<br />of <em>hoog risico?</em></h1><p className="hero-intro">Beoordeel tien werksituaties in de afvalenergiecentrale. Sleep de case naar de passende categorie en ontdek welke feiten de doorslag geven.</p><div className="hero-actions"><button className="btn primary" onClick={() => go('practice')}>{totals.answered ? 'Verder oefenen' : 'Zelf oefenen'} <ArrowRight size={20} /></button><button className="btn outline-light" onClick={() => go('trainer')}>Ik ben trainer</button><button className="btn outline-light" onClick={() => go('join')}>Meedoen met de groep</button></div><p className="hero-caption">10 cases · eigen telefoon · samen nabespreken</p></div><div className="hero-image"><img src="./images/aeb-centrale.jpg" alt="De afvalenergiecentrale van AEB Amsterdam" /><span>KIJK NAAR DE TAAK.<br />EN DE OMGEVING.</span></div></section>
        <section className="learning-focus"><p className="eyebrow">DE AFWEGING TELT</p><h2>Een taaknaam alleen bepaalt de categorie niet.</h2><p>Beoordeel de werkzaamheden, de installatie en de omgeving. Midden kan passend zijn als de risicoanalyse dat onderbouwt. Ook bij midden kan een TRA nodig zijn.</p><div className="focus-tags"><span>10 nieuwe cases</span><span>5 praktijkillustraties</span><span>Feedback uit 33.41P</span></div></section>
        {share}
        <section className="home-steps"><div><b>01</b><h2>Doe mee of oefen zelf</h2><p>Scan de sessie-QR van je trainer, of kies Zelf oefenen. Een account is niet nodig.</p></div><div><b>02</b><h2>Sorteer de cases</h2><p>Sleep de samenvatting naar laag, midden of hoog. Je trainer ziet live welke categorie je kiest.</p></div><div><b>03</b><h2>Bespreek samen</h2><p>De trainer kiest alle vragen of een selectie en toont de antwoorden wanneer de groep eraan toe is.</p></div></section>
      </>}

      {mode === 'join' && <LiveLearner onHome={() => go('home')} />}

      {mode === 'practice' && !progress.finished && <div className="participant-page">
        <div className="participant-top"><div><p className="eyebrow">ZELF OEFENEN</p><h1>Welke categorie past?</h1></div><span className="participant-progress"><Check size={17} /> {totals.answered} van {questions.length} beantwoord</span></div>
        <p className="static-intro">Sleep de samenvatting naar Laag, Midden of Hoog. Kies je liever met een knop? Dat kan ook. Na afronding zie je je resultaat en de procedurefeedback.</p>
        <nav className="question-nav" aria-label="Kies een vraag">{questions.map(q => <button key={q.n} className={`${progress.current === q.n ? 'active' : ''} ${progress.answers[q.n] ? 'answered' : ''}`} aria-label={`Vraag ${q.n}${progress.answers[q.n] ? ', beantwoord' : ''}`} aria-current={progress.current === q.n ? 'step' : undefined} disabled={pending} onClick={() => changeQuestion(q.n)}>{q.n}{!!progress.answers[q.n] && <Check size={12} />}</button>)}</nav>
        <QuestionView key={current.n} q={current} choice={progress.answers[current.n]} onChoose={choose} onPending={setPending} />
        <div className="question-bottom"><button className="btn secondary" disabled={pending || current.n === 1} onClick={() => changeQuestion(current.n - 1)}><ChevronLeft size={18} /> Vorige</button><span role="status">{pending ? 'Sla je gewijzigde keuzes op.' : progress.answers[current.n] ? 'Antwoord opgeslagen op dit apparaat.' : current.multi ? 'Vink je keuzes aan en sla ze op.' : 'Sleep de case of kies een categorie.'}</span>{current.n < questions.length ? <button className="btn primary" disabled={pending || !progress.answers[current.n]} onClick={() => changeQuestion(current.n + 1)}>Volgende <ChevronRight size={18} /></button> : <button className="btn primary" disabled={pending || totals.answered < questions.length} onClick={() => setProgress(p => ({ ...p, finished: true }))}>Bekijk mijn resultaat <ArrowRight size={18} /></button>}</div>
        {totals.answered === questions.length && current.n !== questions.length && <div className="finish-row"><button className="btn primary" disabled={pending} onClick={() => setProgress(p => ({ ...p, finished: true }))}>Afronden en resultaat bekijken <ArrowRight size={18} /></button></div>}
        <p className="static-privacy"><ShieldCheck size={17} /> {storageAvailable ? 'Je voortgang blijft tijdelijk in dit browsertabblad. Je antwoorden worden niet verstuurd.' : 'Je browser bewaart je voortgang alleen zolang dit scherm open blijft.'}</p>
        <button className="text-btn" onClick={clearPractice}>Oefenvoortgang wissen</button>
      </div>}

      {mode === 'practice' && progress.finished && <div className="participant-page">
        <section className="static-result"><p className="eyebrow">JE RESULTAAT</p><h1>{totals.correct} van de 10 cases goed</h1><p>Bekijk de toelichtingen en bespreek waarover je twijfelt. Dit is een oefentoets.</p><div className="inline-actions">{totals.correct < questions.length && <button className="btn primary" onClick={() => startAgain(true)}>Oefen de onjuiste vragen opnieuw <RotateCcw size={18} /></button>}<button className="btn secondary" onClick={() => startAgain()}>Nieuwe oefenronde</button><button className="text-btn" onClick={clearPractice}>Oefenvoortgang wissen</button></div></section>
        <nav className="static-results-nav" aria-label="Bekijk de antwoorden">{questions.map(q => <button key={q.n} className={`result-chip ${isCorrect(q, progress.answers[q.n]) ? 'right' : 'wrong'} ${reviewNumber === q.n ? 'active' : ''}`} onClick={() => setReviewNumber(q.n)} aria-current={reviewNumber === q.n ? 'step' : undefined}>Vraag {q.n} · {isCorrect(q, progress.answers[q.n]) ? 'goed' : 'onjuist'}</button>)}</nav>
        <QuestionView key={`result-${reviewQuestion.n}`} q={reviewQuestion} choice={progress.answers[reviewQuestion.n]} revealed />
        <div className="review-controls"><button className="btn secondary" disabled={reviewNumber === 1} onClick={() => setReviewNumber(n => n - 1)}><ChevronLeft size={18} /> Vorige toelichting</button><button className="btn primary" disabled={reviewNumber === questions.length} onClick={() => setReviewNumber(n => n + 1)}>Volgende toelichting <ChevronRight size={18} /></button></div>
      </div>}

      {mode === 'trainer' && <div className="trainer-page">
        <div className="page-heading"><div><p className="eyebrow">TRAINER</p><h1>Samen de keuzes bespreken</h1><p className="muted">Kies de vragen voor het gezamenlijke scherm. Goede antwoorden zijn standaard verborgen.</p></div><button className="btn secondary" onClick={() => setProjecting(v => !v)}><Monitor size={18} /> {projecting ? 'Verlaat projectie' : 'Projectieweergave'}</button></div>
        {!projecting && <>
          <details className="source-note"><summary>Inhoud en gebruik van deze oefening</summary><p>Tien nieuwe cases bij 33.41P Werkvergunningen, revisie 07-05-2026, vooral §4.2 en §4.3. De antwoordcategorie geldt voor de gegeven feiten. De verlener heeft het laatste woord. Geen cijfernorm of examenstatus; bespreek vooral de onderbouwing. Hoog betekent nooit starten met onbeheerst risico.</p></details><TrainerSessionPanel live={live} selected={selected} onSelect={setSelected} onDiscuss={discussSelection} revealed={revealed} onReveal={() => { const next = !revealed; setRevealed(next); if (live.snapshot.phase === 'review') live.client.current?.review(trainerQuestion.n, next); }} />
          {!live.snapshot.active && <section className="overview static-trainer-selection"><div className="section-heading"><div><p className="eyebrow">VRAGEN SELECTEREN</p><h2>Bespreek alle vragen of een selectie.</h2></div><button className="text-btn" onClick={() => setSelected(selected.length === questions.length ? [] : questions.map(q => q.n))}>{selected.length === questions.length ? 'Selectie wissen' : 'Alles selecteren'}</button></div><div className="static-question-picks">{questions.map(q => <label key={q.n}><input type="checkbox" checked={selected.includes(q.n)} onChange={e => setSelected(e.target.checked ? [...selected, q.n] : selected.filter(n => n !== q.n))} /><span><b>{q.n}.</b> {q.title}</span></label>)}</div><button className="btn primary" disabled={!selected.length} onClick={discussSelection}>Bespreek selectie ({selected.length}) <ArrowRight size={18} /></button></section>}
        </>}
        <section className="review-panel"><nav className="review-nav" aria-label="Vragen in de nabespreking">{order.map((n, i) => <button key={n} className={trainerIndex === i ? 'active' : ''} onClick={() => trainerGo(i)}>Vraag {n}</button>)}</nav><QuestionView key={`trainer-${trainerQuestion.n}`} q={trainerQuestion} revealed={revealed} large={projecting} />{live.snapshot.active && <QuestionStats q={trainerQuestion} participants={live.snapshot.participants} revealed={revealed} />}{trainerControls}
          {!projecting && <details className="trainer-notes"><summary>Trainertoelichting</summary><div className="notes-grid"><div><h3>Passende categorie: {trainerQuestion.category}</h3><p>{trainerQuestion.explain}</p></div><div><h3>Bespreekvraag</h3><p>{trainerQuestion.trainer}</p><h3>Aandachtspunt</h3><p>{trainerQuestion.attention}</p></div></div></details>}
        </section>
        {!projecting && <p className="static-privacy"><QrCode size={17} /> {live.snapshot.active ? 'Groepsgegevens blijven tijdelijk in dit trainersscherm. Sluit na afloop de sessie af en wis de gegevens.' : 'Start een groepssessie voor live antwoorden. Zonder groepssessie kunt u de vragen klassikaal bespreken.'}</p>}
      </div>}
    </main>
    <dialog ref={participantQrDialog} className="live-close-dialog live-qr-dialog" aria-labelledby="participant-qr-title"><p className="eyebrow">ZELFSTANDIG OEFENEN</p><h2 id="participant-qr-title">Scan de QR-code met je telefoon.</h2>{qr.participant && <img src={qr.participant} alt="Grote deelnemers-QR voor zelfstandig oefenen" />}<button className="btn secondary" onClick={() => participantQrDialog.current?.close()}>QR-code sluiten</button></dialog>
    {!projecting && <footer className="site-footer"><span>AEB · Deltalinqs Training & Services</span><span>33.41P · formatief oefenen</span></footer>}
  </div>;
}


