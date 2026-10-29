import { isDeepStrictEqual } from 'node:util';

// Research format, deliberately not presented as a real app export.
export function validate(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || !['notes-v1', 'tasks-v1'].includes(doc.schema) || typeof doc.revision !== 'string' || !doc.revision || !Array.isArray(doc.records)) return ['Invalid envelope'];
  if (doc.baseRevision !== undefined && (typeof doc.baseRevision !== 'string' || !doc.baseRevision)) errors.push('Invalid baseRevision');
  const ids = new Set();
  for (const r of doc.records) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || !(r.parentId === null || typeof r.parentId === 'string') || !Number.isSafeInteger(r.order)) { errors.push('Invalid record'); continue; }
    if (ids.has(r.id)) errors.push(`Duplicate ID: ${r.id}`);
    ids.add(r.id);
  }
  for (const r of doc.records) if (r && r.parentId != null && !ids.has(r.parentId)) errors.push(`Missing parent: ${r.id} -> ${r.parentId}`);
  for (const r of doc.records) {
    let current = r; const seen = new Set();
    while (current && current.parentId != null) {
      if (seen.has(current.id)) { errors.push(`Parent cycle: ${r.id}`); break; }
      seen.add(current.id); current = doc.records.find(x => x && x.id === current.parentId);
    }
  }
  return errors;
}

export function preview(base, left, right, decisions = {}) {
  for (const [name, doc] of Object.entries({base, left, right})) {
    const errors = validate(doc); if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  }
  if (left.schema !== base.schema || right.schema !== base.schema || left.baseRevision !== base.revision || right.baseRevision !== base.revision) throw new Error('Schemas or explicit common ancestry do not match');
  const maps = [base, left, right].map(d => new Map(d.records.map(r => [r.id, r])));
  const ids = [...new Set(maps.flatMap(m => [...m.keys()]))].sort();
  const records = [], conflicts = [], log = [];
  for (const id of ids) {
    const [b,l,r] = maps.map(m => m.get(id)); let value;
    if (isDeepStrictEqual(l,r)) value = l;
    else if (isDeepStrictEqual(l,b)) value = r;
    else if (isDeepStrictEqual(r,b)) value = l;
    else {
      const kind = b && (!l || !r) ? 'update-vs-delete' : !b ? 'concurrent-add' : (l.order !== r.order && isDeepStrictEqual({...l, order: 0}, {...r, order: 0}) ? 'reorder' : 'concurrent-update');
      const conflict = {id, kind, base: b ?? null, left: l ?? null, right: r ?? null};
      conflicts.push(conflict);
      const choice = Object.hasOwn(decisions, id) ? decisions[id] : undefined;
      if (choice !== undefined && !['base','left','right'].includes(choice)) throw new Error(`Invalid decision for ${id}`);
      if (choice === undefined) continue;
      value = {base:b,left:l,right:r}[choice]; log.push({id, kind, choice});
    }
    if (value !== undefined) records.push(structuredClone(value));
  }
  const unresolved = conflicts.filter(c => !Object.hasOwn(decisions, c.id) || decisions[c.id] === undefined);
  const result = {schema: base.schema, revision: 'merged-preview', baseRevision: base.revision, records};
  const errors = unresolved.length ? [] : validate(result);
  return {conflicts, unresolved: unresolved.map(c => c.id), errors, log, result: unresolved.length || errors.length ? null : result};
}
