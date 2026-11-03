import { useRef } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';
import questionData from './questions.json';
type Question = typeof questionData[number];

export default function QuestionView({ q, choice, onChoose, disabled, revealed, large = false }: {
  q: Question; choice?: number; onChoose?: (n: number) => void;
  onPending?: (pending: boolean) => void; disabled?: boolean; revealed?: boolean; large?: boolean;
}) {
  const imageDialog = useRef<HTMLDialogElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = choice ? Math.log2(choice) : -1;
  const interactive = !!onChoose && !disabled;
  function select(i: number) { if (interactive) onChoose?.(1 << i); }
  return <article className={`question-view risk-question ${large ? 'large' : ''}`}>
    <div className="question-text">
      <p className="eyebrow">CASE {q.n} VAN {questionData.length}</p><h2>{q.title}</h2>
      <p className="case-story">{q.stem}</p>
      {q.image && <figure className="case-figure"><button className="image-button" aria-label={`Vergroot de afbeelding bij ${q.title}`} onClick={() => imageDialog.current?.showModal()}><img src={q.image} alt={q.imageAlt} /><span className="image-zoom"><ZoomIn size={16} /> Vergroten</span></button><figcaption>Schematische trainingsillustratie. Beoordeel de feiten in de case.</figcaption></figure>}
      <div className="classify-area">
        <h3>{onChoose ? 'Welke categorie past bij deze situatie?' : 'Laag, midden of hoog?'}</h3>
        {onChoose && <p className="choice-help">Druk op Laag, Midden of Hoog. Je kunt je keuze nog wijzigen.</p>}
        <div className="case-card is-readonly"><div><small>SAMENVATTING VAN DE CASE</small><p>{q.summary}</p></div></div>
        <div className="risk-choices" role={onChoose ? 'radiogroup' : undefined} aria-label="Risicocategorie">
          {q.options.map((label, i) => {
            const selected = index === i;
            const correct = revealed && q.category === label;
            return <button key={label} ref={el => { buttons.current[i] = el; }}
              className={`risk-choice ${selected ? 'selected' : ''} ${correct ? 'revealed-correct' : ''} ${revealed && selected && !correct ? 'revealed-wrong' : ''}`}
              type="button" role={onChoose ? 'radio' : undefined} aria-label={label}
              aria-checked={onChoose ? selected : undefined} disabled={!interactive}
              onClick={() => select(i)} onKeyDown={e => {
                const delta = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
                if (delta && interactive) { e.preventDefault(); const next = (i + delta + q.options.length) % q.options.length; select(next); buttons.current[next]?.focus(); }
              }}>
              <strong>{label}</strong>
              {correct ? <Check size={21} aria-label="Passende categorie" /> : selected ? <span className="selection-indicator">Gekozen</span> : null}
            </button>;
          })}
        </div>
        {onChoose && <p className="choice-status" role="status">{choice ? `Je keuze: ${q.options[index]}.` : disabled ? 'Verbinden met de trainer…' : 'Nog geen categorie gekozen.'}</p>}
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
