import {escapeHTML} from './QuantityRules.js';
import {DEFAULT_LAYERS,statusFor,visibleRows} from './WorkspaceModel.js';

export default class WorkspaceUI {
  constructor(app){
    this.app=app;this.layers={...DEFAULT_LAYERS};this.tab='installation';this.scope='CURRENT';this.dirty=false;this.selection=null;this.query='';
    this.build();this.bind();this.hook();this.refresh();
    this.observer=new ResizeObserver(()=>{app.resize();this.fit();});this.observer.observe(app.cont);
    requestAnimationFrame(()=>{app.resize();this.fit();});
  }
  build(){
    const inspector=document.querySelector('.sidebar'),viewport=this.app.cont,scroll=inspector.querySelector('.scroll-area');
    inspector.classList.add('workspace-inspector');inspector.querySelector('.header').remove();inspector.querySelector(':scope > .hint-box')?.remove();
    const groups=[...scroll.querySelectorAll(':scope > .group')],project=groups.find(g=>g.querySelector('#projectList'));
    const header=document.createElement('header');header.className='workspace-topbar';header.innerHTML=`<div class="workspace-brand"><span class="brand-mark">A</span><div><strong>ALU · MASTER</strong><small>Không gian bóc khối lượng</small></div><span class="version-tag">18.3</span></div><div class="top-actions"><button id="ui_open">Mở dự án</button><button id="ui_save">Lưu dự án</button><button id="ui_calc" class="primary-action">Tính vùng</button><details id="ui_export" class="export-menu"><summary>Xuất hồ sơ <span>⌄</span></summary><div class="export-options"><label for="ui_export_scope">Phạm vi</label><select id="ui_export_scope"><option value="CURRENT">Vùng đang xem</option><option value="PROJECT">Các vùng đã lưu</option></select><button id="ui_excel">Excel · Chi tiết & cắt cây</button><button id="ui_csv">CSV · Bảng khối lượng</button><button id="ui_dxf">DXF · Bố trí vùng đang xem</button></div></details></div>`;
    const shell=document.createElement('main');shell.className='workspace';shell.innerHTML=`<aside class="workspace-zones"><div class="panel-heading"><div><span class="eyebrow">DỰ ÁN</span><h2>Khu vực trần</h2></div><span id="ui_zone_count" class="count-tag">0</span></div><div id="zone-controls"></div><div class="zones-help">Chọn “Sửa” để mở vùng đã lưu. Tính và lưu vùng trước khi xuất toàn dự án.</div></aside><section class="workspace-results" aria-label="Bảng khối lượng"><div class="results-heading"><div class="result-tabs" role="tablist" aria-label="Loại khối lượng"><button data-tab="installation" role="tab" aria-selected="true">Lắp đặt</button><button data-tab="cuts" role="tab" aria-selected="false">Cắt cây</button><button data-tab="purchase" role="tab" aria-selected="false">Đặt mua</button><button data-tab="warnings" role="tab" aria-selected="false">Cảnh báo <span id="ui_warning_count">0</span></button></div><button id="ui_collapse" aria-expanded="true" title="Thu gọn bảng">Thu gọn ⌄</button></div><div class="results-body"><div class="table-tools"><select id="ui_scope" aria-label="Phạm vi bảng"><option value="CURRENT">Vùng đang xem</option><option value="PROJECT">Các vùng đã lưu</option></select><input id="ui_search" aria-label="Tìm vật tư" placeholder="Tìm vật tư, kích thước…"><span id="ui_result_count"></span></div><div id="ui_table" class="result-scroll" role="tabpanel"></div><p class="results-note" id="ui_table_note"></p></div></section>`;
    const footer=document.createElement('footer');footer.className='workspace-footer';footer.innerHTML='<span id="ui_status" role="status"></span><span>Quy tắc biên 150 / &gt;300 mm · Chọn cạnh để đổi viền · Preset cần đối chiếu catalogue</span>';
    document.body.prepend(header);document.body.append(shell,footer);
    shell.append(viewport,inspector);viewport.classList.add('workspace-drawing');
    const controls=shell.querySelector('#zone-controls');controls.append(project);project.className='zone-group';project.querySelector('.group-title')?.remove();
    const profileButtons=[...project.querySelectorAll('button')].filter(b=>/Profile|exportProfile|profileInput|loadProject|exportProject|newProject/.test(b.getAttribute('onclick')||''));
    const extra=document.createElement('details');extra.className='project-settings';extra.innerHTML='<summary>Thiết lập dự án & mẫu</summary>';
    for(const b of profileButtons)extra.append(b);project.append(extra);
    const newButton=document.createElement('button');newButton.className='new-zone';newButton.textContent='+ Vùng mới';newButton.addEventListener('click',()=>this.newZone());project.prepend(newButton);
    const list=project.querySelector('#projectList');project.append(list);
    scroll.querySelectorAll(':scope > .btn-group').forEach(n=>n.remove());
    const titles=['Mặt bằng','Sản phẩm & hướng rải','Xương, viền & dự phòng','Cao độ & chiều dài ty','Quy cách nối tấm','Phương pháp tính'];
    groups.filter(g=>g!==project).forEach((g,i)=>{const d=document.createElement('details');d.className='inspector-section';d.open=i<2;const summary=document.createElement('summary');summary.textContent=titles[i]||g.querySelector('.group-title')?.textContent;g.querySelector('.group-title')?.remove();d.append(summary);const content=document.createElement('div');content.className='section-content';content.append(...g.childNodes);d.append(content);g.replaceWith(d);});
    const ih=document.createElement('div');ih.className='panel-heading';ih.innerHTML='<div><span class="eyebrow">THUỘC TÍNH VÙNG</span><h2 id="ui_inspector_title">Vùng đang xem</h2></div><button id="ui_inspector_toggle" aria-label="Ẩn thông số">✕</button>';inspector.prepend(ih);
    viewport.querySelector('.legend')?.remove();
    const tools=document.createElement('div');tools.className='drawing-tools';tools.innerHTML='<span class="eyebrow">BẢN VẼ BỐ TRÍ</span><div><button id="ui_fit" title="Vừa khung">⊞ Vừa khung</button><button id="ui_zoom_out" aria-label="Thu nhỏ">−</button><button id="ui_zoom_in" aria-label="Phóng to">+</button><button id="ui_properties">Thông số ☷</button></div>';
    const layers=document.createElement('details');layers.className='layer-menu';layers.innerHTML='<summary>Lớp hiển thị</summary>'+Object.entries({panels:'▤ Thanh trần',carriers:'━ Xương',hangers:'● Ty treo',panelJoints:'× Nối tấm',carrierJoints:'□ Nối xương',trims:'⌜ Viền / mặt dựng',dimensions:'↔ Kích thước'}).map(([key,label])=>`<label><input type="checkbox" data-layer="${key}" checked>${label}</label>`).join('');
    const summary=document.createElement('div');summary.id='ui_drawing_summary';summary.className='drawing-summary';viewport.append(tools,layers,summary);
    // Existing labels lacked associations; retain all form IDs and engine bindings.
    document.querySelectorAll('.row').forEach(row=>{const label=row.querySelector('label'),input=row.querySelector('input[id],select[id]');if(label&&input)label.htmlFor=input.id;});
    const labels={cfg_pW:'Bản rộng tấm (mm)',cfg_gW:'Khe giữa tấm (mm)',cfg_maxL:'Dài tấm tối đa (m)',cfg_minCut:'Đoạn cắt tối thiểu (mm)',cfg_wGap:'Khe tường (mm)',cfg_cX:'Bước xương (m)',cfg_tY:'Bước ty (m)',cfg_carrierL:'Cây xương mua (m)',cfg_hangerL:'Ty lắp trực tiếp (m)'};
    for(const [id,text] of Object.entries(labels)){const l=document.querySelector(`label[for="${id}"]`);if(l)l.textContent=text;}
    document.getElementById('projectName').placeholder='Ví dụ: Sảnh tầng 1';document.getElementById('btn_addProject').title='Lưu kết quả vùng vào dự án';
    document.querySelector('#boqModal').classList.add('hidden');
  }
  bind(){
    const on=(id,fn)=>document.getElementById(id).addEventListener('click',fn);
    on('ui_open',()=>document.getElementById('loadProjectInput').click());on('ui_save',()=>this.app.exportProject());on('ui_calc',()=>{this.app.calculate();if(!this.app.cad?.errors.length)this.app.showFeedback('Đã tính lại vùng','success');});
    on('ui_excel',()=>this.export('excel'));on('ui_csv',()=>this.export('csv'));on('ui_dxf',()=>this.export('dxf'));
    on('ui_fit',()=>this.fit());for(const [id,k] of [['ui_zoom_in',1.2],['ui_zoom_out',1/1.2]])on(id,()=>{this.app.state.scale*=k;this.app.draw();});
    on('ui_collapse',()=>{const closed=document.querySelector('.workspace').classList.toggle('results-collapsed');document.getElementById('ui_collapse').textContent=closed?'Mở rộng ⌃':'Thu gọn ⌄';document.getElementById('ui_collapse').setAttribute('aria-expanded',String(!closed));});
    on('ui_properties',()=>document.body.classList.toggle('show-inspector'));on('ui_inspector_toggle',()=>document.body.classList.remove('show-inspector'));
    document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>{this.layers[el.dataset.layer]=el.checked;this.app.draw();}));
    document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{this.tab=el.dataset.tab;this.selection=null;this.renderTable();this.app.draw();}));
    document.getElementById('ui_scope').addEventListener('change',e=>{this.scope=e.target.value;this.selection=null;this.renderTable();this.app.draw();});
    document.getElementById('ui_search').addEventListener('input',e=>{this.query=e.target.value;this.renderTable();});
    document.querySelector('.workspace-inspector').addEventListener('input',()=>{this.dirty=true;this.refreshStatus();});
    document.getElementById('projectName').addEventListener('input',()=>this.refresh());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('ui_export').open=false;document.body.classList.remove('show-inspector');}if(e.key==='Enter'&&e.target.matches('.close-btn'))e.target.click();});
    document.addEventListener('click',e=>{const menu=document.getElementById('ui_export');if(!menu.contains(e.target))menu.open=false;});
  }
  hook(){
    const a=this.app,calculate=a.calculate.bind(a);a.calculate=()=>{calculate();this.dirty=false;this.selection=null;this.refresh();};
    a.draw=()=>this.draw();
    a.renderProjectList=()=>{this.renderZones();this.refresh();};
    a.showBOQ=()=>{a.calculate();this.showResults('CURRENT');};a.showProjectBOQ=()=>this.showResults('PROJECT');
    const save=a.saveState.bind(a);a.saveState=()=>{save();this.refreshStatus();};
  }
  showResults(scope){this.scope=scope;document.getElementById('ui_scope').value=scope;document.querySelector('.workspace').classList.remove('results-collapsed');document.getElementById('ui_collapse').textContent='Thu gọn ⌄';document.getElementById('ui_collapse').setAttribute('aria-expanded','true');this.renderTable();}
  fit(points=null){
    const a=this.app,p=points||[...a.state.points,...(a.cad?.fitPoints()||[])];if(p.length<2)return;
    const xs=p.map(p=>p.x),ys=p.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const top=55,bottom=a.cad?document.getElementById('cmd-bar-container').getBoundingClientRect().height+25:75;
    const availableH=Math.max(40,a.cvs.height-top-bottom);
    a.state.scale=Math.min(Math.max(40,a.cvs.width-100)/Math.max(.01,maxX-minX),availableH/Math.max(.01,maxY-minY));
    a.state.panX=a.cvs.width/2-(minX+maxX)/2*a.state.scale;a.state.panY=top+availableH/2-(minY+maxY)/2*a.state.scale;a.draw();
  }
  newZone(){
    this.app.state.editingIndex=null;this.app.state.manualJointsMap={};document.getElementById('projectName').value='';this.app.updateAddButtonUI();this.app.switchMode('PRESET');this.app.centerView();this.app.draw();this.refresh();
  }
  export(kind){
    if(this.dirty)this.app.calculate();const project=document.getElementById('ui_export_scope').value==='PROJECT';
    if(kind==='excel')this.app.exportWorkbook(project);else if(kind==='csv')project?this.app.exportProjectCSV():this.app.exportCSV();else this.app.exportDXF();
    document.getElementById('ui_export').open=false;
  }
  metrics(){return this.app.state.strips.length?this.app.calculateBOQData():null;}
  refresh(){this.result=this.metrics();this.refreshStatus();this.renderTable();this.renderZones();this.rodMode();
    const a=this.app,m=this.result;document.getElementById('ui_drawing_summary').innerHTML=m?`<div><small>DIỆN TÍCH NET</small><strong>${m.totalArea} <em>m²</em></strong>${m.openingArea?`<small>Bao ${m.grossArea.toFixed(3)} · Lỗ ${m.openingArea.toFixed(3)} m²</small>`:''}</div><div><small>MẶT NHÔM</small><strong>${m.panelFaceArea.toFixed(2)} <em>m²</em></strong></div><div><small>TY TREO</small><strong>${m.hangers.total} <em>điểm</em></strong></div>`:'<p>Chọn hình mẫu hoặc vẽ một vùng kín để bắt đầu.</p>';
    document.getElementById('ui_inspector_title').textContent=document.getElementById('projectName').value||'Vùng đang xem';
  }
  refreshStatus(){const s=statusFor(this.result,this.dirty),el=document.getElementById('ui_status');el.className='status-pill '+s.tone;el.textContent=s.label;document.querySelector('.workspace-results').classList.toggle('is-stale',this.dirty);}
  rodMode(){const direct=document.getElementById('cfg_rodMode').value==='DIRECT';document.getElementById('cfg_hangerL').closest('.row').hidden=!direct;for(const id of ['cfg_anchorZ','cfg_ceilingZ','cfg_rodAdjust'])document.getElementById(id).closest('.row').hidden=direct;}
  renderZones(){
    const list=document.getElementById('projectList');list.replaceChildren();const zones=this.app.state.projectZones;document.getElementById('ui_zone_count').textContent=zones.length;
    if(!zones.length){const p=document.createElement('p');p.className='empty-zones';p.textContent='Chưa có vùng đã lưu. Đặt tên và lưu vùng đang xem để bắt đầu dự án.';list.append(p);}
    zones.forEach((z,i)=>{const m=z.stats?.accessories,s=statusFor(m?.schemaVersion===1?m:null);const card=document.createElement('article');card.className='zone-card'+(this.app.state.editingIndex===i?' active':'');card.innerHTML=`<div class="zone-number">${String(i+1).padStart(2,'0')}</div><div class="zone-info"><strong>${escapeHTML(z.name)}</strong><small>${escapeHTML(z.savedState?.presetName||'Tùy chỉnh')} · ${m?.totalArea||'—'} m²</small><span class="zone-status ${s.tone}">${m?.schemaVersion===1?s.label:'Cần tính lại kết quả cũ'}</span><div class="zone-card-actions"><button data-edit>Sửa</button><button data-delete aria-label="Xóa ${escapeHTML(z.name)}">Xóa</button></div></div>`;card.querySelector('[data-edit]').addEventListener('click',()=>{this.app.editZone(i);this.refresh();});card.querySelector('[data-delete]').addEventListener('click',()=>this.app.deleteZone(i));list.append(card);});
  }
  renderTable(){
    if(!document.getElementById('ui_table'))return;const m=this.result,name=document.getElementById('projectName').value||'Vùng đang xem';
    let all=this.scope==='PROJECT'?this.app.projectRows():(m?this.app.boqRows(m,name):[['Vật tư','Thông tin']]);
    const warningRows=all.slice(1).filter(r=>String(r[1]).startsWith('CẢNH BÁO:')||String(r[1]).includes('phiên bản cũ'));
    document.getElementById('ui_warning_count').textContent=warningRows.length;
    let rows;
    if(this.tab==='cuts'){rows=[];const add=(r)=>rows.push(...(rows.length?r.slice(1):r));if(this.scope==='PROJECT'){for(const z of this.app.state.projectZones)if(z.stats?.accessories?.schemaVersion===1)add(this.app.cutRows(z.stats.accessories,z.name));}else if(m)add(this.app.cutRows(m,name));if(!rows.length)rows=[['Khu vực','Vật tư','Cây số','Stock (mm)','Các đoạn (mm)','Kerf (mm)','Dư (mm)']];}
    else if(this.tab==='warnings')rows=[['Khu vực','Nội dung'],...warningRows.map(r=>[r[0],String(r[1]).replace('CẢNH BÁO: ','')])];
    else rows=visibleRows(all,this.tab,this.query);
    if(this.tab==='cuts'&&this.query)rows=[rows[0],...rows.slice(1).filter(r=>r.join(' ').toLocaleLowerCase('vi').includes(this.query.toLocaleLowerCase('vi')))];
    document.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===this.tab));b.classList.toggle('active',b.dataset.tab===this.tab);});
    document.getElementById('ui_result_count').textContent=`${Math.max(0,rows.length-1)} dòng`;
    const host=document.getElementById('ui_table');host.innerHTML='<table class="qs-table"><thead><tr>'+rows[0].map(c=>'<th scope="col">'+escapeHTML(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map((r,i)=>`<tr data-row="${i}"${this.tab==='installation'&&this.scope==='CURRENT'?' tabindex="0"':''}>`+r.map(c=>'<td>'+escapeHTML(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    if(rows.length===1)host.insertAdjacentHTML('beforeend',`<p class="empty-table">${this.tab==='warnings'?'Không có cảnh báo trong phạm vi đang xem.':'Chưa có dữ liệu trong phạm vi đang xem.'}</p>`);
    if(this.tab==='installation'&&this.scope==='CURRENT')host.querySelectorAll('[data-row]').forEach(tr=>{const select=()=>{const row=rows[Number(tr.dataset.row)+1];this.selection={name:row[1],length:Number(row[3])/1000};host.querySelectorAll('tr.selected').forEach(r=>r.classList.remove('selected'));tr.classList.add('selected');this.app.draw();};tr.addEventListener('click',select);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});});
    document.getElementById('ui_table_note').textContent=this.tab==='cuts'?'Cắt cây net, chưa gồm cây dự phòng. Tái dùng dư trong từng vùng.':this.tab==='purchase'?'Lượng mua đã cộng dự phòng theo từng vùng; chưa gộp cắt giữa vùng.':this.tab==='warnings'?'Giải quyết cảnh báo và đối chiếu catalogue trước khi dùng bảng đặt hàng.':'Chọn dòng vật tư để đánh dấu trên bản vẽ. Diện tích vùng khác diện tích mặt nhôm.';
  }
  draw(){
    const a=this.app,s=a.state,c=a.ctx,L=this.layers,sel=this.selection;c.clearRect(0,0,a.cvs.width,a.cvs.height);c.save();c.translate(s.panX,s.panY);c.scale(s.scale,s.scale);
    const line=(p,q,color,width=.025)=>{c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
    const marker=(p,square,color)=>{const radius=Math.max(square?0.07:0.055,(square?3.5:2.5)/s.scale);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=Math.max(.025,1/s.scale);if(square)c.strokeRect(p.x-radius,p.y-radius,radius*2,radius*2);else{c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();}};
    a.cad?.drawBackground(c);
    if(s.points.length){c.beginPath();s.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(s.mode!=='DRAW'){c.closePath();for(const h of s.openings||[]){if(h.type==='circle'){c.moveTo(h.center.x+h.radius,h.center.y);c.arc(h.center.x,h.center.y,h.radius,0,Math.PI*2);}else h.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}c.fillStyle=a.cad?.input.background?'#ffffff30':'#fff';c.fill('evenodd');}c.strokeStyle='#64748b';c.lineWidth=.025;c.stroke();}
    const holePath=h=>{if(h.type==='circle'){c.moveTo(h.center.x+h.radius,h.center.y);c.arc(h.center.x,h.center.y,h.radius,0,Math.PI*2);c.closePath();}else{h.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}};
    c.save();if(s.mode!=='DRAW'&&s.points.length){c.beginPath();s.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();for(const h of s.openings||[])holePath(h);c.clip('evenodd');}
    for(const r of s.strips||[]){let offset=r.start;const at=t=>r.isVert?{x:r.pos+r.width/2,y:t}:{x:t,y:r.pos+r.width/2};for(let i=0;i<r.pieces.length;i++){const p=r.pieces[i],picked=sel?.name.startsWith('Thanh ')&&Math.abs(sel.length-p.len)<.0006;
        if(L.panels){c.fillStyle=picked?'#f8cc68':p.status==='BAD'?'#fecaca':'#dbe9f3';if(r.isVert)c.fillRect(r.pos,offset,r.width,p.len);else c.fillRect(offset,r.pos,p.len,r.width);}
        offset+=p.len;if(i<r.pieces.length-1&&L.panelJoints){const q=at(offset),h=.055;line({x:q.x-h,y:q.y-h},{x:q.x+h,y:q.y+h},'#9a5d0b');line({x:q.x-h,y:q.y+h},{x:q.x+h,y:q.y-h},'#9a5d0b');}}
    }
    c.restore();
    if(L.carriers)for(const r of s.carriers||[])line({x:r.x1,y:r.y1},{x:r.x2,y:r.y2},sel?.name==='Xương'?'#e57a17':'#c7863e',sel?.name==='Xương'?0.08:0.035);
    if(L.carrierJoints)for(const p of s.carrierJoints||[])marker(p,true,'#9a5d0b');
    if(L.hangers)for(const p of s.hangers||[])marker(p,false,sel?.name==='Ty treo'?'#e57a17':'#1f8474');
    for(const e of s.edges||[]){const colors={WALL_V:'#c84144',SHADOW:'#865aaf',FASCIA:'#4273ab'};if(L.trims&&e.type!=='NONE')line(e.p1,e.p2,colors[e.type]||'#64748b',.07);if(L.dimensions&&!e.openingId){const d=Math.hypot(e.p2.x-e.p1.x,e.p2.y-e.p1.y);if(d>.5){const x=(e.p1.x+e.p2.x)/2,y=(e.p1.y+e.p2.y)/2;c.font=(12/s.scale)+'px sans-serif';c.textAlign='center';c.fillStyle='#fff';c.fillRect(x-30/s.scale,y-9/s.scale,60/s.scale,18/s.scale);c.fillStyle='#32475e';c.fillText(d.toFixed(2)+' m',x,y+4/s.scale);}}}
    if(s.mode==='DRAW'&&!a.cad){for(const p of s.points)marker(p,false,'#d55e3c');const last=s.points.at(-1),cursor=s.CMD?.cursorPos;if(last&&cursor){c.setLineDash([.1,.1]);line(last,cursor,'#356b9c');c.setLineDash([]);}}
    if(s.snapLine){const sl=s.snapLine;c.setLineDash([.15,.1]);line(sl.type==='VERT'?{x:sl.val,y:sl.y-10}:{x:sl.x-10,y:sl.val},sl.type==='VERT'?{x:sl.val,y:sl.y+10}:{x:sl.x+10,y:sl.val},'#d9a52f');c.setLineDash([]);}
    a.cad?.drawOverlay(c);
    c.restore();
  }
}
