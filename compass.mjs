import {isDeepStrictEqual} from 'node:util';

const kinds = ['spaces','items','packs','relations'];
const types = ['note','task','bookmark','snippet'];
const creators = ['human','agent','demo'];
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const keys = (v, required, optional=[]) => object(v) && required.every(k => Object.hasOwn(v,k)) && Object.keys(v).every(k => [...required,...optional].includes(k));
const str = (v,max=Infinity) => typeof v === 'string' && v.length <= max;
const short = (v,max) => str(v,max) && v.trim().length > 0 && v === v.trim();
const array = (v,max,fn) => Array.isArray(v) && v.length <= max && v.every(fn);
const optional = (o,k,fn) => !Object.hasOwn(o,k) || fn(o[k]);
const s = v => str(v);
const bool = v => typeof v === 'boolean';
const creator = v => creators.includes(v);
const idrefs = v => array(v,Infinity,s);
const space = x => keys(x,['id','name','description','createdAt','updatedAt']) && s(x.id) && short(x.name,160) && str(x.description,500) && s(x.createdAt) && s(x.updatedAt);
const item = x => keys(x,['id','spaceId','type','title','body','tags','createdAt','updatedAt','source','createdBy'],['dueDate','priority','url','language','completed','metadata']) && s(x.id) && short(x.spaceId,120) && types.includes(x.type) && short(x.title,160) && str(x.body,20000) && array(x.tags,20,v=>short(v,40)) && s(x.createdAt) && s(x.updatedAt) && str(x.source,240) && creator(x.createdBy) && optional(x,'dueDate',v=>str(v,40)) && optional(x,'priority',v=>['low','medium','high'].includes(v)) && optional(x,'language',v=>str(v,60)) && optional(x,'completed',bool) && optional(x,'url',v=>{try{return str(v,2048)&&['http:','https:'].includes(new URL(v).protocol)}catch{return false}}) && (x.type !== 'bookmark' || !!x.url) && optional(x,'metadata',v=>object(v)&&Object.values(v).every(y=>y===null || typeof y==='string' || typeof y==='boolean' || (typeof y==='number'&&Number.isFinite(y))));
const pack = x => keys(x,['id','name','description','spaceIds','itemIds','allowedTypes','createdAt','updatedAt','active']) && s(x.id) && short(x.name,160) && str(x.description,1000) && array(x.spaceIds,100,s) && array(x.itemIds,500,s) && array(x.allowedTypes,4,v=>types.includes(v)) && x.allowedTypes.length>0 && s(x.createdAt) && s(x.updatedAt) && bool(x.active);
const relation = x => keys(x,['id','sourceId','targetId','relation','createdAt','createdBy']) && s(x.id) && s(x.sourceId) && s(x.targetId) && ['related','supports','blocks','references','follow_up'].includes(x.relation) && s(x.createdAt) && creator(x.createdBy);
const settings = x => keys(x,['id','initialized','permissions'],['activeSpaceId','activePackId']) && x.id==='settings' && bool(x.initialized) && optional(x,'activeSpaceId',s) && optional(x,'activePackId',s) && keys(x.permissions,['webmcpEnabled','readEnabled','writeEnabled','allowedTypes']) && ['webmcpEnabled','readEnabled','writeEnabled'].every(k=>bool(x.permissions[k])) && keys(x.permissions.allowedTypes,types) && types.every(k=>bool(x.permissions.allowedTypes[k]));

export function validateCompass(d) {
  const errors=[];
  if (!keys(d,['version','exportedAt','spaces','items','packs','relations','settings']) || d.version!==1 || !s(d.exportedAt) || !array(d.spaces,200,space) || !array(d.items,5000,item) || !array(d.packs,200,pack) || !array(d.relations,5000,relation) || !settings(d.settings)) return ['Invalid or unsupported Compass v1 shape'];
  if (Buffer.byteLength(JSON.stringify(d,null,2),'utf8') > 20*1024*1024) errors.push('Exceeds Compass 20 MiB limit');
  for (const k of kinds) if (d[k].some(r=>!r.id.trim()) || new Set(d[k].map(r=>r.id)).size!==d[k].length) errors.push(`Empty or duplicate ${k} ID`);
  const spaces=new Set(d.spaces.map(x=>x.id)), items=new Set(d.items.map(x=>x.id)), packs=new Set(d.packs.map(x=>x.id));
  if (d.items.some(x=>!spaces.has(x.spaceId)) || d.packs.some(x=>x.spaceIds.some(id=>!spaces.has(id)) || x.itemIds.some(id=>!items.has(id))) || d.relations.some(x=>!items.has(x.sourceId)||!items.has(x.targetId)||x.sourceId===x.targetId) || (d.settings.activeSpaceId && !spaces.has(d.settings.activeSpaceId)) || (d.settings.activePackId && !packs.has(d.settings.activePackId))) errors.push('Missing or invalid reference');
  if (d.packs.some(x=>x.active !== (x.id===d.settings.activePackId))) errors.push('Active pack settings disagree');
  return errors;
}

export function previewCompass(base,left,right,{attestCommonBase=false,decisions={}}={}) {
  if (attestCommonBase !== true) throw new Error('Explicit common-base attestation required; Compass v1 has no ancestry metadata');
  for(const [name,doc] of Object.entries({base,left,right})) {const e=validateCompass(doc); if(e.length) throw new Error(`${name}: ${e.join('; ')}`);}
  const conflicts=[], unresolved=[], log=[], output={version:1,exportedAt:base.exportedAt};
  const select=(key,b,l,r)=>{
    if(isDeepStrictEqual(l,r)) return l;
    if(isDeepStrictEqual(l,b)) return r;
    if(isDeepStrictEqual(r,b)) return l;
    const kind=b !== undefined && (l===undefined||r===undefined) ? 'update-vs-delete' : b===undefined ? 'concurrent-add' : 'concurrent-update';
    conflicts.push({key,kind,base:b??null,left:l??null,right:r??null});
    const choice=Object.hasOwn(decisions,key)?decisions[key]:undefined;
    if(choice===undefined){unresolved.push(key);return undefined;}
    if(!['base','left','right'].includes(choice)) throw new Error(`Invalid choice: ${key}`);
    log.push({key,kind,choice}); return {base:b,left:l,right:r}[choice];
  };
  for(const k of kinds){
    const maps=[base,left,right].map(d=>new Map(d[k].map(x=>[x.id,x])));
    output[k]=[];
    for(const id of [...new Set(maps.flatMap(m=>[...m.keys()]))].sort()){
      const value=select(`${k}/${id}`,...maps.map(m=>m.get(id))); if(value!==undefined) output[k].push(structuredClone(value));
    }
  }
  output.settings=select('settings',base.settings,left.settings,right.settings);
  const errors=unresolved.length?[]:validateCompass(output);
  return {conflicts,unresolved,errors,log,result:unresolved.length||errors.length?null:output};
}
