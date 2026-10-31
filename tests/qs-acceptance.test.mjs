import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,rect} from './helpers/quantity-fixture.mjs';
import {distribute,packCuts} from '../js/QuantityRules.js';
import {JointSolver} from '../js/JointSolver.js';
import {validateProject} from '../js/ProjectData.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`actual=${a}; expected=${b}`);
const results=[],observations={};
function check(id,title,fn){test(id+' '+title,fn);}
const metrics=a=>{const m=a.calculateBOQData();return {panelRows:a.state.strips.length,panelLength:Number(m.panels.totalLen),carriers:Number(m.carriers.totalLen),hangers:m.hangers.total,carrierBars:m.carriers.bars,rodBars:m.hangers.tyRenBars};};

check('G01','4×3 m tính tay: 40 tấm ×3 m, xương 16 m, 4 nối, 24 ty, 6 cây xương, 8 cây ty',()=>{
 const {app}=fixture(),m=app.calculateBOQData();assert.deepEqual(metrics(app),{panelRows:40,panelLength:120,carriers:16,hangers:24,carrierBars:6,rodBars:8});near(m.ceilingArea,12);assert.equal(m.carriers.couplers,4);observations.rectangle=metrics(app);
});
check('G02','Ngưỡng hở cuối 299/300 mm không bù; 301 mm bù về 150 mm',()=>{for(const gap of [.299,.3,.301]){const a=distribute(0,1.15+gap,1);assert.equal(a.length,gap>.3?3:2);if(gap>.3)near(1.15+gap-a.at(-1),.15);}});
check('G03','300 mẫu phân bố: đầu 150 mm, cuối ≤300 mm, không vượt bước',()=>{for(let i=0;i<300;i++){const end=.31+i*.073,step=.5+(i%7)*.2,a=distribute(0,end,step);near(a[0],.15);assert.ok(end-a.at(-1)<=.30000001);for(let j=1;j<a.length;j++)assert.ok(a[j]>a[j-1]&&a[j]-a[j-1]<=step+1e-8);}});
check('G04','Chia tấm 13 m căn giữa với khổ 6 m: 3.5 + 6 + 3.5',()=>assert.deepEqual(new JointSolver().solveStrip(13,6,{pattern:'BALANCED'}),[3.5,6,3.5]));
check('G05','Đoạn 6.1 m không để đuôi 100 mm nếu minCut=200 mm',()=>{const p=new JointSolver().solveStrip(6.1,6,{},.2);assert.equal(p.length,2);near(p[0],3.05);near(p[1],3.05);});
check('G06','Hai điểm nối thủ công trùng chỉ tính một',()=>assert.deepEqual(new JointSolver().solveStrip(10,6,{manualJoints:[5,5]}),[5,5]));
check('G07','Lỗ chữ nhật: 10×6 − 2×2 = 56 m² ở cả hai hướng rải',()=>{for(const dir of ['0','90']){const {app}=fixture({points:rect(0,0,10,6),openings:[{id:'h',scope:'VOID',type:'polygon',points:rect(2,2,2,2)}],inputs:{cfg_dir:dir}});near(app.calculateBOQData().ceilingArea,56);}});
check('G08','Lỗ tròn R1: diện tích net = 60 − π m²',()=>{const {app}=fixture({points:rect(0,0,10,6),openings:[{id:'h',scope:'VOID',type:'circle',center:{x:5,y:3},radius:1}]});near(app.calculateBOQData().ceilingArea,60-Math.PI);});
check('G09','Lỗ chỉ tấm giữ nguyên tổng xương và số ty',()=>{const before=metrics(fixture().app),after=metrics(fixture({openings:[{id:'h',scope:'PANEL',type:'polygon',points:rect(1,1,1,1)}]}).app);near(after.carriers,before.carriers);assert.equal(after.hangers,before.hangers);assert.ok(after.panelLength<before.panelLength);});
check('G10','Lỗ VOID: không có ty trong lỗ; mọi ty nằm trên tuyến xương',()=>{const {app}=fixture({openings:[{id:'h',scope:'VOID',type:'polygon',points:rect(1,1,1,1)}]});for(const p of app.state.hangers){assert.ok(!(p.x>1&&p.x<2&&p.y>1&&p.y<2));assert.ok(app.state.carriers.some(c=>Math.abs((c.x2-c.x1)*(p.y-c.y1)-(c.y2-c.y1)*(p.x-c.x1))<1e-7&&p.x>=Math.min(c.x1,c.x2)-1e-8&&p.x<=Math.max(c.x1,c.x2)+1e-8&&p.y>=Math.min(c.y1,c.y2)-1e-8&&p.y<=Math.max(c.y1,c.y2)+1e-8));}});
check('G11','Ty 3900 − 3000 + 50 = 950 mm; thiếu cao độ không tự ra lượng mua',()=>{const {app,el}=fixture({inputs:{cfg_rodMode:'ELEVATION',cfg_rodAdjust:'50'}});near(app.getRodLength(),.95);el('cfg_anchorZ').value='';assert.equal(app.calculateBOQData().hangers.tyRenBars,null);});
check('G12','Ba ty 2 m từ cây 3 m cần ba cây, không dùng tổng mét chia cây',()=>assert.equal(packCuts([2,2,2],3).count,3));
check('G13','100 bộ cắt: bảo toàn dài sử dụng + kerf + dư = dài mua, không âm dư',()=>{let seed=71;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);for(let i=0;i<100;i++){const lengths=Array.from({length:1+i%31},()=>.05+rand()*2.95),p=packCuts(lengths,3);near(p.used+p.kerf+p.remainder,p.purchased);for(const b of p.bars)assert.ok(b.remaining>=-1e-8);}});
check('G14','Quay mặt bằng 90° và đổi hướng rải giữ tổng lượng',()=>assert.deepEqual(metrics(fixture({points:rect(0,0,4,3)}).app),metrics(fixture({points:rect(0,0,3,4),inputs:{cfg_dir:'0'}}).app)));
check('G15','Đảo chiều đỉnh biên không đổi tổng lượng',()=>assert.deepEqual(metrics(fixture().app),metrics(fixture({points:rect(0,0,4,3).reverse()}).app)));
check('G16','Tổng mua hai vùng cùng quy cách bằng tổng lượng tính riêng; không tái dùng dư liên vùng',()=>{const {app}=fixture(),m=app.calculateBOQData();app.state.projectZones=[{name:'A',stats:{accessories:m}},{name:'B',stats:{accessories:structuredClone(m)}}];const sum=app.purchaseSummary(app.projectRows());assert.equal(sum.find(r=>r[0]==='Xương')[2],12);assert.equal(sum.find(r=>r[0]==='Ty ren')[2],16);});

