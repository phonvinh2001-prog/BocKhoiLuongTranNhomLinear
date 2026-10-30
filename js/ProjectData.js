import {openingsError} from './PlanGeometry.js';
export function validateCad(c){
  if(!c)return;if(c.version!==1||!Array.isArray(c.dimensions)||c.dimensions.length>2000)throw Error('Dữ liệu DIM không hợp lệ');
  const pt=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e7&&Math.abs(p.y)<1e7;
  if(!c.dimensions.every(d=>['aligned','linear'].includes(d.kind)&&pt(d.a)&&pt(d.b)&&pt(d.position)))throw Error('Tọa độ DIM không hợp lệ');
  if(c.options&&(!['mm','m'].includes(c.options.unit)||!Number.isFinite(c.options.gridStep)||c.options.gridStep<=0||!Array.isArray(c.options.types)||!c.options.types.every(t=>['END','MID','INT','PERP','NEAR','CEN','QUAD'].includes(t))))throw Error('Thiết lập bắt điểm không hợp lệ');
  if(c.circles&&(!Array.isArray(c.circles)||c.circles.length>2000||!c.circles.every(q=>pt(q.center)&&Number.isFinite(q.radius)&&q.radius>0&&q.radius<=1000)))throw Error('Đường tròn không hợp lệ');
  const src=c.source;if(!src)return;if(!Array.isArray(src.entities)||src.entities.length>30000||!src.entities.every(e=>typeof e.layer==='string'&&(e.points?Array.isArray(e.points)&&e.points.every(pt):e.type==='circle'?pt(e.center)&&Number.isFinite(e.radius)&&e.radius>0:e.type==='text'&&pt(e.at)&&typeof e.text==='string')))throw Error('Bản vẽ nền không hợp lệ');
  if(src.entities.reduce((n,e)=>n+(e.points?.length||1),0)>30000)throw Error('Quá nhiều đỉnh nền');
  const b=src.background;if(b&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(b.dataURL)||b.dataURL.length>24e6||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0))throw Error('Ảnh nền không hợp lệ');
}
export function validateSnapshot(s) {
  if(!s||!Array.isArray(s.points)||s.points.length>10000||!s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw new Error('Tọa độ dự án không hợp lệ');
  if(!s.inputs||typeof s.inputs!=='object'||Array.isArray(s.inputs))throw new Error('Thiếu thông số dự án');
  for(const [k,v] of Object.entries(s.inputs)){if(!/^(cfg_|dim_|shp_|l_orient$|u_orient$)/.test(k)||!['number','string'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))throw new Error('Thông số không hợp lệ: '+k);}
  if(s.manualJointsMap&&(!Object.values(s.manualJointsMap).every(a=>Array.isArray(a)&&a.every(Number.isFinite))))throw new Error('Mối nối không hợp lệ');
  if(s.openings?.length){const err=openingsError(s.points,s.openings);if(err)throw Error(err);}else if(s.openings&&!Array.isArray(s.openings))throw Error('Danh sách lỗ không hợp lệ');
  if(s.zoneId!==undefined&&s.zoneId!==null&&!['string','number'].includes(typeof s.zoneId))throw Error('ID vùng không hợp lệ');
  if(s.zoneName!==undefined&&typeof s.zoneName!=='string')throw Error('Tên vùng không hợp lệ');
  validateCad(s.cad);return s;
}
export function validateProject(p){
  if(!p||!['17.0','18.0'].includes(p.version)||!Array.isArray(p.projectZones)||p.projectZones.length>10000)throw new Error('Phiên bản/cấu trúc dự án không được hỗ trợ');
  p.projectZones.forEach(z=>{if(!z||typeof z.name!=='string'||!z.stats||!Number.isFinite(z.stats.totalLinear))throw new Error('Khu vực không hợp lệ');validateSnapshot(z.savedState);});
  if(p.currentWork)validateSnapshot(p.currentWork);
  if(p.presets&&(!Array.isArray(p.presets)||!p.presets.every(x=>x&&typeof x.name==='string'&&[x.pW,x.gW,x.maxL].every(Number.isFinite)&&x.pW>0&&x.gW>=0&&x.maxL>0)))throw new Error('Thư viện mẫu không hợp lệ');
  return p;
}
