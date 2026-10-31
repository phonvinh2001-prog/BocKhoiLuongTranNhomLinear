import CuttingOptimizer from './GopCuttingOptimizer.js';
import {DEFAULT_SUPPLY} from './ProductRules.js';
export function panelPurchase(strips,config=DEFAULT_SUPPLY,reserve=0){
 const groups=new Map();for(const s of strips)for(const p of s.pieces){const mm=Math.ceil(p.len*1000-1e-7);groups.set(mm,(groups.get(mm)||0)+1);}
 if(!groups.size)return null;
 const items=[...groups].map(([length,quantity])=>({length,quantity})),result=new CuttingOptimizer().optimize(items,{...config});
 const got=new Map();for(const s of result.stocks){if(s.remaining<-1e-6)throw Error('Phôi âm dư');for(const cut of s.cuts)got.set(cut,(got.get(cut)||0)+1);}
 if(JSON.stringify([...got].sort())!==JSON.stringify([...groups].sort()))throw Error('Gộp thanh không bảo toàn số lượng');
 if(Math.abs(result.totalLength-result.totalUsed-result.totalWaste-result.kerfLoss-result.allowanceLoss)>1e-4)throw Error('Gộp thanh mất cân bằng chiều dài');
 return {...result,purchase:result.summary.filter(s=>!s.isExisting).map(s=>({...s,netQuantity:s.quantity,quantity:Math.ceil(s.quantity*(1+reserve/100))})),source:'GopKichThuoc-1.8',optimal:false};
}
