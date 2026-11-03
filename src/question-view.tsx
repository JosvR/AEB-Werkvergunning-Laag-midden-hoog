import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, X, ZoomIn } from 'lucide-react';
import questionData from './questions.json';
import { bindTouchDrag } from './touch-drag.mjs';
type Question = typeof questionData[number];

export default function QuestionView({ q, choice, onChoose, disabled, revealed, large = false }: {
  q: Question; choice?: number; onChoose?: (n: number) => void;
  onPending?: (pending: boolean) => void; disabled?: boolean; revealed?: boolean; large?: boolean;
}) {
  const article = useRef<HTMLElement>(null);
  const targets = useRef<(HTMLElement | null)[]>([]);
  const imageDialog = useRef<HTMLDialogElement>(null);
  type DragSession = { id: number; startX: number; startY: number; x: number; y: number; offsetX: number; offsetY: number; width: number; moved: boolean };
  const session = useRef<DragSession | null>(null);
  const scrollFrame = useRef(0);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<{ x: number; y: number; width: number } | null>(null);
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
  function stopDrag() {
    session.current = null;
    cancelAnimationFrame(scrollFrame.current);
    setPreview(null); setHover(-1);
  }
  useEffect(() => () => { session.current = null; cancelAnimationFrame(scrollFrame.current); }, []);
  useEffect(() => { if (!interactive) stopDrag(); }, [interactive]);
  function select(i: number) {
    if (!interactive) return;
    onChoose?.(1 << i); setPicked(false);
    setStatus(`Samenvatting geplaatst bij ${q.options[i]}. Je kunt je keuze nog wijzigen.`);
  }
  function pick() {
    if (!interactive) return;
    setPicked(true); setStatus('Kies Laag, Midden of Hoog, of sleep het kaartje naar een vak.');
    targets.current[0]?.querySelector('button')?.focus({ preventScroll: true });
  }
  function scrollWhileDragging() {
    const current = session.current;
    if (!current?.moved) return;
    const dy = current.y > window.innerHeight - 70 ? 14 : current.y < 70 ? -14 : 0;
    if (dy) { window.scrollBy(0, dy); setHover(hit(current.x, current.y)); }
    scrollFrame.current = requestAnimationFrame(scrollWhileDragging);
  }
  function beginDrag(card: HTMLElement, id: number, x: number, y: number) {
    if (!interactive) return false;
    const r = card.getBoundingClientRect();
    session.current = { id, startX: x, startY: y, x, y, offsetX: x - r.left, offsetY: y - r.top, width: r.width, moved: false };
    suppressClick.current = false;
    return true;
  }
  function moveDrag(id: number, x: number, y: number) {
    const current = session.current;
    if (!current || current.id !== id) return;
    current.x = x; current.y = y;
    if (!current.moved && Math.hypot(x - current.startX, y - current.startY) < 4) return;
    if (!current.moved) { current.moved = true; scrollFrame.current = requestAnimationFrame(scrollWhileDragging); }
    setPreview({ x: x - current.offsetX, y: y - current.offsetY, width: current.width });
    setHover(hit(x, y));
  }
  function finishDrag(id: number, x: number, y: number, touch = false) {
    const current = session.current;
    if (!current || current.id !== id) return;
    const moved = current.moved || Math.hypot(x - current.startX, y - current.startY) >= 4;
    const target = hit(x, y);
    stopDrag();
    if (moved) {
      suppressClick.current = true;
      if (target >= 0) select(target);
      else { setPicked(true); setStatus('Buiten een vak losgelaten. Sleep opnieuw of tik een categorie aan.'); }
    } else if (touch) pick();
  }
  const touchHandlers = useRef<any>(null);
  touchHandlers.current = {
    start: (card: HTMLElement, p: { id: number; x: number; y: number }) => beginDrag(card, p.id, p.x, p.y),
    move: (p: { id: number; x: number; y: number }) => moveDrag(p.id, p.x, p.y),
    end: (p: { id: number; x: number; y: number }) => finishDrag(p.id, p.x, p.y, true),
    cancel: () => { stopDrag(); setStatus('Slepen geannuleerd. Je eerdere keuze blijft staan.'); },
  };
  useEffect(() => {
    if (!article.current) return;
    return bindTouchDrag(article.current, window, {
      start: (card: HTMLElement, p: { id: number; x: number; y: number }) => touchHandlers.current.start(card, p),
      move: (p: { id: number; x: number; y: number }) => touchHandlers.current.move(p),
      end: (p: { id: number; x: number; y: number }) => touchHandlers.current.end(p),
      cancel: () => touchHandlers.current.cancel(),
    });
  }, []);
  const summary = <><GripVertical size={22} aria-hidden="true" /><div><small>SAMENVATTING VAN DE CASE</small><p>{q.summary}</p></div></>;
  const card = <div className={`case-card ${preview ? 'drag-source' : ''} ${picked ? 'picked' : ''} ${interactive ? 'is-sortable' : 'is-readonly'}`}
    role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} draggable={false}
    aria-label={interactive ? `Verplaats de case: ${q.summary} Sleep naar een categorie of kies een categorieknop.` : undefined}
    onDragStart={e => e.preventDefault()}
    onClick={e => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } pick(); }}
    onKeyDown={e => {
      if (!interactive) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); }
      if (e.key === 'Escape') { stopDrag(); setPicked(false); setStatus('Slepen geannuleerd.'); }
    }}
    onPointerDown={e => {
      // Touch has its own non-passive handlers: do not process both input streams.
      if (e.pointerType === 'touch' || !interactive || !e.isPrimary || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      beginDrag(e.currentTarget, e.pointerId, e.clientX, e.clientY);
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onPointerMove={e => {
      if (e.pointerType === 'touch' || !session.current) return;
      e.preventDefault(); moveDrag(e.pointerId, e.clientX, e.clientY);
    }}
    onPointerUp={e => {
      if (e.pointerType === 'touch') return;
      finishDrag(e.pointerId, e.clientX, e.clientY);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    }}
    onPointerCancel={e => { if (e.pointerType !== 'touch') { stopDrag(); setStatus('Slepen geannuleerd. Je eerdere keuze blijft staan.'); } }}
    onLostPointerCapture={e => { if (e.pointerType !== 'touch' && session.current) stopDrag(); }}>
    {interactive ? summary : <div><small>SAMENVATTING VAN DE CASE</small><p>{q.summary}</p></div>}
  </div>;

  return <article ref={article} className={`question-view risk-question ${large ? 'large' : ''}`}>
    <div className="question-text">
      <p className="eyebrow">CASE {q.n} VAN {questionData.length}</p><h2>{q.title}</h2>
      <p className="case-story">{q.stem}</p>
      {q.image && <figure className="case-figure"><button className="image-button" aria-label={`Vergroot de afbeelding bij ${q.title}`} onClick={() => imageDialog.current?.showModal()}><img src={q.image} alt={q.imageAlt} /><span className="image-zoom"><ZoomIn size={16} /> Vergroten</span></button><figcaption>Schematische trainingsillustratie. Beoordeel de feiten in de case.</figcaption></figure>}
      {preview && createPortal(<div className="case-card case-drag-preview" style={{ left: preview.x, top: preview.y, width: preview.width }} aria-hidden="true">{summary}</div>, document.body)}
      <div className="classify-area">
        <h3>{onChoose ? 'Welke categorie past bij deze situatie?' : 'Laag, midden of hoog?'}</h3>
        {onChoose && <p className="drag-help">Sleep het kaartje naar een vak. Aantikken of de categorieknop gebruiken kan ook.</p>}
        {index < 0 && <div className="case-staging">{card}</div>}
        <div className="risk-zones" role={onChoose ? 'radiogroup' : undefined} aria-label="Risicocategorie">
          {q.options.map((label, i) => {
            const selected = index === i;
            const correct = revealed && q.category === label;
            return <section key={label} ref={el => { targets.current[i] = el; }}
              className={`risk-zone risk-${i} ${selected ? 'selected' : ''} ${hover === i ? 'drop-hover' : ''} ${correct ? 'revealed-correct' : ''} ${revealed && selected && !correct ? 'revealed-wrong' : ''}`}
              onClick={() => select(i)}>
              <button className="risk-target" type="button" role={onChoose ? 'radio' : undefined} aria-checked={onChoose ? selected : undefined}
                disabled={!interactive} onClick={e => { e.stopPropagation(); select(i); }} onKeyDown={e => {
                  const delta = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
                  if (delta && interactive) { e.preventDefault(); const next = (i + delta + 3) % 3; select(next); targets.current[next]?.querySelector('button')?.focus(); }
                }}>
                <span className="risk-number">0{i + 1}</span><strong>{label}</strong>{correct ? <Check size={21} aria-label="Passende categorie" /> : selected ? <span className="selection-indicator">Gekozen</span> : null}
              </button>
              {selected ? card : <span className="drop-hint">{onChoose ? 'Sleep hierheen of tik hier' : 'Categorie'}</span>}
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
