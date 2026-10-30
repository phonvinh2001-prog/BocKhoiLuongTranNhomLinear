export const EPS=1e-8;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// One geometry definition is shared by the canvas annotation and DXF export.
export function dimensionGeometry({a,b,position:p,kind}){
  if(distance(a,b)<EPS)return null;
  if(kind==='linear')return Math.abs(p.y-(a.y+b.y)/2)>=Math.abs(p.x-(a.x+b.x)/2)
    ?{q1:{x:a.x,y:p.y},q2:{x:b.x,y:p.y},value:Math.abs(a.x-b.x)}
    :{q1:{x:p.x,y:a.y},q2:{x:p.x,y:b.y},value:Math.abs(a.y-b.y)};
  const value=distance(a,b),n={x:-(b.y-a.y)/value,y:(b.x-a.x)/value},off=(p.x-a.x)*n.x+(p.y-a.y)*n.y;
  return {q1:{x:a.x+n.x*off,y:a.y+n.y*off},q2:{x:b.x+n.x*off,y:b.y+n.y*off},value};
}
export function project(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return {x:a.x+t*dx,y:a.y+t*dy};}
export function intersection(a,b,c,d){const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<EPS)return null;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{x:a.x+t*dx,y:a.y+t*dy}:null;}
export function polygonError(points){
  if(points.length<3)return 'Biên cần ít nhất 3 đỉnh';
  if(points.length>2000)return 'Biên vượt 2.000 đỉnh; hãy tách vùng hoặc đơn giản hóa polyline';
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 'Tọa độ không hợp lệ';
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);if(Math.max(...xs)-Math.min(...xs)>1000||Math.max(...ys)-Math.min(...ys)>1000)return 'Vùng vượt 1.000 m; kiểm tra đơn vị hoặc tách vùng';
  let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(distance(a,b)<EPS)return 'Hai đỉnh liên tiếp trùng nhau';area+=a.x*b.y-a.y*b.x;}
  if(Math.abs(area)<EPS)return 'Biên không tạo được diện tích';
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||i===0&&j===points.length-1)continue;const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];if(intersection(a,b,c,d)||distance(project(a,c,d),a)<EPS||distance(project(b,c,d),b)<EPS)return 'Biên tự giao/chồng cạnh';}
  return null;
}
export function segmentsOf(points,closed=true){return points.slice(0,closed?points.length:-1).map((a,i)=>({a,b:points[(i+1)%points.length]}));}
export function snapPoint(raw,segments,{scale=50,radius=9,enabled=true,ortho=false,base=null,grid=0,circles=[],types=['END','MID','INT','PERP','NEAR','CEN','QUAD']}={}){
  let p={...raw},axis=null;if(ortho&&base){axis=Math.abs(raw.x-base.x)>=Math.abs(raw.y-base.y)?'H':'V';p=axis==='H'?{x:raw.x,y:base.y}:{x:base.x,y:raw.y};}
  const candidates=[],limit=radius/scale;
  const add=(q,type,rank)=>{if(!q||axis==='H'&&Math.abs(q.y-base.y)>EPS||axis==='V'&&Math.abs(q.x-base.x)>EPS)return;const d=distance(q,p);if(d<=limit)candidates.push({...q,type,rank,d});};
  if(enabled){for(const {center:c,radius:r} of circles){if(types.includes('CEN'))add(c,'CEN',0);if(types.includes('QUAD'))for(const q of [{x:c.x+r,y:c.y},{x:c.x-r,y:c.y},{x:c.x,y:c.y+r},{x:c.x,y:c.y-r}])add(q,'QUAD',1);if(types.includes('NEAR')){const d=distance(p,c);if(d>EPS)add({x:c.x+(p.x-c.x)*r/d,y:c.y+(p.y-c.y)*r/d},'NEAR',4);}}
    for(const {a,b} of segments){if(types.includes('END')){add(a,'END',0);add(b,'END',0);}if(types.includes('MID'))add({x:(a.x+b.x)/2,y:(a.y+b.y)/2},'MID',1);if(base&&types.includes('PERP')){const dx=b.x-a.x,dy=b.y-a.y,t=((base.x-a.x)*dx+(base.y-a.y)*dy)/(dx*dx+dy*dy);if(t>=0&&t<=1)add(project(base,a,b),'PERP',3);}if(types.includes('NEAR'))add(project(p,a,b),'NEAR',4);}
    // Intersections only among local segments inside the pick aperture; avoids quadratic work on entire plans.
    if(types.includes('INT')){const near=segments.filter(s=>distance(project(p,s.a,s.b),p)<=limit).slice(0,80);for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++)add(intersection(near[i].a,near[i].b,near[j].a,near[j].b),'INT',2);}
  }
  candidates.sort((a,b)=>a.rank-b.rank||a.d-b.d);if(candidates.length){const {x,y,type}=candidates[0];return {x,y,type};}
  if(grid>0){p={x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid};if(axis==='H')p.y=base.y;if(axis==='V')p.x=base.x;return {...p,type:'GRID'};}
  return {...p,type:axis?'ORTHO':null};
}
export function parseLength(text,unit='mm'){
  const m=String(text).trim().match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(mm|cm|m)?$/i);
  if(!m)throw Error('Nhập một số và đơn vị mm, cm hoặc m');const value=Number(m[1].replace(',','.'));
  const result=value*({mm:.001,cm:.01,m:1}[(m[2]||unit).toLowerCase()]);if(!Number.isFinite(result))throw Error('Số không hữu hạn');return result;
}
export function parseCadInput(text,unit='mm'){
  const s=text.trim();if(!s)return {type:'ENTER'};
  if(/^[a-z][a-z0-9_]*$/i.test(s))return {type:'COMMAND',value:s.toUpperCase()};
  const rel=s.startsWith('@'),body=rel?s.slice(1):s;
  if(body.includes('<')){const parts=body.split('<');if(parts.length!==2||!/^[-+]?\d+(?:\.\d+)?$/.test(parts[1]))throw Error('Góc cần số độ, ví dụ @4000<90');return {type:'POLAR',length:parseLength(parts[0],unit),angle:Number(parts[1])};}
  if(body.includes(',')){const parts=body.split(',');if(parts.length!==2)throw Error('Tọa độ dạng x,y hoặc @dx,dy');return {type:rel?'REL':'ABS',x:parseLength(parts[0],unit),y:-parseLength(parts[1],unit)};}
  return {type:'DIST',length:parseLength(body,unit)};
}
export function resolveCadPoint(input,last,cursor,ortho=false){
  if(input.type==='ABS')return {x:input.x,y:input.y};
  if(!last)throw Error('Chọn điểm đầu hoặc nhập tọa độ x,y');
  if(input.type==='REL')return {x:last.x+input.x,y:last.y+input.y};
  if(input.type==='POLAR'){if(input.length<=0)throw Error('Chiều dài phải lớn hơn 0');const r=input.angle*Math.PI/180;return {x:last.x+input.length*Math.cos(r),y:last.y-input.length*Math.sin(r)};}
  if(input.type==='DIST'){if(input.length<=0)throw Error('Chiều dài phải lớn hơn 0');let angle=Math.atan2(cursor.y-last.y,cursor.x-last.x);if(ortho)angle=Math.round(angle/(Math.PI/2))*Math.PI/2;return {x:last.x+input.length*Math.cos(angle),y:last.y+input.length*Math.sin(angle)};}
  throw Error('Không phải tọa độ');
}
export class CadSession{
  constructor(points=[],dimensions=[],circles=[],openings=[]){this.draft={points:structuredClone(points),closed:points.length>=3};this.openings=structuredClone(openings);this.dimensions=structuredClone(dimensions);this.circles=structuredClone(circles);this.tool=null;this.picks=[];this.history=[];this.future=[];this.message='PL: vẽ vùng · F8: khóa hướng · F3: bắt điểm';}
  snapshot(){return structuredClone({draft:this.draft,dimensions:this.dimensions,circles:this.circles,openings:this.openings});}
  record(){this.history.push(this.snapshot());if(this.history.length>100)this.history.shift();this.future=[];}
  start(tool){if(tool==='PL'||tool==='REC'){this.record();this.draft={points:[],closed:false};}this.tool=tool;this.picks=[];this.message=tool==='CIRCLE'?'CIRCLE: chọn tâm đường tròn':tool==='CAL'?'CAL: chọn điểm thứ nhất':tool==='PL'?'PL: chọn điểm đầu':tool==='REC'?'REC: chọn góc thứ nhất':tool==='DIM'||tool==='DLI'?'DIM: chọn điểm thứ nhất':'DIST: chọn điểm thứ nhất';}
  point(p){
    if(this.tool==='PL'){const a=this.draft.points;if(a.length>=3&&distance(p,a[0])<EPS)return this.close();if(a.length&&distance(p,a.at(-1))<EPS)throw Error('Điểm mới trùng điểm trước');this.record();a.push({...p});this.message='PL: điểm tiếp theo / C khép kín / U lùi';return;}
    if(this.tool==='CIRCLE'){if(!this.picks.length){this.picks.push({...p});this.message='CIRCLE: chọn điểm trên đường tròn hoặc nhập bán kính';}else this.circle(distance(this.picks[0],p));return;}
    if(!['REC','DIM','DLI','DIST','CAL'].includes(this.tool))throw Error('Gõ PL hoặc chọn một công cụ trước');
    this.picks.push({...p});if(this.tool==='REC'&&this.picks.length===2){const [a,b]=this.picks,pts=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}],err=polygonError(pts);if(err){this.picks.pop();throw Error(err);}this.record();this.draft={points:pts,closed:true};this.tool=null;this.picks=[];this.message='Đã tạo vùng chữ nhật';}
    else if(['DIM','DLI'].includes(this.tool)&&this.picks.length===3){const [a,b,position]=this.picks;if(distance(a,b)<EPS){this.picks=[];throw Error('DIM cần hai điểm khác nhau');}this.record();this.dimensions.push({a,b,position,kind:this.tool==='DLI'?'linear':'aligned'});this.tool=null;this.picks=[];this.message='Đã đặt DIM';}
    else if(this.tool==='DIST'&&this.picks.length===2){const [a,b]=this.picks;this.message=`DIST: ${(distance(a,b)*1000).toFixed(1)} mm · ΔX ${((b.x-a.x)*1000).toFixed(1)} · ΔY ${(-(b.y-a.y)*1000).toFixed(1)}`;this.tool=null;this.picks=[];}
    else if(this.tool==='CAL'&&this.picks.length===2)this.message='CAL: nhập chiều dài thực của đoạn vừa chọn';
    else this.message=['DIM','DLI'].includes(this.tool)&&this.picks.length===2?'DIM: chọn vị trí đặt đường kích thước':'Chọn điểm tiếp theo';
  }
  close(){const err=polygonError(this.draft.points);if(err)throw Error(err);this.record();this.draft.closed=true;this.tool=null;this.picks=[];this.message='Biên đã khép kín — có thể bóc khối lượng';}
  circle(radius){if(!this.picks[0]||!Number.isFinite(radius)||radius<=EPS||radius>1000)throw Error('Bán kính phải >0 và ≤1.000 m');this.record();this.circles.push({center:{...this.picks[0]},radius});this.tool=null;this.picks=[];this.message='Đã vẽ đường tròn tham chiếu; không tự trừ/tính khối lượng';}
  end(){if(this.tool==='PL'){this.tool=null;this.message='Đường PL đang mở. C để khép kín, PL tiếp tục, Esc hủy';}else{this.tool=null;this.picks=[];this.message='Đã kết thúc lệnh';}}
  undo(){if(!this.history.length)return;this.future.push(this.snapshot());Object.assign(this,this.history.pop());this.tool=this.draft.closed?null:'PL';this.picks=[];this.message='Đã hoàn tác';}
  redo(){if(!this.future.length)return;this.history.push(this.snapshot());Object.assign(this,this.future.pop());this.tool=this.draft.closed?null:'PL';this.picks=[];this.message='Đã làm lại';}
}
