import {dimensionGeometry} from './CadGeometry.js';
const enc=new TextEncoder();
const xml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return (crc^0xffffffff)>>>0;}
function join(parts){const a=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let n=0;for(const p of parts){a.set(p,n);n+=p.length;}return a;}
function header(size,values){const a=new Uint8Array(size),d=new DataView(a.buffer);for(const [offset,value,width] of values)width===2?d.setUint16(offset,value,true):d.setUint32(offset,value,true);return a;}
// ZIP store method keeps the browser exporter dependency-free and deterministic.
export function zipFiles(files){const body=[],central=[];let offset=0;for(const [name,text] of Object.entries(files)){const n=enc.encode(name),b=enc.encode(text),crc=crc32(b);const h=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,crc,4],[18,b.length,4],[22,b.length,4],[26,n.length,2]]);body.push(h,n,b);central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,crc,4],[20,b.length,4],[24,b.length,4],[28,n.length,2],[42,offset,4]]),n);offset+=h.length+n.length+b.length;}const c=join(central),count=Object.keys(files).length;return join([...body,c,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,c.length,4],[16,offset,4]])]);}
export function xlsxBytes(sheets){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`+sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>'};
  function col(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
  sheets.forEach((s,k)=>files[`xl/worksheets/sheet${k+1}.xml`]=`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="12" width="23" customWidth="1"/></cols><sheetData>`+s.rows.map((r,i)=>`<row r="${i+1}">`+r.map((c,j)=>Number.isFinite(c)&&typeof c==='number'?`<c r="${col(j)}${i+1}"><v>${c}</v></c>`:`<c r="${col(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(c)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>');
  return zipFiles(files);
}
export function layoutDXF(state){
  const pairs=[];const pair=(a,b)=>pairs.push(String(a),String(b));
  pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1015');pair(9,'$INSUNITS');pair(70,4);pair(0,'ENDSEC');pair(0,'SECTION');pair(2,'ENTITIES');
  const line=(layer,a,b)=>{pair(0,'LINE');pair(8,layer);pair(10,a.x*1000);pair(20,-a.y*1000);pair(30,0);pair(11,b.x*1000);pair(21,-b.y*1000);pair(31,0);};
  (state.points||[]).forEach((p,i)=>line('TRAN-BIEN-BAO',p,state.points[(i+1)%state.points.length]));
  for(const s of state.strips||[]){let pos=s.start;for(let i=0;i<s.pieces.length;i++){const p=s.pieces[i],at=t=>s.isVert?{x:s.pos+s.width/2,y:t}:{x:t,y:s.pos+s.width/2};line('QS-OUT-TAM',at(pos),at(pos+p.len));pos+=p.len;if(i<s.pieces.length-1){const q=at(pos),r=.06;line('QS-OUT-NOI-TAM',{x:q.x-r,y:q.y-r},{x:q.x+r,y:q.y+r});line('QS-OUT-NOI-TAM',{x:q.x+r,y:q.y-r},{x:q.x-r,y:q.y+r});}}}
  for(const c of state.carriers||[]){let n=0;const at=t=>({x:c.x1+(c.x2-c.x1)*t/c.len,y:c.y1+(c.y2-c.y1)*t/c.len});for(const p of c.pieces||[c.len]){line('QS-OUT-XUONG',at(n),at(n+p));n+=p;}}
  for(const p of state.carrierJoints||[]){const a=[{x:p.x-.06,y:p.y-.06},{x:p.x+.06,y:p.y-.06},{x:p.x+.06,y:p.y+.06},{x:p.x-.06,y:p.y+.06}];a.forEach((q,i)=>line('QS-OUT-NOI-XUONG',q,a[(i+1)%4]));}
  for(const p of state.hangers||[]){pair(0,'CIRCLE');pair(8,'QS-OUT-TY');pair(10,p.x*1000);pair(20,-p.y*1000);pair(30,0);pair(40,50);}
  for(const e of state.edges||[])if(e.type!=='NONE')line(e.type==='WALL_V'?'TRAN-V-GOC':e.type==='FASCIA'?'TRAN-MAT-DUNG-A':'TRAN-SHADOW',e.p1,e.p2);
  for(const q of state.circles||[]){pair(0,'CIRCLE');pair(8,'QS-REF-CIRCLE');pair(10,q.center.x*1000);pair(20,-q.center.y*1000);pair(30,0);pair(40,q.radius*1000);}
  // Exploded annotations remain readable in basic DXF viewers; these are not driving dimensions.
  for(const d of state.dimensions||[]){const g=dimensionGeometry(d);if(!g)continue;line('QS-DIM',d.a,g.q1);line('QS-DIM',d.b,g.q2);line('QS-DIM',g.q1,g.q2);for(const q of [g.q1,g.q2])line('QS-DIM',{x:q.x-.04,y:q.y+.04},{x:q.x+.04,y:q.y-.04});pair(0,'TEXT');pair(8,'QS-DIM');pair(10,(g.q1.x+g.q2.x)*500);pair(20,-(g.q1.y+g.q2.y)*500);pair(30,0);pair(40,60);pair(1,(g.value*1000).toFixed(0)+' mm');}
  pair(0,'ENDSEC');pair(0,'EOF');return pairs.join('\r\n')+'\r\n';
}
