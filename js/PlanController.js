import {CadSession,parseCadInput,polygonError,segmentsOf,distance,project} from './CadGeometry.js';
import {openingsError,openingArea,openingBounds,openingLocation,pointInRegion,regionsOverlap} from './PlanGeometry.js';
import {normalizeRegions,linkSnapshot,translateRegion,regionHits,overlappingRegion} from './RegionEditing.js';
import {snapPoint,parseLength,resolveCadPoint} from './CadGeometry.js';
import {escapeHTML} from './QuantityRules.js';

const geometry=s=>JSON.stringify([s.points,s.openings||[],s.cad?.dimensions||[],s.cad?.circles||[]]);

export default class PlanController{
  constructor(cad){
    this.cad=cad;this.app=cad.app;this.ui=cad.ui;this.draft=null;this.base=null;this.newRegion=false;this.history=[];this.future=[];this.restoring=false;this.persisting=false;
    this.originalStart=cad.start.bind(cad);this.originalSync=cad.sync.bind(cad);this.originalCommand=cad.command.bind(cad);this.originalCancel=cad.cancel.bind(cad);
    this.originalAdd=this.app.addToProject.bind(this.app);this.originalEdit=this.app.editZone.bind(this.app);this.originalDelete=this.app.deleteZone.bind(this.app);
    this.interaction='SELECT';this.selectedIds=new Set();this.moving=null;this.pickCycle=null;this.circleRadiusPreview=null;
    if(!this.app.didRestoreWork&&!this.app.state.projectZones.length&&this.app.state.inputMode==='PRESET'){Object.assign(this.app.state,{points:[],openings:[],edges:[],strips:[],carriers:[],hangers:[],carrierJoints:[],activeZoneId:null,editingIndex:null});cad.session=new CadSession();this.ui.refresh();}
    normalizeRegions(this.app.state.projectZones);const linked=linkSnapshot(this.app.captureState(),this.app.state.projectZones);this.app.state.activeZoneId=linked.zoneId;this.app.state.editingIndex=this.app.state.projectZones.findIndex(z=>z.id===linked.zoneId);if(this.app.state.editingIndex<0)this.app.state.editingIndex=null;if(linked.zoneId!==null)this.selectedIds.add(linked.zoneId);
    cad.scene=this;this.build();this.hook();this.updateRegionWarnings();this.ui.refresh();this.refresh();
  }
  snapshot(){return {zones:structuredClone(this.app.state.projectZones),work:this.app.captureState(),name:document.getElementById('projectName').value};}
  remember(base){if(!base||this.restoring)return;this.history.push(base);if(this.history.length>20)this.history.shift();this.future=[];}
  restore(s){
    this.moving=null;this.interaction='SELECT';this.restoring=true;this.draft=null;this.base=null;this.newRegion=false;this.app.state.projectZones=structuredClone(s.zones);this.app.state.editingIndex=null;
    document.getElementById('projectName').value=s.name;this.app.restoreState(s.work);this.selectedIds=new Set(s.work.zoneId!==null?[s.work.zoneId]:[]);this.restoring=false;this.refresh();this.ui.refresh();this.app.draw();this.app.autoSave();
  }
  build(){
    const panel=document.createElement('details');panel.className='inspector-section plan-openings';panel.open=true;
    panel.innerHTML='<summary>Vùng trần & lỗ kỹ thuật</summary><div class="section-content"><div class="plan-actions"><button data-plan="SELECT">SELECT · Chọn</button><button data-plan="MOVE">MOVE · Di chuyển</button><button data-plan="TRIM">Viền</button><button data-plan="PL">+ Vùng trần</button><button data-plan="REC">+ Vùng chữ nhật</button><button data-plan="HOLE">Lỗ đa giác</button><button data-plan="HREC">Lỗ chữ nhật</button><button data-plan="HC">Lỗ tròn</button></div><p>Khép biên vẫn tính vùng hiện tại. Vẽ tiếp để thêm vùng; chọn vùng bên trái hoặc trên bản vẽ để sửa.</p><label for="plan_hole_scope">Mặc định lỗ mới</label><select id="plan_hole_scope"><option value="VOID">Trừ tấm, xương và ty</option><option value="PANEL">Chỉ trừ tấm</option></select><div id="plan_circle_tools" hidden><p id="plan_circle_stage"></p><label for="plan_circle_radius">Bán kính (mm)</label><input id="plan_circle_radius" type="text" inputmode="decimal" value="300" placeholder="300 hoặc 0.3m"><button id="plan_circle_create" type="button">Tạo đường tròn</button></div><p id="plan_selection_status" role="status"></p><div id="plan_opening_list"></div><p id="plan_review" role="status"></p></div>';
    document.querySelector('.workspace-inspector .scroll-area').prepend(panel);
    panel.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>this.cad.command(b.dataset.plan)));
    const toolbar=document.querySelector('.cad-toolbar');const b=document.createElement('button');b.type='button';b.textContent='HOLE · Lỗ';b.addEventListener('click',()=>this.cad.command('HOLE'));toolbar.prepend(b);
    for(const [cmd,label]of [['MOVE','M · Di chuyển'],['SELECT','SELECT · Chọn']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.interaction=cmd;button.addEventListener('click',()=>this.cad.command(cmd));toolbar.prepend(button);}
    document.getElementById('plan_circle_create').addEventListener('click',()=>this.createCircle());document.getElementById('plan_circle_radius').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();this.createCircle();}});document.getElementById('plan_circle_radius').addEventListener('input',()=>{try{this.circleRadiusPreview=parseLength(document.getElementById('plan_circle_radius').value,'mm');this.app.draw();}catch{}});
    const fit=document.createElement('button');fit.textContent='Vùng chọn';fit.title='Vừa khung vùng đang chọn (ZA)';fit.addEventListener('click',()=>this.ui.fit(this.app.state.points));document.querySelector('.drawing-tools>div').prepend(fit);
    document.querySelector('.zones-help').textContent='Các vùng cùng mặt bằng. Chọn vùng để sửa; mỗi lỗ thuộc vùng đang chọn. SELECT chọn vùng; Shift chọn nhiều, click lặp để chọn vùng chồng. M di chuyển. Chỉ PL/REC hoặc lưu vùng mới mới tạo vùng.';
  }
  hook(){
    const a=this.app,c=this.cad;
    const metrics=a.calculateBOQData.bind(a);a.calculateBOQData=force=>{const m=metrics(force);if(a.state.points.length>=3)for(const z of a.state.projectZones){if(z.id!==a.state.activeZoneId&&regionsOverlap({points:a.state.points,openings:a.state.openings||[]},z.savedState))m.warnings.push(`Vùng chồng diện tích với ${z.name}; tổng dự án có thể tính trùng`);}m.complete=!m.warnings.length;return m;};
    c.start=tool=>this.start(tool);c.sync=()=>this.sync();c.command=text=>this.command(text);c.cancel=()=>this.cancel();
    a.addToProject=()=>{try{this.commit({create:true});this.refresh();}catch(e){c.message(e.message,true);}};
    a.editZone=index=>this.select(index);a.deleteZone=index=>this.removeRegion(index);this.ui.newZone=()=>c.command('PL');
    const capture=a.captureState.bind(a);a.captureState=()=>{const s=capture();if(this.draft){s.cad.dimensions=structuredClone(this.draft.session.dimensions);s.cad.circles=structuredClone(this.draft.session.circles);}return s;};
    const restore=a.restoreState.bind(a);a.restoreState=s=>{this.draft=null;this.base=null;const was=this.restoring;this.restoring=true;try{normalizeRegions(a.state.projectZones);restore(linkSnapshot(s,a.state.projectZones));}finally{this.restoring=was;}this.selectedIds=new Set(a.state.activeZoneId!==null?[a.state.activeZoneId]:[]);this.refresh();};
    const down=a.cont.onmousedown,move=a.cont.onmousemove;
    a.cont.onmousedown=e=>{
      if(e.target===a.cvs&&e.button===0){
        if(this.moving){try{this.movePoint(this.movePick(e));}catch(err){c.message(err.message,true);}return;}
        if(!c.session.tool&&!this.draft&&a.state.mode!=='DRAW'&&!a.state.isJointEditing&&this.interaction==='SELECT'){this.pickRegion(a.getMouse(e),e.shiftKey);return;}
      }down(e);
    };
    a.cont.onmousemove=e=>{if(a.state.isDrag){move(e);return;}if(this.moving&&this.moving.base&&e.target===a.cvs){this.moving.target=this.movePick(e);c.cursor=this.moving.target;c.updateCoordinates();a.draw();return;}if(c.session.tool==='CIRCLE')this.circleRadiusPreview=null;move(e);};
    const background=c.drawBackground.bind(c);c.drawBackground=ctx=>{background(ctx);this.drawOtherRegions(ctx);};
    const overlay=c.drawOverlay.bind(c);c.drawOverlay=ctx=>{overlay(ctx);this.drawOpenings(ctx);this.drawSelection(ctx);};
    const fit=c.fitPoints.bind(c);c.fitPoints=()=>[...fit(),...a.state.projectZones.flatMap(z=>z.savedState.points)];
    const newProject=a.newProject.bind(a);a.newProject=()=>{const before=a.state.projectZones,pending=this.draft,pendingMove=this.moving;this.draft=null;this.moving=null;newProject();if(before!==a.state.projectZones){this.history=[];this.future=[];this.base=null;this.newRegion=false;this.selectedIds.clear();Object.assign(a.state,{points:[],openings:[],edges:[],strips:[],carriers:[],hangers:[],carrierJoints:[],activeZoneId:null,editingIndex:null});c.session=new CadSession();c.input.restore(null);this.refresh();this.ui.refresh();a.draw();a.autoSave();}else{this.draft=pending;this.moving=pendingMove;}};
    const useBoundary=c.useBoundary.bind(c);c.useBoundary=points=>{if(this.draft||a.state.mode==='DRAW')return c.message('Kết thúc hình đang vẽ trước',true);this.start('PL');c.session.tool=null;useBoundary(points);};
    const exportFile=this.ui.export.bind(this.ui);this.ui.export=kind=>{try{if(this.draft||this.moving||a.state.mode==='DRAW')throw Error('Kết thúc lệnh đang vẽ/di chuyển trước khi xuất');this.commit();const zone=a.state.projectZones.find((z,i)=>overlappingRegion(z.savedState,a.state.projectZones.slice(i+1),z.id));if(zone)throw Error('Còn vùng chồng nhau: dùng SELECT/MOVE để xử lý trước khi xuất');exportFile(kind);}catch(e){c.message(e.message,true);}};
    const calculate=a.calculate.bind(a);a.calculate=()=>{calculate();if(!this.persisting&&!this.restoring&&!this.draft&&!this.moving&&!c.session.tool&&a.state.mode!=='DRAW'&&a.state.activeZoneId&&a.state.strips.length&&!c.errors.length){this.commit();this.refresh();}};
    const switchMode=a.switchMode.bind(a);a.switchMode=mode=>{try{if(this.draft||this.moving)throw Error('Kết thúc lệnh đang vẽ/di chuyển trước khi đổi cách vẽ');switchMode(mode);}catch(e){c.message(e.message,true);}};
  }
  commit({create=false}={}){
    if(this.persisting||this.restoring)return;
    const a=this.app;const activeIndex=a.state.projectZones.findIndex(z=>z.id===a.state.activeZoneId);if(activeIndex<0&&!create)return false;if(a.state.mode==='DRAW'||polygonError(a.state.points))throw Error('Khép kín hoặc hủy vùng đang vẽ trước');
    this.persisting=true;
    try{
      a.calculate();if(this.cad.errors.length||!a.state.strips.length)throw Error(this.cad.errors[0]||'Vùng chưa có khối lượng hợp lệ');
      let index=a.state.projectZones.findIndex(z=>z.id===a.state.activeZoneId);const id=index>=0?a.state.projectZones[index].id:crypto.randomUUID();
      const name=document.getElementById('projectName').value.trim()||(index>=0?a.state.projectZones[index].name:`Vùng ${a.state.projectZones.length+1}`);
      a.state.activeZoneId=id;a.state.editingIndex=index>=0?index:null;document.getElementById('projectName').value=name;
      const oldCount=a.state.projectZones.length;this.originalAdd();if(index<0)index=oldCount;
      const record=a.state.projectZones[index];if(!record)throw Error('Chưa lưu được vùng');record.id=id;record.savedState.zoneId=id;
      a.state.editingIndex=index;document.getElementById('projectName').value=name;a.updateAddButtonUI();this.updateRegionWarnings();this.ui.refresh();a.autoSave();return true;
    }finally{this.persisting=false;}
  }
  start(tool){
    if(this.moving)throw Error('Esc hủy hoặc kết thúc MOVE trước');
    if(this.draft)throw Error('Khép kín hoặc Esc hủy lỗ đang vẽ trước');
    if(this.app.state.mode==='DRAW')throw Error('Vùng đang mở: C khép kín hoặc Esc hủy trước');
    this.base=this.snapshot();this.newRegion=['PL','REC'].includes(tool);this.interaction='SELECT';this.circleRadiusPreview=null;
    if(['PL','REC'].includes(tool)){
      if(this.app.state.points.length>=3)this.commit();
      this.app.state.editingIndex=null;this.app.state.activeZoneId=null;this.app.state.points=[];this.app.state.openings=[];this.app.state.edges=[];
      this.cad.session=new CadSession();this.selectedIds.clear();
      document.getElementById('projectName').value=`Vùng ${this.app.state.projectZones.length+1}`;
    }
    this.originalStart(tool);this.refresh();
  }
  startOpening(tool){
    if(this.draft||this.moving||this.app.state.mode==='DRAW')throw Error('Khép kín/hủy hình đang vẽ trước khi thêm lỗ');
    if(polygonError(this.app.state.points))throw Error('Chọn một vùng trần kín trước khi thêm lỗ');
    this.commit({create:true});this.base=this.snapshot();this.newRegion=false;this.interaction='SELECT';this.circleRadiusPreview=null;
    this.draft={tool,scope:document.getElementById('plan_hole_scope').value,session:this.cad.session,initialCircles:0};
    this.cad.session=new CadSession();this.originalStart(tool);this.draft.initialCircles=this.cad.session.circles.length;if(tool==='CIRCLE')this.cad.session.draft={points:[],closed:false};
    this.cad.message('Lỗ kỹ thuật: '+(tool==='CIRCLE'?'chọn tâm rồi nhập bán kính':'vẽ biên bên trong vùng, C khép kín'));this.refresh();
  }
  sync(){
    const c=this.cad,a=this.app;
    if(this.draft){
      const s=c.session,d=this.draft;let hole=null;
      if(d.tool==='CIRCLE'&&s.circles.length>d.initialCircles){hole={type:'circle',...s.circles.at(-1)};}
      if(d.tool!=='CIRCLE'&&s.draft.closed)hole={type:'polygon',points:structuredClone(s.draft.points)};
      if(!hole){c.update();this.refreshCircle();a.draw();return;}
      hole={...hole,id:crypto.randomUUID(),name:`Lỗ ${(a.state.openings||[]).length+1}`,scope:d.scope};
      const holes=[...(a.state.openings||[]),hole],err=openingsError(a.state.points,holes);if(err)throw Error(err);
      c.session=d.session;c.session.openings=holes;this.draft=null;this.selectedHole=hole.id;
      this.originalSync();this.commit();this.remember(this.base);this.base=null;this.refresh();c.message('Đã thêm lỗ kỹ thuật, cập nhật khối lượng vùng');a.draw();return;
    }
    if(this.newRegion&&c.session.draft.closed){const collision=overlappingRegion({points:c.session.draft.points,openings:c.session.openings},a.state.projectZones);if(collision)throw Error('Vùng mới chồng '+collision.name+'. U sửa điểm hoặc Esc hủy; dùng MOVE để sắp xếp vùng đã có.');}
    this.originalSync();this.refreshCircle();
    if(c.session.draft.closed&&!c.session.tool){
      const now=a.captureState(),changed=this.base&&(this.newRegion||geometry(this.base.work)!==geometry(now));
      if(changed){this.commit({create:this.newRegion});if(this.newRegion)this.selectedIds=new Set([a.state.activeZoneId]);this.remember(this.base);}this.base=null;this.newRegion=false;this.refresh();
    }
  }
  command(text){
    try{
      const input=parseCadInput(text,this.cad.options.unit),cmd=input.type==='COMMAND'?input.value:null;
      if(['SELECT','SEL'].includes(cmd)){if(this.draft||this.app.state.mode==='DRAW')throw Error('Esc hủy hoặc khép hình đang vẽ trước');this.moving=null;this.cad.session.tool=null;this.interaction='SELECT';this.refresh();this.app.draw();this.cad.message('SELECT: click chọn · Shift chọn nhiều · click lặp để chọn vùng bị che · M di chuyển');return;}
      if(['M','MOVE'].includes(cmd))return this.startMove();
      if(cmd==='TRIM'){if(this.draft||this.moving||this.app.state.mode==='DRAW')throw Error('Kết thúc lệnh đang vẽ trước');this.interaction='TRIM';this.cad.session.tool=null;this.refresh();this.cad.message('VIỀN: click cạnh để đổi loại viền. SELECT để chọn vùng.');return;}
      if(this.moving){if(['U','UNDO'].includes(cmd)){this.moving.base=null;this.moving.target=null;this.cad.message('MOVE: chọn lại điểm gốc');this.app.draw();return;}if(input.type==='ENTER')return;if(cmd)throw Error('MOVE đang chạy: chọn điểm đích hoặc Esc hủy');return this.movePoint(resolveCadPoint(input,this.moving.base,this.cad.cursor,this.cad.options.ortho));}
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
    if(this.moving){this.moving=null;this.interaction='SELECT';this.cad.message('Đã hủy MOVE; vùng giữ nguyên vị trí');this.refresh();this.app.draw();return;}
    if(this.draft){this.cad.session=this.draft.session;this.draft=null;this.base=null;this.cad.message('Đã hủy lỗ đang vẽ; giữ nguyên vùng trần');this.refresh();this.app.draw();return;}
    if(this.base&&(['PL','REC'].includes(this.cad.session.tool)||this.app.state.mode==='DRAW')){const base=this.base;this.restore(base);this.cad.message('Đã hủy vùng đang vẽ; giữ các vùng trước');return;}
    this.base=null;this.interaction='SELECT';this.originalCancel();this.refresh();
  }
  select(index,{preserveSelection=false}={}){
    try{
      if(this.draft||this.moving||this.app.state.mode==='DRAW')throw Error('Kết thúc lệnh đang vẽ/di chuyển trước khi đổi vùng');
      const target=this.app.state.projectZones[index];if(!target)return false;const targetId=target.id;
      this.commit();const view={panX:this.app.state.panX,panY:this.app.state.panY,scale:this.app.state.scale};
      const was=this.restoring;this.restoring=true;try{this.originalEdit(this.app.state.projectZones.findIndex(z=>z.id===targetId));}finally{this.restoring=was;}
      Object.assign(this.app.state,view);if(!preserveSelection)this.selectedIds=new Set([targetId]);this.selectedHole=null;this.refresh();this.app.draw();return true;
    }catch(e){this.cad.message(e.message,true);return false;}
  }
  removeRegion(index){
    try{if(this.draft||this.moving||this.app.state.mode==='DRAW')throw Error('Kết thúc hình đang vẽ/di chuyển trước khi xóa vùng');const base=this.snapshot(),id=this.app.state.activeZoneId,deleted=this.app.state.projectZones[index]?.id;this.originalDelete(index);
      if(deleted===id){this.app.state.points=[];this.app.state.openings=[];this.app.state.edges=[];this.app.state.strips=[];this.app.state.carriers=[];this.app.state.hangers=[];this.app.state.carrierJoints=[];this.app.state.activeZoneId=null;this.cad.session=new CadSession();document.getElementById('projectName').value='';}
      this.app.state.editingIndex=this.app.state.projectZones.findIndex(z=>z.id===this.app.state.activeZoneId);if(this.app.state.editingIndex<0)this.app.state.editingIndex=null;
      this.remember(base);this.refresh();this.ui.refresh();this.app.draw();this.app.autoSave();
    }catch(e){this.cad.message(e.message,true);}
  }
  changeOpening(id,scope,remove=false){
    if(this.draft||this.moving||this.app.state.mode==='DRAW')return this.cad.message('Kết thúc hình đang vẽ/di chuyển trước',true);
    this.app.calculate();if(this.cad.errors.length)return this.cad.message(this.cad.errors[0],true);
    const base=this.snapshot(),holes=structuredClone(this.app.state.openings||[]);const index=holes.findIndex(h=>h.id===id);if(index<0)return;
    if(remove)holes.splice(index,1);else holes[index].scope=scope;this.cad.session.openings=holes;this.originalSync();this.commit();this.remember(base);this.refresh();this.app.draw();
  }
  pickRegion(p,multiple=false){
    const hits=regionHits(p,this.app.state.projectZones,9/this.app.state.scale);
    if(!hits.length){this.selectedIds.clear();this.pickCycle=null;this.refresh();this.app.draw();this.cad.message('SELECT: chưa chọn vùng. Click đường bao/phần trần hoặc chọn trong danh sách.');return;}
    const cycle=this.pickCycle,same=cycle&&distance(p,cycle.point)<6/this.app.state.scale&&JSON.stringify(cycle.hits)===JSON.stringify(hits);
    const cursor=same?(cycle.cursor+1)%hits.length:0,index=hits[cursor],id=this.app.state.projectZones[index].id;
    const ids=new Set(this.selectedIds);if(multiple){if(ids.has(id))ids.delete(id);else ids.add(id);}
    if(!this.select(index))return;if(multiple)this.selectedIds=ids;
    this.pickCycle={point:{...p},hits,cursor};this.refresh();this.app.draw();this.cad.message(`SELECT: ${this.app.state.projectZones[index].name}${hits.length>1?` · ${cursor+1}/${hits.length} vùng tại đây, click lặp để đổi`:''} · M di chuyển`);
  }
  startMove(){
    if(this.draft||this.app.state.mode==='DRAW'||this.cad.session.tool)throw Error('Khép hình hoặc Esc kết thúc lệnh đang vẽ trước');
    this.commit();const ids=[...this.selectedIds].filter(id=>this.app.state.projectZones.some(z=>z.id===id));
    if(!ids.length)throw Error('SELECT chọn vùng trước, rồi M/MOVE để di chuyển');
    this.moving={ids,base:null,target:null,before:this.snapshot(),regions:this.app.state.projectZones.filter(z=>ids.includes(z.id)).map(z=>({id:z.id,work:structuredClone(z.savedState)}))};
    this.interaction='MOVE';this.cad.message(`MOVE ${ids.length} vùng: chọn điểm gốc hoặc nhập x,y`);this.refresh();this.app.draw();
  }
  movePick(e){
    const m=this.moving,include=z=>!m.base||!m.ids.includes(z.id),refs=this.app.state.projectZones.filter(include).flatMap(z=>[z.savedState.points,...(z.savedState.openings||[]).filter(h=>h.type==='polygon').map(h=>h.points)]).flatMap(p=>segmentsOf(p));
    return snapPoint(this.app.getMouse(e),[...this.cad.input.getSegments(),...refs],{scale:this.app.state.scale,enabled:this.cad.options.snap,base:m.base,ortho:this.cad.options.ortho||e.shiftKey,grid:this.cad.options.grid?this.cad.options.gridStep:0,types:this.cad.options.types});
  }
  movePreview(){const m=this.moving;if(!m?.base||!m.target)return [];return m.regions.map(r=>({id:r.id,work:translateRegion(r.work,m.target.x-m.base.x,m.target.y-m.base.y)}));}
  moveError(candidates){
    const others=this.app.state.projectZones.filter(z=>!this.moving.ids.includes(z.id));
    for(let i=0;i<candidates.length;i++){const r=candidates[i],err=polygonError(r.work.points)||openingsError(r.work.points,r.work.openings);if(err)return err;
      const collision=overlappingRegion(r.work,[...others,...candidates.slice(i+1).map(c=>({id:c.id,name:'vùng khác trong nhóm',savedState:c.work}))]);if(collision)return 'Vị trí mới chồng '+collision.name+'; chọn điểm đích khác hoặc Esc hủy';}
    return null;
  }
  movePoint(p){
    const m=this.moving;if(!m)return;
    if(!m.base){m.base={x:p.x,y:p.y};this.cad.cursor={...p};this.cad.message('MOVE: chọn điểm đích hoặc nhập @dx,dy (mm). F8 khóa hướng; Esc hủy.');this.app.draw();return;}
    m.target={x:p.x,y:p.y};const candidates=this.movePreview(),error=this.moveError(candidates);if(error){this.app.draw();throw Error(error);}
    if(distance(m.base,m.target)<1e-8){this.moving=null;this.interaction='SELECT';this.cad.message('MOVE: không thay đổi vị trí');this.refresh();this.app.draw();return;}
    const view={panX:this.app.state.panX,panY:this.app.state.panY,scale:this.app.state.scale},active=this.app.state.activeZoneId;
    try{
      for(const c of candidates)this.app.state.projectZones.find(z=>z.id===c.id).savedState=c.work;
      for(const c of candidates){this.app.restoreState(c.work);this.commit();}
      const current=this.app.state.projectZones.find(z=>z.id===active)||this.app.state.projectZones.find(z=>z.id===m.ids[0]);if(current)this.app.restoreState(current.savedState);
      this.selectedIds=new Set(m.ids);this.moving=null;this.interaction='SELECT';this.app.state.snapLine=null;Object.assign(this.app.state,view);this.remember(m.before);this.refresh();this.ui.refresh();this.app.draw();this.app.autoSave();this.cad.message(`Đã di chuyển ${candidates.length} vùng cùng lỗ, DIM và điểm nối; giữ nguyên ID/quy cách`);
    }catch(e){this.restore(m.before);throw e;}
  }
  refreshSelection(){
    const label=document.getElementById('plan_selection_status');if(label)label.textContent=this.moving?`MOVE · ${this.moving.ids.length} vùng · ${this.moving.base?'chọn điểm đích':'chọn điểm gốc'}`:`${this.interaction} · Đã chọn ${this.selectedIds.size} vùng · Shift chọn nhiều · M di chuyển`;
    document.querySelectorAll('[data-interaction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.interaction===this.interaction)));
    document.querySelectorAll('[id^="cfg_"],[id^="dim_"],#cad_source_file').forEach(el=>el.disabled=!!this.moving);
  }
  refreshCircle(){
    const box=document.getElementById('plan_circle_tools');if(!box)return;const active=this.cad.session.tool==='CIRCLE';box.hidden=!active;if(!active){this.circleRadiusPreview=null;delete box.dataset.centerShown;return;}
    const hasCenter=this.cad.session.picks.length===1;document.getElementById('plan_circle_create').disabled=!hasCenter;document.getElementById('plan_circle_stage').textContent=hasCenter?'Đã chọn tâm. Click điểm trên vòng tròn hoặc nhập bán kính rồi Enter/Tạo.':'Bước 1: click chọn tâm trên bản vẽ hoặc nhập x,y vào ô lệnh.';
    if(hasCenter&&this.circleRadiusPreview===null){try{this.circleRadiusPreview=parseLength(document.getElementById('plan_circle_radius').value,'mm');}catch{}}
    if(hasCenter&&!box.dataset.centerShown){box.dataset.centerShown='true';box.scrollIntoView({block:'nearest'});}else if(!hasCenter)delete box.dataset.centerShown;
  }
  createCircle(){
    try{if(this.cad.session.tool!=='CIRCLE'||this.cad.session.picks.length!==1)throw Error('Chọn tâm đường tròn trước');const r=parseLength(document.getElementById('plan_circle_radius').value,'mm');this.cad.session.circle(r);this.sync();}
    catch(e){this.cad.message(e.message,true);}
  }
  drawSelection(ctx){
    const scale=this.app.state.scale,outline=(s,color,fill=false)=>{ctx.save();ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();for(const h of s.openings||[])this.holePath(ctx,h);if(fill){ctx.fillStyle=color+'22';ctx.fill('evenodd');}ctx.strokeStyle=color;ctx.lineWidth=2/scale;ctx.setLineDash([7/scale,4/scale]);ctx.stroke();ctx.setLineDash([]);for(const p of s.points)ctx.strokeRect(p.x-3/scale,p.y-3/scale,6/scale,6/scale);ctx.restore();};
    for(const z of this.app.state.projectZones)if(this.selectedIds.has(z.id))outline(z.savedState,'#267fb6');
    if(this.moving?.target){try{const candidates=this.movePreview(),error=this.moveError(candidates);for(const c of candidates)outline(c.work,error?'#c24a39':'#18866e',true);}catch{}}
  }
  updateRegionWarnings(){
    const zones=this.app.state.projectZones,stamp=JSON.stringify(zones.map(z=>[z.id,z.name,z.savedState.points,z.savedState.openings||[]]));if(stamp===this.overlapStamp)return;this.overlapStamp=stamp;
    const overlaps=new Map(zones.map(z=>[z.id,[]]));for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++)if(regionsOverlap(zones[i].savedState,zones[j].savedState)){overlaps.get(zones[i].id).push(zones[j].name);overlaps.get(zones[j].id).push(zones[i].name);}
    for(const z of zones){const m=z.stats?.accessories;if(m?.schemaVersion!==1)continue;m.warnings=(m.warnings||[]).filter(w=>!w.startsWith('Vùng chồng diện tích với '));for(const name of overlaps.get(z.id))m.warnings.push(`Vùng chồng diện tích với ${name}; tổng dự án có thể tính trùng`);m.complete=!m.warnings.length;}
  }
  refresh(){
    this.updateRegionWarnings();this.refreshCircle();this.refreshSelection();const holes=this.app.state.openings||[],list=document.getElementById('plan_opening_list');if(!list)return;list.replaceChildren();
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
    if(this.draft&&this.draft.tool!=='CIRCLE'&&this.cad.session.draft.points.length){ctx.beginPath();this.cad.session.draft.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#d76b24';ctx.lineWidth=2/scale;ctx.stroke();}
  }
}
