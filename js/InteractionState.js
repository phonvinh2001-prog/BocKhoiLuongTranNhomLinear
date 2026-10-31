import {distance,polygonError} from './CadGeometry.js';

export function interactionState(cad,plan,state){
  const s=cad.session,p=s.draft.points,tool=s.tool||((state.mode==='DRAW')?'PL':null);
  const kind=plan.moving?'MOVE':plan.draft?(plan.draft.tool==='PL'?'HPL':plan.draft.tool==='REC'?'HREC':'HC'):tool||plan.interaction||'SELECT';
  const drawing=['PL','REC','HPL','HREC'].includes(kind),circle=['CIRCLE','HC'].includes(kind),busy=!!plan.moving||!!plan.draft||!!tool;
  let ready=false,step='Click chọn vùng · Shift chọn nhiều · M di chuyển';
  if(['PL','HPL'].includes(kind)){ready=p.length>=3&&!polygonError(p);step=p.length?`${p.length} đỉnh · Click điểm tiếp · Enter/Khép để đóng · Esc hủy`:'Click điểm đầu hoặc nhập x,y · Esc hủy';}
  else if(['REC','HREC'].includes(kind)){ready=s.picks.length===1&&Math.abs(s.picks[0].x-cad.cursor.x)>1e-8&&Math.abs(s.picks[0].y-cad.cursor.y)>1e-8;step=s.picks.length?'Chọn góc đối diện · Enter nhận điểm xem trước · Esc hủy':'Chọn góc thứ nhất hoặc nhập x,y';}
  else if(circle){ready=s.picks.length===1;step=ready?'Chọn điểm trên vòng tròn hoặc nhập bán kính · Enter tạo · Esc hủy':'Chọn tâm trên bản vẽ hoặc nhập x,y';}
  else if(['DIM','DLI'].includes(kind)){ready=s.picks.length===2&&distance(s.picks[0],s.picks[1])>1e-8;step=s.picks.length===2?'Chọn vị trí DIM · Enter nhận vị trí xem trước':s.picks.length?'Chọn điểm đo thứ hai':'Chọn điểm đo thứ nhất';}
  else if(kind==='DIST')step=s.picks.length?'Chọn điểm đo thứ hai':'Chọn điểm đo thứ nhất';
  else if(kind==='CAL')step=s.picks.length===2?'Nhập chiều dài thực vào ô lệnh rồi Enter':s.picks.length?'Chọn điểm hiệu chuẩn thứ hai':'Chọn điểm hiệu chuẩn thứ nhất';
  else if(kind==='MOVE'){ready=!!(plan.moving.base&&plan.moving.target);step=plan.moving.base?'Chọn điểm đích / nhập @dx,dy · Enter xác nhận xem trước · Esc hủy':'Chọn điểm gốc hoặc nhập x,y · Esc hủy';}
  else if(kind==='TRIM')step='Click cạnh để đổi viền · SELECT/Esc để chọn vùng';
  const local=drawing||!!plan.draft;
  return {kind,busy,ready,step,canClose:['PL','HPL'].includes(kind)&&ready,canUndo:plan.moving?!!plan.moving.base:local?(s.history.length>0||s.picks.length>0):busy?s.picks.length>0:plan.history.length>0,canRedo:plan.moving?false:local?s.future.length>0:!busy&&plan.future.length>0};
}
export function workSignature(s){return JSON.stringify([s.zoneId,s.zoneName,s.inputMode,s.inputs,s.points,s.openings||[],s.edgeTypes,s.manualJointsMap,s.jointConfig,s.presetName,s.presetColor,s.productRules,s.cad]);}
export function quantitySignature(s){return JSON.stringify([s.inputs,s.points,s.openings||[],s.edgeTypes,s.manualJointsMap,s.jointConfig,s.presetName,s.presetColor,s.productRules]);}
