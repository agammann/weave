import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preview,validate} from '../weave.mjs';
const rec = (id,title=id,parentId=null,order=0) => ({id,title,parentId,order});
const doc = (revision,records,baseRevision, schema='notes-v1') => ({schema,revision,...(baseRevision ? {baseRevision}:{}),records});
const base=doc('b',[rec('a'),rec('b')]);
const branch = records => doc('x',records,'b');
test('independent updates survive',()=>{const p=preview(base,branch([rec('a','A'),rec('b')]),branch([rec('a'),rec('b','B')])); assert.deepEqual(p.result.records.map(r=>r.title),['A','B']);});
test('concurrent edits require explicit choice',()=>{const l=branch([rec('a','L'),rec('b')]),r=branch([rec('a','R'),rec('b')]); assert.deepEqual(preview(base,l,r).unresolved,['a']); assert.equal(preview(base,l,r,{a:'right'}).result.records[0].title,'R');});
test('delete versus update is visible',()=>{const l=branch([rec('b')]),r=branch([rec('a','edited'),rec('b')]); assert.equal(preview(base,l,r).conflicts[0].kind,'update-vs-delete'); assert.equal(preview(base,l,r,{a:'left'}).result.records.length,1);});
test('reorder is visible',()=>{const l=branch([rec('a','a',null,1),rec('b')]),r=branch([rec('a','a',null,2),rec('b')]); assert.equal(preview(base,l,r).conflicts[0].kind,'reorder');});
test('concurrent duplicate additions conflict',()=>{const l=branch([...base.records,rec('c','L')]),r=branch([...base.records,rec('c','R')]); assert.equal(preview(base,l,r).conflicts[0].kind,'concurrent-add');});
test('missing ancestry refuses to infer deletions',()=>assert.throws(()=>preview(base,doc('x',[]),branch(base.records)),/ancestry/));
test('duplicate IDs rejected',()=>assert.match(validate(doc('a',[rec('x'),rec('x')])).join(),/Duplicate/));
test('broken references rejected after merge',()=>{const b=doc('b',[rec('p'),rec('c','c','p')]); const l=branch([]),r=branch([rec('p'),rec('c','changed','p')]); const p=preview(b,l,r,{c:'right'}); assert.match(p.errors.join(),/Missing parent/); assert.equal(p.result,null);});
test('cycles rejected',()=>assert.match(validate(doc('x',[rec('a','a','b'),rec('b','b','a')])).join(),/cycle/));
test('both synthetic schemas round trip',()=>{for(const schema of ['notes-v1','tasks-v1']){const b=doc('b',[rec('a')],undefined,schema);const p=preview(b,doc('l',b.records,'b',schema),doc('r',b.records,'b',schema));assert.deepEqual(validate(JSON.parse(JSON.stringify(p.result))),[]);}});
test('invalid choice rejected',()=>assert.throws(()=>preview(base,branch([rec('a','L'),rec('b')]),branch([rec('a','R'),rec('b')]),{a:'other'}),/Invalid decision/));
for (const id of ['constructor','toString','__proto__']) {
  test(`conflicting ${id} requires an own decision`,()=>{
    const b=doc('b',[rec(id)]),l=branch([rec(id,'L')]),r=branch([rec(id,'R')]);
    for (const decisions of [undefined, {}, Object.create({[id]:'left'})]) {
      const p=preview(b,l,r,decisions);
      assert.deepEqual(p.unresolved,[id]); assert.equal(p.result,null); assert.deepEqual(p.log,[]);
    }
    const choices=JSON.parse(JSON.stringify({[id]:'right'}));
    const p=preview(b,l,r,choices);
    assert.equal(p.result.records[0].title,'R'); assert.deepEqual(p.log,[{id,kind:'concurrent-update',choice:'right'}]);
  });
}
test('inherited malicious decision is ignored even when it names a valid branch',()=>{
  const decisions=Object.create({a:'left'});
  const p=preview(base,branch([rec('a','L'),rec('b')]),branch([rec('a','R'),rec('b')]),decisions);
  assert.deepEqual(p.unresolved,['a']); assert.equal(p.result,null);
});
