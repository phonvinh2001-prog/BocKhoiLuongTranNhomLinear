// Pure quantity rules. Lengths in metres; no DOM or shared application state.
export const EPS = 1e-8;
export function distribute(start, end, step, edge = 0.15, threshold = 0.3) {
  if (![start,end,step,edge,threshold].every(Number.isFinite) || end <= start || step <= 0 || edge < 0) throw new Error('Khoảng rải không hợp lệ');
  const span = end - start;
  if (span < 2 * edge-EPS) throw new Error('Khoảng bố trí nhỏ hơn hai khoảng biên 150 mm');
  const out = [];
  for(let x=start+edge; x <= end-edge+EPS; x+=step) out.push(x);
  if(end-out.at(-1) > threshold+EPS) out.push(end-edge);
  return out;
}
export function splitRun(length, stock) {
  if(!Number.isFinite(length)||length<=0||!Number.isFinite(stock)||stock<=0) throw new Error('Chiều dài cây/đoạn không hợp lệ');
  const pieces=[];
  let remaining=length;
  while(remaining>stock+EPS){pieces.push(stock);remaining-=stock;}
  if(remaining>EPS) pieces.push(remaining);
  return pieces;
}
export function packCuts(lengths, stock, kerf = 0.005) {
  if(!Number.isFinite(stock)||stock<=0||!Number.isFinite(kerf)||kerf<0) throw new Error('Quy cách cắt không hợp lệ');
  if(lengths.some(x=>!Number.isFinite(x)||x<=0||x>stock+EPS)) throw new Error('Đoạn cắt vượt chiều dài cây hoặc không hợp lệ');
  let bars=[];
  for(const len of [...lengths].sort((a,b)=>b-a)) {
    let target=bars.find(b=>Math.abs(b.remaining-len)<=EPS||b.remaining>=len+kerf-EPS);
    if(!target){target={cuts:[],remaining:stock,kerf:0};bars.push(target);}
    // A full-stock piece needs no saw cut. A cut exactly at the remaining end also consumes no kerf.
    const loss=Math.abs(target.remaining-len)<=EPS?0:Math.min(kerf,target.remaining-len);
    if(target.remaining < len+loss-EPS) throw new Error('Cây không đủ chiều dài cộng đường cắt');
    target.cuts.push(len);target.remaining-=len+loss;target.kerf+=loss;
  }
  let optimal=bars.length<=Math.ceil(lengths.reduce((s,x)=>s+x,0)/stock-EPS),nodes=0,exhausted=false;
  if(!optimal&&lengths.length<=22){const sorted=[...lengths].sort((a,b)=>b-a),bins=[];
    function search(i){if(++nodes>100000){exhausted=true;return;}if(i===sorted.length){bars=structuredClone(bins);return;}if(bins.length>=bars.length)return;const len=sorted[i],seen=new Set();
      for(const bin of bins){const key=bin.remaining.toFixed(9);if(seen.has(key))continue;seen.add(key);if(Math.abs(bin.remaining-len)>EPS&&bin.remaining<len+kerf-EPS)continue;const loss=Math.abs(bin.remaining-len)<=EPS?0:kerf;bin.cuts.push(len);bin.remaining-=len+loss;bin.kerf+=loss;search(i+1);bin.kerf-=loss;bin.remaining+=len+loss;bin.cuts.pop();if(exhausted)return;}
      if(bins.length+1<bars.length){const loss=Math.abs(stock-len)<=EPS?0:Math.min(kerf,stock-len);bins.push({cuts:[len],remaining:stock-len-loss,kerf:loss});search(i+1);bins.pop();}
    }search(0);optimal=!exhausted;
  }
  return {stock, bars,optimal,method:optimal?'PROVEN':'HEURISTIC', count:bars.length, used:lengths.reduce((s,x)=>s+x,0), purchased:bars.length*stock, remainder:bars.reduce((s,b)=>s+Math.max(0,b.remaining),0), kerf:bars.reduce((s,b)=>s+b.kerf,0)};
}
export function structureForRuns(runs, step, stock, edge=0.15, threshold=0.3) {
  return runs.map(run=>{
    const pieces=splitRun(run.len,stock);
    let cursor=0;
    const joints=pieces.slice(0,-1).map(len=>(cursor+=len));
    const regular=distribute(0,run.len,step,edge,threshold);
    const hangers=[...regular,...joints].sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>EPS);
    return {...run,pieces,joints,hangers};
  });
}
export function csvText(rows) {
  const cell=x=>{let s=String(x??'');if(/^[=+@-]/.test(s)&&!/^-[\d.]+$/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
export const escapeHTML = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
