import {regionIntervals} from './PlanGeometry.js';
export function installedPanelArea(points,holes,strips,wallGap=0){
 const vertical=strips[0]?.isVert,axis=p=>vertical?p.x:p.y;
 const events=[...points.map(axis),...holes.flatMap(h=>h.type==='circle'?[axis(h.center)-h.radius,axis(h.center)+h.radius]:h.points.map(axis))];
 const f=x=>regionIntervals(points,holes,x,vertical).reduce((n,s)=>n+Math.max(0,s.end-s.start-2*wallGap),0);
 function integral(a,b,depth=0){const d=(b-a)*1e-7,fa=f(a+d),fb=f(b-d),m=(a+b)/2,fm=f(m),whole=(b-a)*(fa+4*fm+fb)/6,left=(b-a)*(fa+4*f((a+m)/2)+fm)/12,right=(b-a)*(fm+4*f((m+b)/2)+fb)/12;if(depth>=14||Math.abs(left+right-whole)<1e-9)return left+right;return integral(a,m,depth+1)+integral(m,b,depth+1);}
 let area=0;const seen=new Set();for(const s of strips){const key=s.pos.toFixed(8);if(seen.has(key))continue;seen.add(key);const a=s.pos,b=a+s.width,cuts=[a,...events.filter(x=>x>a&&x<b),b].sort((x,y)=>x-y);for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>1e-10)area+=integral(cuts[i-1],cuts[i]);}return area;
}
export function panelRows(start,end,width,gap){
 const pitch=width+gap,span=end-start,count=Math.max(1,Math.ceil(span/pitch-1e-8)),offset=(span-(count*width+(count-1)*gap))/2;
 const rows=[];for(let i=0;i<count;i++)rows.push(start+offset+i*pitch);
 return rows;
}
// Add only the local portion of a carrier required at straight boundary edges.
export function supplementalRuns(points,holes,vertical,existing){
 const runs=[];const rings=[{points,inside:1},...holes.filter(h=>h.type==='polygon'&&h.scope!=='PANEL').map(h=>({points:h.points,inside:-1}))];
 for(const ring of rings){let signed=0;ring.points.forEach((p,i)=>{const q=ring.points[(i+1)%ring.points.length];signed+=p.x*q.y-q.x*p.y;});const orient=Math.sign(signed)*ring.inside;
 ring.points.forEach((p,i)=>{const q=ring.points[(i+1)%ring.points.length],dx=q.x-p.x,dy=q.y-p.y;
 if(vertical?Math.abs(dx)>1e-8:Math.abs(dy)>1e-8)return;
 const boundary=vertical?p.x:p.y,dir=vertical?-Math.sign(dy)*orient:Math.sign(dx)*orient,pos=boundary+dir*.15;
 const lo=vertical?Math.min(p.y,q.y):Math.min(p.x,q.x),hi=vertical?Math.max(p.y,q.y):Math.max(p.x,q.x);
 const breaks=[lo,hi,...existing.flatMap(r=>[r.start,r.end]).filter(v=>v>lo&&v<hi)].sort((a,b)=>a-b);
 for(let k=1;k<breaks.length;k++){const a=breaks[k-1],b=breaks[k],mid=(a+b)/2;const nearest=existing.filter(r=>r.start<=mid&&r.end>=mid&&(r.pos-boundary)*dir>1e-8).map(r=>(r.pos-boundary)*dir);if(nearest.length&&Math.min(...nearest)<=.3+1e-8)continue;
 for(const s of regionIntervals(points,holes,pos,vertical,'STRUCTURE')){const start=Math.max(a,s.start),end=Math.min(b,s.end);if(end-start>1e-8)runs.push({pos,start,end});}}
 });}
 return runs;
}
