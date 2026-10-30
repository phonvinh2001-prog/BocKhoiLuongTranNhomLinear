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
// Between vertex/extremum/intersection X events, the vertical ordering of every
// boundary is unchanged. Test the interior of each slab, including exact circle arcs.
function boundaries(region){return [...segmentsOf(region.points).map(s=>({...s,type:'line'})),...(region.openings||[]).flatMap(h=>h.type==='circle'?[h]:segmentsOf(h.points).map(s=>({...s,type:'line'})))];}
function bounds(p){return p.type==='circle'?[p.center.x-p.radius,p.center.x+p.radius,p.center.y-p.radius,p.center.y+p.radius]:[Math.min(p.a.x,p.b.x),Math.max(p.a.x,p.b.x),Math.min(p.a.y,p.b.y),Math.max(p.a.y,p.b.y)];}
function crossingPoints(a,b){
  const x=bounds(a),y=bounds(b);if(x[0]>y[1]+EPS||y[0]>x[1]+EPS||x[2]>y[3]+EPS||y[2]>x[3]+EPS)return [];
  if(a.type!=='circle'&&b.type!=='circle'){const p=intersection(a.a,a.b,b.a,b.b);return p?[p]:[];}
  if(a.type==='circle'&&b.type==='circle'){
    const d=distance(a.center,b.center);if(d<EPS||d>a.radius+b.radius+EPS||d<Math.abs(a.radius-b.radius)-EPS)return [];
    const along=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h2=a.radius*a.radius-along*along;if(h2<-EPS)return [];
    const dx=(b.center.x-a.center.x)/d,dy=(b.center.y-a.center.y)/d,h=Math.sqrt(Math.max(0,h2)),p={x:a.center.x+along*dx,y:a.center.y+along*dy};
    return [{x:p.x-dy*h,y:p.y+dx*h},{x:p.x+dy*h,y:p.y-dx*h}];
  }
  const c=a.type==='circle'?a:b,l=a.type==='circle'?b:a,dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,ox=l.a.x-c.center.x,oy=l.a.y-c.center.y;
  const A=dx*dx+dy*dy;if(A<EPS*EPS)return [];const B=2*(dx*ox+dy*oy),C=ox*ox+oy*oy-c.radius*c.radius,D=B*B-4*A*C;if(D<0)return [];
  return [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)].filter(t=>t>=-EPS&&t<=1+EPS).map(t=>({x:l.a.x+t*dx,y:l.a.y+t*dy}));
}
export function regionsOverlap(a,b){
  if(a.points.length<3||b.points.length<3)return false;
  const ax=a.points.map(p=>p.x),bx=b.points.map(p=>p.x),ay=a.points.map(p=>p.y),by=b.points.map(p=>p.y);
  const left=Math.max(Math.min(...ax),Math.min(...bx)),right=Math.min(Math.max(...ax),Math.max(...bx));
  if(right-left<=EPS||Math.min(Math.max(...ay),Math.max(...by))-Math.max(Math.min(...ay),Math.min(...by))<=EPS)return false;
  const ap=boundaries(a),bp=boundaries(b),xs=[left,right];for(const p of [...ap,...bp]){const box=bounds(p);xs.push(box[0],box[1]);}
  for(const p of ap)for(const q of bp)for(const at of crossingPoints(p,q))xs.push(at.x);
  const events=xs.filter(x=>x>=left-EPS&&x<=right+EPS).sort((x,y)=>x-y).filter((x,i,all)=>!i||x-all[i-1]>EPS);
  for(let k=1;k<events.length;k++){if(events[k]-events[k-1]<=EPS)continue;const x=(events[k]+events[k-1])/2,A=regionIntervals(a.points,a.openings||[],x,true),B=regionIntervals(b.points,b.openings||[],x,true);let i=0,j=0;
    while(i<A.length&&j<B.length){if(Math.min(A[i].end,B[j].end)-Math.max(A[i].start,B[j].start)>EPS)return true;if(A[i].end<B[j].end)i++;else j++;}
  }return false;
}
