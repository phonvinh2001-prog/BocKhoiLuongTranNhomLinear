import {EPS,distance,project,intersection,polygonError,segmentsOf} from './CadGeometry.js';

export function ringArea(points){let n=0;points.forEach((a,i)=>{const b=points[(i+1)%points.length];n+=a.x*b.y-a.y*b.x;});return Math.abs(n/2);}
// -1 outside, 0 on boundary, 1 strictly inside. This is independent of ring orientation.
export function pointLocation(p,points){let inside=false;for(const {a,b} of segmentsOf(points)){if(distance(p,project(p,a,b))<EPS)return 0;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside?1:-1;}
export function openingLocation(p,h){if(h.type==='circle'){const d=distance(p,h.center)-h.radius;return Math.abs(d)<EPS?0:d<0?1:-1;}return pointLocation(p,h.points);}
export const openingArea=h=>h.type==='circle'?Math.PI*h.radius*h.radius:ringArea(h.points);
export function netArea(points,openings=[],purpose='PANEL'){return ringArea(points)-openings.filter(h=>purpose==='PANEL'||h.scope!=='PANEL').reduce((n,h)=>n+openingArea(h),0);}
export function openingBounds(h){return h.type==='circle'?[{x:h.center.x-h.radius,y:h.center.y-h.radius},{x:h.center.x+h.radius,y:h.center.y+h.radius}]:h.points;}
const touch=(a,b,c,d)=>intersection(a,b,c,d)||[a,b].some(p=>distance(p,project(p,c,d))<EPS)||[c,d].some(p=>distance(p,project(p,a,b))<EPS);
export function openingsOverlap(a,b){
  if(a.type==='circle'&&b.type==='circle')return distance(a.center,b.center)<=a.radius+b.radius+EPS;
  if(a.type==='circle'||b.type==='circle'){const c=a.type==='circle'?a:b,p=a.type==='circle'?b:a;return pointLocation(c.center,p.points)>=0||segmentsOf(p.points).some(s=>distance(c.center,project(c.center,s.a,s.b))<=c.radius+EPS);}
  return segmentsOf(a.points).some(s=>segmentsOf(b.points).some(t=>touch(s.a,s.b,t.a,t.b)))||pointLocation(a.points[0],b.points)>=0||pointLocation(b.points[0],a.points)>=0;
}
export function openingsError(points,openings=[]){
  if(!Array.isArray(openings)||openings.length>200)return 'Mỗi vùng tối đa 200 lỗ kỹ thuật';
  const ids=new Set();for(let i=0;i<openings.length;i++){const h=openings[i];if(!h||typeof h.id!=='string'||!h.id||ids.has(h.id)||!['VOID','PANEL'].includes(h.scope))return 'ID hoặc phạm vi lỗ không hợp lệ';ids.add(h.id);
    if(h.type==='circle'){if(!h.center||![h.center.x,h.center.y,h.radius].every(Number.isFinite)||h.radius<=EPS||h.radius>1000)return 'Tâm/bán kính lỗ tròn không hợp lệ';if(pointLocation(h.center,points)!==1||segmentsOf(points).some(s=>distance(h.center,project(h.center,s.a,s.b))<=h.radius+EPS))return 'Lỗ tròn phải nằm hoàn toàn bên trong vùng, không chạm biên';}
    else if(h.type==='polygon'){const err=Array.isArray(h.points)?polygonError(h.points):'Thiếu đỉnh lỗ';if(err)return err;if(h.points.some(p=>pointLocation(p,points)!==1)||segmentsOf(h.points).some(s=>segmentsOf(points).some(t=>touch(s.a,s.b,t.a,t.b))))return 'Lỗ phải nằm hoàn toàn bên trong vùng, không chạm/cắt biên';}
    else return 'Loại lỗ không được hỗ trợ';
    for(let j=0;j<i;j++)if(openingsOverlap(h,openings[j]))return 'Các lỗ không được chồng, chứa nhau hoặc chạm nhau';
  }return null;
}
function ringIntervals(points,val,vertical){const hits=[];for(const {a,b} of segmentsOf(points)){const u=vertical?a.x:a.y,v=vertical?b.x:b.y;if((u<=val&&v>val)||(v<=val&&u>val))hits.push((vertical?a.y:a.x)+(val-u)*((vertical?b.y:b.x)-(vertical?a.y:a.x))/(v-u));}hits.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>EPS)out.push({start:hits[i],end:hits[i+1]});return out;}
export function openingIntervals(h,val,vertical){if(h.type!=='circle')return ringIntervals(h.points,val,vertical);const d=val-(vertical?h.center.x:h.center.y);if(Math.abs(d)>=h.radius)return [];const r=Math.sqrt(h.radius*h.radius-d*d),c=vertical?h.center.y:h.center.x;return [{start:c-r,end:c+r}];}
export function regionIntervals(points,openings,val,vertical,purpose='PANEL'){
  let out=ringIntervals(points,val,vertical);for(const h of openings||[]){if(purpose==='STRUCTURE'&&h.scope==='PANEL')continue;for(const cut of openingIntervals(h,val,vertical)){out=out.flatMap(s=>{if(cut.end<=s.start+EPS||cut.start>=s.end-EPS)return [s];const pieces=[];if(cut.start>s.start+EPS)pieces.push({start:s.start,end:cut.start});if(cut.end<s.end-EPS)pieces.push({start:cut.end,end:s.end});return pieces;});}}return out;
}
export const pointInRegion=(p,points,holes=[])=>pointLocation(p,points)>=0&&!holes.some(h=>openingLocation(p,h)>=0);
// Interior probes detect overlapping net regions, including coincident and collinear outlines.
// Shared edges are allowed. This is a review warning, never a boolean union of different products.
export function regionsOverlap(a,b){
  const pts=[...a.points,...b.points];const xs=pts.map(p=>p.x);if(Math.min(...xs.slice(0,a.points.length))>Math.max(...xs.slice(a.points.length))+EPS||Math.min(...xs.slice(a.points.length))>Math.max(...xs.slice(0,a.points.length))+EPS)return false;
  const probes=[];for(const region of [a,b])for(const {a:p,b:q} of segmentsOf(region.points)){const len=distance(p,q);for(const t of [.01,.5,.99]){const c={x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};for(const sign of [-1,1])probes.push({x:c.x+sign*(q.y-p.y)/len*1e-6,y:c.y-sign*(q.x-p.x)/len*1e-6});}}
  for(const s of segmentsOf(a.points))for(const t of segmentsOf(b.points)){const p=intersection(s.a,s.b,t.a,t.b);if(p)for(const dx of [-1,1])for(const dy of [-1,1])probes.push({x:p.x+dx*1e-6,y:p.y+dy*1e-6});}
  return probes.some(p=>pointLocation(p,a.points)===1&&pointLocation(p,b.points)===1&&pointInRegion(p,a.points,a.openings)&&pointInRegion(p,b.points,b.openings));
}
