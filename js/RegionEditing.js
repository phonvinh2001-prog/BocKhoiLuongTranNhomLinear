import {distance,project,segmentsOf} from './CadGeometry.js';
import {pointInRegion,regionsOverlap,ringArea,regionIntervals} from './PlanGeometry.js';

const shape=s=>JSON.stringify([s.points,s.openings||[]]);
export function normalizeRegions(zones){
  const seen=new Set();for(const z of zones){if(z.id===undefined||z.id===null||seen.has(z.id))z.id=crypto.randomUUID();seen.add(z.id);z.savedState.zoneId=z.id;z.savedState.zoneName=z.name;}
  return zones;
}
export function linkSnapshot(work,zones){
  let region=zones.find(z=>z.id===work.zoneId);
  if(!region){const matches=zones.filter(z=>shape(z.savedState)===shape(work));if(matches.length===1)region=matches[0];}
  return {...work,zoneId:region?.id??null,zoneName:work.zoneName||region?.name||''};
}
export function translateRegion(work,dx,dy){
  if(![dx,dy].every(Number.isFinite))throw Error('Độ dịch chuyển không hợp lệ');const out=structuredClone(work),point=p=>({ ...p,x:p.x+dx,y:p.y+dy });
  out.points=out.points.map(point);if(out.points.some(p=>![p.x,p.y].every(n=>Number.isFinite(n)&&Math.abs(n)<1e7)))throw Error('Tọa độ đích vượt giới hạn bản vẽ');out.openings=(out.openings||[]).map(h=>h.type==='circle'?{...h,center:point(h.center)}:{...h,points:h.points.map(point)});
  if(out.cad){out.cad.dimensions=(out.cad.dimensions||[]).map(d=>({...d,a:point(d.a),b:point(d.b),position:point(d.position)}));out.cad.circles=(out.cad.circles||[]).map(c=>({...c,center:point(c.center)}));}
  // Joint values are offsets from the run start; only world-coordinate map keys move.
  const vertical=out.inputs.cfg_dir==='90',across=vertical?dx:dy,along=vertical?dy:dx;
  const width=Number(work.inputs.cfg_pW)/1000,module=width+Number(work.inputs.cfg_gW)/1000,axes=work.points.map(p=>vertical?p.x:p.y),start=Math.min(...axes),end=Math.max(...axes);let offset=(end-start)%module/2;if(offset<width/2)offset+=module/2;const first=start-module+offset;
  out.manualJointsMap=Object.fromEntries(Object.entries(out.manualJointsMap||{}).map(([key,value])=>{const parts=key.split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)))throw Error('Khóa điểm nối không hợp lệ');let pos=parts[0],run=parts[1];
    // The saved key is rounded to 1 mm. Recover the exact old strip/run before
    // translating, otherwise a sub-mm move across a rounding boundary loses joints.
    if(Number.isFinite(module)&&module>0){const candidate=first+Math.round((pos-first)/module)*module;if(candidate.toFixed(3)===parts[0].toFixed(3)){pos=candidate;if(parts.length>1){const match=regionIntervals(work.points,work.openings||[],pos+width/2,vertical).find(s=>s.start.toFixed(3)===parts[1].toFixed(3));if(match)run=match.start;}}}
    return [[(pos+across).toFixed(3),...(parts.length>1?[(run+along).toFixed(3)]:[])].join(':'),value];}));
  return out;
}
export function regionHits(p,zones,tolerance){
  return zones.map((z,index)=>({z,index,edge:Math.min(...segmentsOf(z.savedState.points).map(s=>distance(p,project(p,s.a,s.b)))),area:ringArea(z.savedState.points)}))
    .filter(h=>h.edge<=tolerance||pointInRegion(p,h.z.savedState.points,h.z.savedState.openings))
    .sort((a,b)=>(a.edge<=tolerance?0:1)-(b.edge<=tolerance?0:1)||a.area-b.area||b.index-a.index).map(h=>h.index);
}
export function overlappingRegion(work,zones,exceptId=null){return zones.find(z=>z.id!==exceptId&&regionsOverlap(work,z.savedState));}
