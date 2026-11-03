import { useRef, useState } from 'react';
import { Check, GripVertical, X, ZoomIn } from 'lucide-react';
import questionData from './questions.json';
type Question = typeof questionData[number];

export default function QuestionView({ q, choice, onChoose, disabled, revealed, large = false }: {
  q: Question; choice?: number; onChoose?: (n: number) => void;
  onPending?: (pending: boolean) => void; disabled?: boolean; revealed?: boolean; large?: boolean;
}) {
  const targets = useRef<(HTMLElement | null)[]>([]);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState(-1);
  const [picked, setPicked] = useState(false);
  const [status, setStatus] = useState('');
  const index = choice ? Math.log2(choice) : -1;
  const interactive = !!onChoose && !disabled;
  function hit(x: number, y: number) {
    return targets.current.findIndex(el => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  }
  function select(i: number) {
    if (!interactive) return;
    onChoose?.(1 << i); setPicked(false);
    setStatus(`Samenvatting geplaatst bij ${q.options[i]}. Je kunt je keuze nog wijzigen.`);
  }
  const card = <div className={`case-card ${drag ? 'dragging' : ''} ${picked ? 'picked' : ''}`}
    role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}
    aria-label={interactive ? `Verplaats de case: ${q.summary}. Sleep naar een categorie of kies een categorieknop.` : undefined}
    style={drag ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
    onKeyDown={e => {
      if (!interactive) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPicked(true); setStatus('Kies hieronder Laag, Midden of Hoog.'); targets.current[0]?.querySelector('button')?.focus(); }
      if (e.key === 'Escape') { setPicked(false); setDrag(null); setHover(-1); }
    }}
    onPointerDown={e => {
      if (!interactive || e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x: 0, y: 0 });
    }}
    onPointerMove={e => {
      if (!drag) return;
      setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
      setHover(hit(e.clientX, e.clientY));
      if (e.clientY > window.innerHeight - 65) window.scrollBy(0, 12);
      else if (e.clientY < 65) window.scrollBy(0, -12);
    }}
    onPointerUp={e => {
      if (!drag) return;
      const i = hit(e.clientX, e.clientY);
      setDrag(null); setHover(-1);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (i >= 0) select(i);
      else { setPicked(true); setStatus('Kies Laag, Midden of Hoog, of sleep het kaartje naar een vak.'); }
    }}
    onPointerCancel={() => { setDrag(null); setHover(-1); }}>
    {onChoose && <GripVertical size={22} aria-hidden="true" />}<div><small>SAMENVATTING VAN DE CASE</small><p>{q.summary}</p></div>
  </div>;

  return <article className={`question-view risk-question ${large ? 'large' : ''}`}>
    <div className="question-text">
      <p className="eyebrow">CASE {q.n} VAN {questionData.length}</p><h2>{q.title}</h2>
      <p className="case-story">{q.stem}</p>
      {q.image && <figure className="case-figure"><button className="image-button" aria-label={`Vergroot de afbeelding bij ${q.title}`} onClick={() => imageDialog.current?.showModal()}><img src={q.image} alt={q.imageAlt} /><span className="image-zoom"><ZoomIn size={16} /> Vergroten</span></button><figcaption>Schematische trainingsillustratie. Beoordeel de feiten in de case.</figcaption></figure>}
      <div className="classify-area">
        <h3>{onChoose ? 'Welke categorie past bij deze situatie?' : 'Laag, midden of hoog?'}</h3>
        {onChoose && <p className="drag-help">Sleep het kaartje naar een vak. Aantikken of de categorieknop gebruiken kan ook.</p>}
        {index < 0 && <div className="case-staging">{card}</div>}
        <div className="risk-zones" role={onChoose ? 'radiogroup' : undefined} aria-label="Risicocategorie">
          {q.options.map((label, i) => {
            const selected = index === i;
            const correct = revealed && q.category === label;
            return <section key={label} ref={el => { targets.current[i] = el; }}
              className={`risk-zone risk-${i} ${selected ? 'selected' : ''} ${hover === i ? 'drop-hover' : ''} ${correct ? 'revealed-correct' : ''} ${revealed && selected && !correct ? 'revealed-wrong' : ''}`}>
              <button className="risk-target" type="button" role={onChoose ? 'radio' : undefined} aria-checked={onChoose ? selected : undefined}
                disabled={!interactive} onClick={() => select(i)} onKeyDown={e => {
                  const delta = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
                  if (delta && interactive) { e.preventDefault(); const next = (i + delta + 3) % 3; select(next); targets.current[next]?.querySelector('button')?.focus(); }
                }}>
                <span className="risk-number">0{i + 1}</span><strong>{label}</strong>{correct ? <Check size={21} aria-label="Passende categorie" /> : selected ? <span className="selection-indicator">Gekozen</span> : null}
              </button>
              {selected ? card : <span className="drop-hint">{onChoose ? 'Plaats hier' : 'Categorie'}</span>}
            </section>;
          })}
        </div>
        {onChoose && <p className="drag-status" role="status">{status || (choice ? `Je keuze: ${q.options[index]}.` : disabled ? 'Wacht op verbinding met de trainer.' : 'Nog geen categorie gekozen.')}</p>}
      </div>
      {revealed && <section className="risk-feedback" aria-label="Toelichting en procedure">
        <p className="feedback-label"><Check size={20} /> Passende categorie: <strong>{q.category}</strong></p>
        <p>{q.explain}</p><h3>Waarom de andere categorieën hier minder passen</h3><p>{q.distractors}</p>
        <div className="procedure-extract"><h3>Uit de procedure</h3><blockquote>{q.quote}</blockquote><p>{q.source}</p></div>
        <p className="feedback-footnote">Oefenadvies bij de beschreven feiten. De bevoegde rollen stellen de categorie vast; een vergunning vervangt geen veilige uitvoering.</p>
      </section>}
    </div>
    {q.image && <dialog ref={imageDialog} className="image-dialog" aria-label={q.imageAlt} onClick={e => { if (e.target === e.currentTarget) imageDialog.current?.close(); }}><button className="btn secondary image-dialog-close" onClick={() => imageDialog.current?.close()}><X size={20} /> Sluiten</button><img src={q.image} alt={q.imageAlt} /><p>Schematische trainingsillustratie</p></dialog>}
  </article>;
}
