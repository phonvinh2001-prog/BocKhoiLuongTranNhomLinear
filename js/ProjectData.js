export function validateSnapshot(s) {
  if(!s||!Array.isArray(s.points)||s.points.length>10000||!s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw new Error('Tọa độ dự án không hợp lệ');
  if(!s.inputs||typeof s.inputs!=='object'||Array.isArray(s.inputs))throw new Error('Thiếu thông số dự án');
  for(const [k,v] of Object.entries(s.inputs)){if(!/^(cfg_|dim_|shp_|l_orient$|u_orient$)/.test(k)||!['number','string'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))throw new Error('Thông số không hợp lệ: '+k);}
  if(s.manualJointsMap&&(!Object.values(s.manualJointsMap).every(a=>Array.isArray(a)&&a.every(Number.isFinite))))throw new Error('Mối nối không hợp lệ');
  return s;
}
export function validateProject(p){
  if(!p||!['17.0','18.0'].includes(p.version)||!Array.isArray(p.projectZones)||p.projectZones.length>10000)throw new Error('Phiên bản/cấu trúc dự án không được hỗ trợ');
  p.projectZones.forEach(z=>{if(!z||typeof z.name!=='string'||!z.stats||!Number.isFinite(z.stats.totalLinear))throw new Error('Khu vực không hợp lệ');validateSnapshot(z.savedState);});
  if(p.currentWork)validateSnapshot(p.currentWork);
  if(p.presets&&(!Array.isArray(p.presets)||!p.presets.every(x=>x&&typeof x.name==='string'&&[x.pW,x.gW,x.maxL].every(Number.isFinite)&&x.pW>0&&x.gW>=0&&x.maxL>0)))throw new Error('Thư viện mẫu không hợp lệ');
  return p;
}