check('F01','Tịnh tiến vùng không được đổi số thanh (kiểm tra 100 hình chữ nhật)',()=>{
 const failures=[];for(let i=0;i<100;i++){const w=1+(i%20)*.1,h=1+Math.floor(i/20)*.2,a=metrics(fixture({points:rect(0,0,w,h)}).app),b=metrics(fixture({points:rect(123.456,789.123,w,h)}).app);if(JSON.stringify(a)!==JSON.stringify(b))failures.push({w,h,origin:a,translated:b});}observations.translation={cases:100,failures:failures.length,examples:failures.slice(0,5)};assert.equal(failures.length,0);
});
check('F02','Nhịp đúng 300 mm phải tính được tại mọi tọa độ',()=>{const errors=[];for(const x of [0,1,3,100]){try{fixture({points:rect(x,0,.3,3)});}catch(e){errors.push({x,message:e.message});}}observations.span300=errors;assert.equal(errors.length,0);});
check('F03','Bù xương cạnh lỗ khi hở >300 mm theo yêu cầu đã chốt',()=>{
 const {app}=fixture({points:rect(0,0,10,6),openings:[{id:'h',scope:'VOID',type:'polygon',points:rect(2,2.6,2,.6)}]});const rows=app.state.carriers.filter(c=>c.x1<=3&&c.x2>=3).map(c=>c.y1),before=2.6-Math.max(...rows.filter(y=>y<2.6)),after=Math.min(...rows.filter(y=>y>3.2))-3.2;observations.holeEdge={hole:{x:2,y:2.6,w:2,h:.6},rows,before,after,requiredAdditionalRows:[2.45,3.35]};assert.ok(before<=.30000001&&after<=.30000001,`edge gaps ${before} m / ${after} m`);
});
check('F04','Cạnh lõm chữ L cũng phải có xương đầu cách 150 mm',()=>{
 const points=[{x:0,y:0},{x:4,y:0},{x:4,y:3.2},{x:8,y:3.2},{x:8,y:6},{x:0,y:6}],{app}=fixture({points}),rows=app.state.carriers.filter(c=>c.x1<=6&&c.x2>=6).map(c=>c.y1),first=Math.min(...rows);observations.concaveEdge={points,rows,firstGap:first-3.2,expectedFirstY:3.35};near(first-3.2,.15);
});
check('F05','Bảng NORM không đưa ra cut list cần nhiều cây hơn lượng mua (dự phòng 0%)',()=>{const {app}=fixture(),m=app.calculateBOQData('NORM');observations.norm={carrierMeters:m.carriers.totalLen,carrierBarsToBuy:m.carriers.bars,carrierBarsInCutPlan:m.carriers.plan?.count??null,carrierMetersInCutPlan:m.carriers.plan?.used??null};assert.ok(m.carriers.plan===null||m.carriers.bars>=m.carriers.plan.count,JSON.stringify(observations.norm));});
check('F06','Bảng đặt mua phải có tấm nhôm khi có tấm lắp đặt',()=>{const {app}=fixture(),m=app.calculateBOQData(),rows=app.purchaseSummary(app.boqRows(m,'A'));observations.purchase={installationPanelGroups:m.panels.groups,purchaseRows:rows};assert.ok(rows.slice(1).some(r=>r[0].includes('AUDIT-100')),'Không có tấm AUDIT-100 trong tổng hợp mua');});
check('F07','Diện tích mặt nhôm lắp đặt không vượt diện tích trần khi không khe',()=>{const {app}=fixture({points:rect(0,0,4.03,3)}),m=app.calculateBOQData();observations.faceArea={gross:m.grossArea,reportedFace:m.panelFaceArea,rows:app.state.strips.length};assert.ok(m.panelFaceArea<=m.ceilingArea+1e-7,JSON.stringify(observations.faceArea));});
check('F08','Kiểm tra tuyên bố tối ưu cắt: bộ có phương án 2 cây không trả 3 cây',()=>{const lengths=[5.98,4.98,2.98,1.98,1.98,1.98],plan=packCuts(lengths,10,.005),feasibleTwo=[[5.98,1.98,1.98],[4.98,2.98,1.98]];for(const bin of feasibleTwo)assert.ok(bin.reduce((a,b)=>a+b,0)+bin.length*.005<=10);observations.packing={lengths,stock:10,kerf:.005,actualBars:plan.count,actualCuts:plan.bars.map(b=>b.cuts),feasibleTwo};assert.equal(plan.count,2);});
check('F09','Dự án có snapshot 24 m² không được xuất lại kết quả lưu 12 m²',()=>{const {app}=fixture(),record=app.buildZoneRecord('A','A');record.savedState.points=rect(0,0,8,3);const p={version:'18.0',projectZones:[record]};let rejected=false;try{validateProject(p);}catch{rejected=true;}app.state.projectZones=p.projectZones;const rows=app.projectRows(),exportedArea=Number(rows.find(r=>r[1]==='Diện tích trần net')?.[4]);observations.staleSnapshot={newGeometryArea:24,savedArea:record.stats.accessories.ceilingArea,validationAccepted:!rejected,exportedArea};assert.ok(rejected||Math.abs(exportedArea-24)<1e-7||(!Number.isFinite(exportedArea)&&rows.some(r=>String(r[1]).includes('tính lại'))),'Snapshot 24 m² nhưng bảng dự án vẫn xuất 12 m²');});
