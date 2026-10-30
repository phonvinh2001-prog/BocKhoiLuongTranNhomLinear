import {distance,polygonError} from './CadGeometry.js';
export function readDXF(text,fallbackUnit='mm'){
  const lines=text.replace(/\r/g,'').split('\n');if(lines.length>600000)throw Error('DXF quá lớn; hãy tách bản vẽ theo tầng');
  const pairs=[];for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isInteger(code))throw Error('DXF ASCII có mã nhóm không hợp lệ');pairs.push([code,lines[i+1].trim()]);}
  let unit=null;for(let i=0;i<pairs.length-1;i++)if(pairs[i][0]===9&&pairs[i][1]==='$INSUNITS'){unit=({4:'mm',5:'cm',6:'m',1:'in',2:'ft'})[Number(pairs[i+1][1])]||null;break;}
  const scale=({mm:.001,cm:.01,m:1,in:.0254,ft:.3048})[unit||fallbackUnit];if(!scale)throw Error('Chưa có đơn vị DXF');
  let inEntities=false;const records=[];for(let i=0;i<pairs.length;i++){const [code,value]=pairs[i];if(code===0&&value==='SECTION'&&pairs[i+1]?.[1]==='ENTITIES'){inEntities=true;i++;continue;}if(inEntities&&code===0&&value==='ENDSEC'){inEntities=false;continue;}if(inEntities&&code===0){const r={type:value,pairs:[]};while(i+1<pairs.length&&pairs[i+1][0]!==0)r.pairs.push(pairs[++i]);records.push(r);}}
  if(!records.length)throw Error('Không có đối tượng trong ENTITIES của DXF');
  const entities=[],warnings=[],unsupported=new Map();const get=(r,c,d=0)=>r.pairs.find(p=>p[0]===c)?.[1]??d;
  const point=(x,y)=>{const p={x:Number(x)*scale||0,y:-Number(y)*scale||0};if(!Number.isFinite(Number(x))||!Number.isFinite(Number(y))||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Tọa độ DXF không hữu hạn');return p;};
  for(let i=0;i<records.length;i++){const r=records[i],layer=String(get(r,8,'0')),id=String(get(r,5,i+1));
    if(['LINE','LWPOLYLINE','POLYLINE','TEXT','MTEXT','CIRCLE'].includes(r.type)&&(Number(get(r,210))!==0||Number(get(r,220))!==0||Number(get(r,230,1))!==1)){warnings.push(`Bỏ ${r.type} có hệ trục OCS nghiêng/đảo, layer ${layer}`);continue;}
    if(r.type==='LINE')entities.push({type:'line',layer,id,points:[point(get(r,10),get(r,20)),point(get(r,11),get(r,21))],closed:false});
    else if(r.type==='CIRCLE'){const radius=Number(get(r,40))*scale;if(!Number.isFinite(radius)||radius<=0)throw Error('Bán kính DXF không hợp lệ');entities.push({type:'circle',layer,id,center:point(get(r,10),get(r,20)),radius});}
    else if(r.type==='LWPOLYLINE'||r.type==='POLYLINE'){
      let pts=[],bulge=false;if(r.type==='LWPOLYLINE'){let x=null;for(const [c,v]of r.pairs){if(c===10)x=v;if(c===20&&x!==null){pts.push(point(x,v));x=null;}if(c===42&&Number(v)!==0)bulge=true;}}
      else {while(records[i+1]?.type==='VERTEX'){const v=records[++i];pts.push(point(get(v,10),get(v,20)));if(Number(get(v,42))!==0)bulge=true;}if(records[i+1]?.type==='SEQEND')i++;}
      if(r.type==='POLYLINE'&&(Number(get(r,70))&(8|16|64))){warnings.push(`Bỏ polyline 3D/mesh, layer ${layer}; chỉ hỗ trợ mặt bằng 2D`);continue;}
      if(bulge){warnings.push(`Bỏ polyline có đoạn cong (bulge), layer ${layer}; cần chuyển thành đoạn thẳng trước`);continue;}
      const repeated=pts.length>2&&distance(pts[0],pts.at(-1))<1e-8;if(repeated)pts.pop();if(pts.length>=2)entities.push({type:'polyline',layer,id,points:pts,closed:repeated||!!(Number(get(r,70))&1)});
    }else if(['TEXT','MTEXT'].includes(r.type)){entities.push({type:'text',layer,id,at:point(get(r,10),get(r,20)),text:r.pairs.filter(p=>[1,3].includes(p[0])).map(p=>p[1]).join('').replace(/\\P/g,' ').slice(0,500)});}
    else unsupported.set(r.type,(unsupported.get(r.type)||0)+1);
  }
  if(entities.reduce((n,e)=>n+(e.points?.length||1),0)>30000)throw Error('DXF vượt 30.000 đỉnh; hãy tách bản vẽ theo khu vực');
  for(const [type,count]of unsupported)warnings.push(`Chưa nhập ${type}: ${count} đối tượng`);
  if(!unit)warnings.unshift(`DXF không khai báo đơn vị được hỗ trợ; đã dùng ${fallbackUnit} do người dùng chọn`);
  const boundaries=[];for(const e of entities)if(e.closed){const err=polygonError(e.points);if(err)warnings.push(`Không dùng biên ${e.id} (${e.layer}): ${err}`);else boundaries.push(e);}
  return {entities,unit:unit||fallbackUnit,unitDetected:!!unit,layers:[...new Set(entities.map(e=>e.layer))],warnings,boundaries};
}
