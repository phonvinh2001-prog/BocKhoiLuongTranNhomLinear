import {CadSession,parseCadInput,polygonError,segmentsOf,distance,project} from './CadGeometry.js';
import {openingsError,openingArea,openingBounds,openingLocation,pointInRegion,regionsOverlap} from './PlanGeometry.js';
import {escapeHTML} from './QuantityRules.js';

const geometry=s=>JSON.stringify([s.points,s.openings||[],s.cad?.dimensions||[],s.cad?.circles||[]]);

export default class PlanController{
  constructor(cad){
    this.cad=cad;this.app=cad.app;this.ui=cad.ui;this.draft=null;this.base=null;this.newRegion=false;this.history=[];this.future=[];this.restoring=false;this.persisting=false;
    this.originalStart=cad.start.bind(cad);this.originalSync=cad.sync.bind(cad);this.originalCommand=cad.command.bind(cad);this.originalCancel=cad.cancel.bind(cad);
    this.originalAdd=this.app.addToProject.bind(this.app);this.originalEdit=this.app.editZone.bind(this.app);this.originalDelete=this.app.deleteZone.bind(this.app);
    cad.scene=this;this.build();this.hook();this.refresh();
  }
  snapshot(){return {zones:structuredClone(this.app.state.projectZones),work:this.app.captureState(),name:document.getElementById('projectName').value};}
  remember(base){if(!base||this.restoring)return;this.history.push(base);if(this.history.length>20)this.history.shift();this.future=[];}
  restore(s){
    this.restoring=true;this.draft=null;this.base=null;this.newRegion=false;this.app.state.projectZones=structuredClone(s.zones);this.app.state.editingIndex=null;
    document.getElementById('projectName').value=s.name;this.app.restoreState(s.work);this.restoring=false;this.refresh();this.ui.refresh();this.app.draw();this.app.autoSave();
  }
  build(){
    const panel=document.createElement('details');panel.className='inspector-section plan-openings';panel.open=true;
    panel.innerHTML='<summary>Vùng trần & lỗ kỹ thuật</summary><div class="section-content"><div class="plan-actions"><button data-plan="PL">+ Vùng trần</button><button data-plan="REC">+ Vùng chữ nhật</button><button data-plan="HOLE">Lỗ đa giác</button><button data-plan="HREC">Lỗ chữ nhật</button><button data-plan="HC">Lỗ tròn</button></div><p>Khép biên vẫn tính vùng hiện tại. Vẽ tiếp để thêm vùng; chọn vùng bên trái hoặc trên bản vẽ để sửa.</p><label for="plan_hole_scope">Mặc định lỗ mới</label><select id="plan_hole_scope"><option value="VOID">Trừ tấm, xương và ty</option><option value="PANEL">Chỉ trừ tấm</option></select><div id="plan_opening_list"></div><p id="plan_review" role="status"></p></div>';
    document.querySelector('.workspace-inspector .scroll-area').prepend(panel);
    panel.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>this.cad.command(b.dataset.plan)));
    const toolbar=document.querySelector('.cad-toolbar');const b=document.createElement('button');b.type='button';b.textContent='HOLE · Lỗ';b.addEventListener('click',()=>this.cad.command('HOLE'));toolbar.prepend(b);
    const fit=document.createElement('button');fit.textContent='Vùng chọn';fit.title='Vừa khung vùng đang chọn (ZA)';fit.addEventListener('click',()=>this.ui.fit(this.app.state.points));document.querySelector('.drawing-tools>div').prepend(fit);
    document.querySelector('.zones-help').textContent='Các vùng cùng mặt bằng. Chọn vùng để sửa; mỗi lỗ thuộc vùng đang chọn. Vùng khép kín tự lưu/cập nhật vào dự án.';
  }
  hook(){
    const a=this.app,c=this.cad;
    const metrics=a.calculateBOQData.bind(a);a.calculateBOQData=force=>{const m=metrics(force);if(a.state.points.length>=3)for(const z of a.state.projectZones){if(z.id!==a.state.activeZoneId&&regionsOverlap({points:a.state.points,openings:a.state.openings||[]},z.savedState))m.warnings.push(`Vùng chồng diện tích với ${z.name}; tổng dự án có thể tính trùng`);}m.complete=!m.warnings.length;return m;};
    c.start=tool=>this.start(tool);c.sync=()=>this.sync();c.command=text=>this.command(text);c.cancel=()=>this.cancel();
    a.addToProject=()=>{try{this.commit();this.refresh();}catch(e){c.message(e.message,true);}};
    a.editZone=index=>this.select(index);a.deleteZone=index=>this.removeRegion(index);this.ui.newZone=()=>c.command('PL');
    const capture=a.captureState.bind(a);a.captureState=()=>{const s=capture();if(this.draft){s.cad.dimensions=structuredClone(this.draft.session.dimensions);s.cad.circles=structuredClone(this.draft.session.circles);}return s;};
    const restore=a.restoreState.bind(a);a.restoreState=s=>{this.draft=null;this.base=null;restore(s);this.refresh();};
    const down=a.cont.onmousedown;a.cont.onmousedown=e=>{
      if(e.target===a.cvs&&e.button===0&&!c.session.tool&&!this.draft&&a.state.mode!=='DRAW'&&!a.state.isJointEditing){
        const p=a.getMouse(e),holes=a.state.openings||[];if(a.state.edges.some(edge=>distance(p,project(p,edge.p1,edge.p2))<8/a.state.scale)){down(e);return;}const h=holes.find(h=>openingLocation(p,h)>=0);
        if(h){this.selectedHole=h.id;this.refresh();a.draw();return;}
        const index=a.state.projectZones.findIndex(z=>z.id!==a.state.activeZoneId&&pointInRegion(p,z.savedState.points,z.savedState.openings));
        if(index>=0){this.select(index);return;}
      }down(e);
    };
    const background=c.drawBackground.bind(c);c.drawBackground=ctx=>{background(ctx);this.drawOtherRegions(ctx);};
    const overlay=c.drawOverlay.bind(c);c.drawOverlay=ctx=>{overlay(ctx);this.drawOpenings(ctx);};
    const fit=c.fitPoints.bind(c);c.fitPoints=()=>[...fit(),...a.state.projectZones.flatMap(z=>z.savedState.points)];
    const newProject=a.newProject.bind(a);a.newProject=()=>{const before=a.state.projectZones,pending=this.draft;this.draft=null;newProject();if(before!==a.state.projectZones){this.history=[];this.future=[];this.base=null;this.newRegion=false;c.input.restore(null);this.refresh();}else this.draft=pending;};
    const useBoundary=c.useBoundary.bind(c);c.useBoundary=points=>{if(this.draft||a.state.mode==='DRAW')return c.message('Kết thúc hình đang vẽ trước',true);this.start('PL');c.session.tool=null;useBoundary(points);};
    const exportFile=this.ui.export.bind(this.ui);this.ui.export=kind=>{try{if(this.draft||a.state.mode==='DRAW')throw Error('Khép kín hoặc hủy hình đang vẽ trước khi xuất');this.commit();exportFile(kind);}catch(e){c.message(e.message,true);}};
    const calculate=a.calculate.bind(a);a.calculate=()=>{calculate();if(!this.persisting&&!this.restoring&&!this.draft&&!c.session.tool&&a.state.mode!=='DRAW'&&a.state.activeZoneId&&a.state.strips.length&&!c.errors.length){this.commit();this.refresh();}};
    const switchMode=a.switchMode.bind(a);a.switchMode=mode=>{try{if(this.draft)throw Error('Esc hủy hoặc khép lỗ trước khi đổi cách vẽ');switchMode(mode);}catch(e){c.message(e.message,true);}};
  }
  commit(){
    if(this.persisting||this.restoring)return;
    const a=this.app;if(a.state.mode==='DRAW'||polygonError(a.state.points))throw Error('Khép kín hoặc hủy vùng đang vẽ trước');
    this.persisting=true;
    try{
      a.calculate();if(this.cad.errors.length||!a.state.strips.length)throw Error(this.cad.errors[0]||'Vùng chưa có khối lượng hợp lệ');
      let index=a.state.projectZones.findIndex(z=>z.id===a.state.activeZoneId);const id=index>=0?a.state.projectZones[index].id:crypto.randomUUID();
      const name=document.getElementById('projectName').value.trim()||(index>=0?a.state.projectZones[index].name:`Vùng ${a.state.projectZones.length+1}`);
      a.state.activeZoneId=id;a.state.editingIndex=index>=0?index:null;document.getElementById('projectName').value=name;
      const oldCount=a.state.projectZones.length;this.originalAdd();if(index<0)index=oldCount;
      const record=a.state.projectZones[index];if(!record)throw Error('Chưa lưu được vùng');record.id=id;record.savedState.zoneId=id;
      a.state.editingIndex=index;document.getElementById('projectName').value=name;a.updateAddButtonUI();this.ui.refresh();a.autoSave();
    }finally{this.persisting=false;}
  }
  start(tool){
    if(this.draft)throw Error('Khép kín hoặc Esc hủy lỗ đang vẽ trước');
    if(this.app.state.mode==='DRAW')throw Error('Vùng đang mở: C khép kín hoặc Esc hủy trước');
    this.base=this.snapshot();this.newRegion=['PL','REC'].includes(tool);
    if(['PL','REC'].includes(tool)){
      if(this.app.state.points.length>=3)this.commit();
      this.app.state.editingIndex=null;this.app.state.activeZoneId=null;this.app.state.points=[];this.app.state.openings=[];this.app.state.edges=[];
      this.cad.session=new CadSession();
      document.getElementById('projectName').value=`Vùng ${this.app.state.projectZones.length+1}`;
    }
    this.originalStart(tool);this.refresh();
  }
  startOpening(tool){
    if(this.draft||this.app.state.mode==='DRAW')throw Error('Khép kín/hủy hình đang vẽ trước khi thêm lỗ');
    if(polygonError(this.app.state.points))throw Error('Chọn một vùng trần kín trước khi thêm lỗ');
    this.commit();this.base=this.snapshot();this.newRegion=false;
    this.draft={tool,scope:document.getElementById('plan_hole_scope').value,session:this.cad.session,initialCircles:0};
    this.cad.session=new CadSession();this.originalStart(tool);this.draft.initialCircles=this.cad.session.circles.length;
    this.cad.message('Lỗ kỹ thuật: '+(tool==='CIRCLE'?'chọn tâm rồi nhập bán kính':'vẽ biên bên trong vùng, C khép kín'));this.refresh();
  }
  sync(){
    const c=this.cad,a=this.app;
    if(this.draft){
      const s=c.session,d=this.draft;let hole=null;
      if(d.tool==='CIRCLE'&&s.circles.length>d.initialCircles){hole={type:'circle',...s.circles.at(-1)};}
      if(d.tool!=='CIRCLE'&&s.draft.closed)hole={type:'polygon',points:structuredClone(s.draft.points)};
      if(!hole){c.update();a.draw();return;}
      hole={...hole,id:crypto.randomUUID(),name:`Lỗ ${(a.state.openings||[]).length+1}`,scope:d.scope};
      const holes=[...(a.state.openings||[]),hole],err=openingsError(a.state.points,holes);if(err)throw Error(err);
      c.session=d.session;c.session.openings=holes;this.draft=null;this.selectedHole=hole.id;
      this.originalSync();this.commit();this.remember(this.base);this.base=null;this.refresh();c.message('Đã thêm lỗ kỹ thuật, cập nhật khối lượng vùng');a.draw();return;
    }
    this.originalSync();
    if(c.session.draft.closed&&!c.session.tool){
      const now=a.captureState(),changed=this.base&&(this.newRegion||geometry(this.base.work)!==geometry(now));
      if(changed){this.commit();this.remember(this.base);}this.base=null;this.newRegion=false;this.refresh();
    }
  }
  command(text){
    try{
      const input=parseCadInput(text,this.cad.options.unit),cmd=input.type==='COMMAND'?input.value:null;
      if(cmd==='ZA'){this.ui.fit(this.app.state.points);return;}
      if(['HOLE','HPL','HREC','HC'].includes(cmd))return this.startOpening(cmd==='HREC'?'REC':cmd==='HC'?'CIRCLE':'PL');
      if(['U','UNDO','REDO'].includes(cmd)&&!this.draft&&this.app.state.mode!=='DRAW'){
        if(this.cad.session.tool&&this.cad.session.picks.length){this.cad.session.picks.pop();this.app.draw();return;}
        const from=cmd==='REDO'?this.future:this.history,to=cmd==='REDO'?this.history:this.future;
        if(from.length){const next=from.pop();to.push(this.snapshot());this.restore(next);this.cad.message(cmd==='REDO'?'Đã làm lại thay đổi mặt bằng':'Đã hoàn tác thay đổi mặt bằng');return;}
      }
      if(this.draft&&['PL','PLINE','L','LINE'].includes(cmd)&&this.cad.session.draft.points.length===0){this.cad.session.tool='PL';this.draft.tool='PL';this.cad.update();return;}
      if(this.draft&&['U','UNDO'].includes(cmd)&&this.draft.tool==='CIRCLE'){this.cad.session=new CadSession();this.cad.session.start('CIRCLE');this.draft.initialCircles=0;this.cad.update();this.app.draw();return;}
      this.originalCommand(text);
    }catch(e){this.cad.message(e.message,true);}
  }
  cancel(){
    if(this.draft){this.cad.session=this.draft.session;this.draft=null;this.base=null;this.cad.message('Đã hủy lỗ đang vẽ; giữ nguyên vùng trần');this.refresh();this.app.draw();return;}
    if(this.base&&(['PL','REC'].includes(this.cad.session.tool)||this.app.state.mode==='DRAW')){const base=this.base;this.restore(base);this.cad.message('Đã hủy vùng đang vẽ; giữ các vùng trước');return;}
    this.base=null;this.originalCancel();this.refresh();
  }
  select(index){
    try{if(this.draft||this.app.state.mode==='DRAW')throw Error('Khép kín hoặc Esc hủy hình đang vẽ trước khi đổi vùng');
      if(this.app.state.points.length>=3)this.commit();this.originalEdit(index);this.selectedHole=null;this.refresh();this.app.draw();
    }catch(e){this.cad.message(e.message,true);}
  }
  removeRegion(index){
    try{if(this.draft||this.app.state.mode==='DRAW')throw Error('Kết thúc hình đang vẽ trước khi xóa vùng');const base=this.snapshot(),id=this.app.state.activeZoneId,deleted=this.app.state.projectZones[index]?.id;this.originalDelete(index);
      if(deleted===id){this.app.state.points=[];this.app.state.openings=[];this.app.state.edges=[];this.app.state.strips=[];this.app.state.carriers=[];this.app.state.hangers=[];this.app.state.carrierJoints=[];this.app.state.activeZoneId=null;this.cad.session=new CadSession();document.getElementById('projectName').value='';}
      this.app.state.editingIndex=this.app.state.projectZones.findIndex(z=>z.id===this.app.state.activeZoneId);if(this.app.state.editingIndex<0)this.app.state.editingIndex=null;
      this.remember(base);this.refresh();this.ui.refresh();this.app.draw();this.app.autoSave();
    }catch(e){this.cad.message(e.message,true);}
  }
  changeOpening(id,scope,remove=false){
    if(this.draft||this.app.state.mode==='DRAW')return this.cad.message('Kết thúc hình đang vẽ trước',true);
    this.app.calculate();if(this.cad.errors.length)return this.cad.message(this.cad.errors[0],true);
    const base=this.snapshot(),holes=structuredClone(this.app.state.openings||[]);const index=holes.findIndex(h=>h.id===id);if(index<0)return;
    if(remove)holes.splice(index,1);else holes[index].scope=scope;this.cad.session.openings=holes;this.originalSync();this.commit();this.remember(base);this.refresh();this.app.draw();
  }
  refresh(){
    const holes=this.app.state.openings||[],list=document.getElementById('plan_opening_list');if(!list)return;list.replaceChildren();
    for(const h of holes){const row=document.createElement('div');row.className='opening-row'+(h.id===this.selectedHole?' selected':'');row.innerHTML=`<button class="opening-select">${escapeHTML(h.name||'Lỗ kỹ thuật')} · ${openingArea(h).toFixed(3)} m²</button><select aria-label="Phạm vi ${escapeHTML(h.name||'lỗ')}"><option value="VOID">Tấm + xương + ty</option><option value="PANEL">Chỉ tấm</option></select><button class="opening-delete" aria-label="Xóa ${escapeHTML(h.name||'lỗ')}">✕</button>`;row.querySelector('select').value=h.scope;row.querySelector('select').addEventListener('change',e=>this.changeOpening(h.id,e.target.value));row.querySelector('.opening-delete').addEventListener('click',()=>this.changeOpening(h.id,null,true));row.querySelector('.opening-select').addEventListener('click',()=>{this.selectedHole=h.id;this.refresh();this.app.draw();});list.append(row);}
    const warnings=[];if(this.draft)warnings.push('Đang vẽ lỗ: chưa trừ khối lượng cho tới khi hình hợp lệ.');
    const current={points:this.app.state.points,openings:holes};if(current.points.length>=3&&this.app.state.mode!=='DRAW')for(const z of this.app.state.projectZones){if(z.id!==this.app.state.activeZoneId&&regionsOverlap(current,z.savedState))warnings.push(`Vùng đang chọn chồng diện tích với ${z.name}; kiểm tra trước khi xuất tổng.`);}
    if(holes.length)warnings.push('Đã trừ theo phạm vi mỗi lỗ. Gia cường và viền cong quanh lỗ cần cấu tạo riêng.');
    document.getElementById('plan_review').textContent=warnings.join(' ');
  }
  segments(){return this.app.state.projectZones.flatMap(z=>[z.savedState.points,...(z.savedState.openings||[]).filter(h=>h.type==='polygon').map(h=>h.points)]).flatMap(p=>segmentsOf(p));}
  circles(){return [...(this.app.state.openings||[]),...this.app.state.projectZones.flatMap(z=>z.savedState.openings||[])].filter(h=>h.type==='circle');}
  drawOtherRegions(ctx){
    const scale=this.app.state.scale;
    for(const z of this.app.state.projectZones){if(z.id===this.app.state.activeZoneId)continue;const s=z.savedState;if(!s.points.length)continue;ctx.save();ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();for(const h of s.openings||[])this.holePath(ctx,h);ctx.fillStyle='#dde8ee88';ctx.fill('evenodd');ctx.strokeStyle='#8d9eac';ctx.lineWidth=1.2/scale;ctx.stroke();const p=s.points[0];ctx.fillStyle='#506a80';ctx.font=`${11/scale}px sans-serif`;ctx.fillText(z.name,p.x,p.y-8/scale);ctx.restore();}
  }
  holePath(ctx,h){if(h.type==='circle'){ctx.moveTo(h.center.x+h.radius,h.center.y);ctx.arc(h.center.x,h.center.y,h.radius,0,Math.PI*2);ctx.closePath();}else{h.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}}
  drawOpenings(ctx){
    const scale=this.app.state.scale;for(const h of this.app.state.openings||[]){ctx.save();ctx.beginPath();this.holePath(ctx,h);ctx.strokeStyle=h.id===this.selectedHole?'#d76b24':'#b06c36';ctx.lineWidth=(h.id===this.selectedHole?2.5:1.5)/scale;ctx.setLineDash([5/scale,3/scale]);ctx.stroke();ctx.setLineDash([]);const p=openingBounds(h)[0];ctx.font=`${10/scale}px sans-serif`;ctx.fillStyle='#9a5b29';ctx.fillText(h.name,p.x,p.y-5/scale);ctx.restore();}
    if(this.draft&&this.cad.session.draft.points.length){ctx.beginPath();this.cad.session.draft.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#d76b24';ctx.lineWidth=2/scale;ctx.stroke();}
  }
}
