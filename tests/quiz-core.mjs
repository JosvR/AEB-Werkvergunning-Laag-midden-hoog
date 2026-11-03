import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answerMask, isCorrect, score, restore, MAX_AGE } from '../src/quiz-core.mjs';
const questions = JSON.parse(await readFile(new URL('../src/questions.json', import.meta.url), 'utf8'));
assert.deepEqual(questions.map(q=>q.n),Array.from({length:10},(_,i)=>i+1));
const expected=[1,2,4,2,2,4,1,2,4,2];
for(const [i,q] of questions.entries()){
 assert.equal(answerMask(q.key),expected[i]);
 assert.deepEqual(q.options,['Laag','Midden','Hoog']);assert.equal(q.multi,false);
 assert.equal(q.category,q.options[Math.log2(expected[i])]);
 assert.ok(q.quote.length>30 && q.source.includes('33.41P') && q.summary && q.explain && q.distractors);
}
assert.equal(questions.filter(q=>q.image).length,5);
assert.deepEqual(questions.reduce((a,q)=>(a[q.category]=(a[q.category]||0)+1,a),{}),{Laag:2,Midden:5,Hoog:3});
const answers=Object.fromEntries(questions.map((q,i)=>[q.n,expected[i]]));
assert.deepEqual(score(questions,answers),{answered:10,correct:10,total:10});
assert.deepEqual(score(questions,{}),{answered:0,correct:0,total:10});
assert.equal(score(questions,{...answers,5:1,10:4}).correct,8);
assert.equal(isCorrect(questions[0],undefined),false);
const now=2000000000000,record={startedAt:now-1000,answers,current:8,finished:true};
assert.deepEqual(restore(JSON.stringify(record),questions,now),record);
assert.equal(restore(JSON.stringify({...record,startedAt:now-MAX_AGE-1}),questions,now).finished,false);
assert.deepEqual(restore('{broken',questions,now).answers,{});
assert.deepEqual(restore(JSON.stringify({...record,startedAt:now+1}),questions,now).answers,{});
const invalid=restore(JSON.stringify({...record,answers:{1:3,2:16,5:64,10:4,11:1},current:999}),questions,now);
assert.deepEqual(invalid.answers,{10:4});assert.equal(invalid.current,1);assert.equal(invalid.finished,false);
assert.equal(restore(JSON.stringify({...record,answers:{1:2},finished:true}),questions,now).finished,false);
console.log('Geslaagd: tien categorieën, scores, vijf beelden, procedurefeedback en tijdelijk herstel.');
