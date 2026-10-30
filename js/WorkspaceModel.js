export const DEFAULT_LAYERS=Object.freeze({panels:true,carriers:true,hangers:true,panelJoints:true,carrierJoints:true,trims:true,dimensions:true});
export function statusFor(metrics,dirty=false){
  if(dirty)return {label:'Cần tính lại',tone:'pending'};
  if(!metrics)return {label:'Chưa có vùng',tone:'muted'};
  if(metrics.warnings?.length)return {label:'Cần kiểm tra',tone:'warning'};
  return {label:'Đủ thông tin tính',tone:'ready'};
}
export function visibleRows(rows,tab,query=''){
  const body=rows.slice(1).filter(r=>tab==='warnings'?String(r[1]).startsWith('CẢNH BÁO:'):tab==='purchase'?['Mua','Cây mua'].includes(r[2]):['Đoạn lắp','Mét lắp','Điểm lắp'].includes(r[2]));
  const term=query.trim().toLocaleLowerCase('vi');
  return [rows[0],...body.filter(r=>!term||r.join(' ').toLocaleLowerCase('vi').includes(term))];
}
