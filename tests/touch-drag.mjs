import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchDrag } from '../src/touch-drag.mjs';

function setup(accept = true) {
  const card = new EventTarget();
  card.closest = selector => selector === '.case-card.is-sortable' ? card : null;
  card.contains = value => value === card;
  const surface = new EventTarget(), calls = [];
  const dispose = bindTouchDrag(card, surface, {
    start: (element, point) => { calls.push(['start', point]); return accept; },
    move: point => calls.push(['move', point]),
    end: point => calls.push(['end', point]),
    cancel: () => calls.push(['cancel']),
  });
  const point = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
  const send = (type, changedTouches, touches = changedTouches) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, { changedTouches: { value: changedTouches }, touches: { value: touches } });
    (type === 'touchstart' ? card : surface).dispatchEvent(event);
    return event;
  };
  return { calls, dispose, point, send };
}

test('vinger slepen blokkeert paginaschuiven en gebruikt de echte loslaatpositie', () => {
  const t = setup();
  assert.equal(t.send('touchstart', [t.point(7, 100, 200)]).defaultPrevented, true);
  assert.equal(t.send('touchmove', [t.point(7, 150, 320)]).defaultPrevented, true);
  assert.equal(t.send('touchend', [t.point(7, 170, 460)], []).defaultPrevented, true);
  assert.deepEqual(t.calls, [['start', { id: 7, x: 100, y: 200 }], ['move', { id: 7, x: 150, y: 320 }], ['end', { id: 7, x: 170, y: 460 }]]);
  t.dispose();
});

test('snel slepen zonder tussenliggende move en opnieuw verplaatsen leveren ieder één keuze', () => {
  const t = setup();
  for (const y of [400, 550, 700]) {
    t.send('touchstart', [t.point(0, 100, 180)]);
    t.send('touchend', [t.point(0, 130, y)], []);
  }
  assert.deepEqual(t.calls.filter(call => call[0] === 'end').map(call => call[1].y), [400, 550, 700]);
  t.dispose();
});

test('tweede vinger verandert de keuze niet; annuleren levert geen antwoord op', () => {
  const t = setup();
  t.send('touchstart', [t.point(1, 100, 200)]);
  t.send('touchstart', [t.point(2, 300, 200)], [t.point(1, 100, 200), t.point(2, 300, 200)]);
  assert.equal(t.send('touchmove', [t.point(2, 300, 400)]).defaultPrevented, false);
  t.send('touchend', [t.point(2, 300, 400)], [t.point(1, 100, 200)]);
  t.send('touchcancel', [t.point(1, 100, 200)], []);
  t.send('touchend', [t.point(1, 300, 500)], []);
  assert.deepEqual(t.calls.map(call => call[0]), ['start', 'cancel']);
  t.dispose();
});

test('leesweergave, offline bediening en gewone paginabeweging worden niet overgenomen', () => {
  const t = setup(false);
  assert.equal(t.send('touchmove', [t.point(1, 10, 20)]).defaultPrevented, false);
  assert.equal(t.send('touchstart', [t.point(1, 100, 200)]).defaultPrevented, false);
  t.send('touchend', [t.point(1, 300, 500)], []);
  assert.deepEqual(t.calls.map(call => call[0]), ['start']);
  t.dispose();
  t.send('touchstart', [t.point(1, 100, 200)]);
  assert.equal(t.calls.length, 1);
});
