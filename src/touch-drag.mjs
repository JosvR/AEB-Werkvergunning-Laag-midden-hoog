// Native non-passive touch listeners keep dragging separate from page scrolling.
export function bindTouchDrag(root, surface, handlers) {
  let active = null;
  const point = touch => touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)
    ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null;
  const changed = event => Array.from(event.changedTouches || []).find(t => t.identifier === active);
  const prevent = event => { if (event.cancelable) event.preventDefault(); };
  const start = event => {
    if (active !== null || event.touches?.length !== 1) return;
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const card = target?.closest?.('.case-card.is-sortable');
    const next = point(event.changedTouches?.[0]);
    if (!card || !root.contains(card) || !next || !handlers.start(card, next)) return;
    active = next.id; prevent(event);
  };
  const move = event => {
    if (active === null) return;
    const next = point(changed(event));
    if (next) { prevent(event); handlers.move(next); }
  };
  const end = event => {
    if (active === null) return;
    const next = point(changed(event));
    if (next) { active = null; prevent(event); handlers.end(next); }
  };
  const cancel = event => {
    if (active === null || (event.changedTouches?.length && !changed(event))) return;
    active = null; handlers.cancel();
  };
  const options = { passive: false };
  root.addEventListener('touchstart', start, options);
  surface.addEventListener('touchmove', move, options);
  surface.addEventListener('touchend', end, options);
  surface.addEventListener('touchcancel', cancel, options);
  return () => {
    active = null;
    root.removeEventListener('touchstart', start);
    surface.removeEventListener('touchmove', move);
    surface.removeEventListener('touchend', end);
    surface.removeEventListener('touchcancel', cancel);
  };
}
