import {validateRules} from './ProductRules.js';
export function validateProduct(p){
 if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>100||![p.pW,p.gW,p.maxL].every(Number.isFinite)||p.pW<10||p.pW>1000||p.gW<0||p.gW>500||p.maxL<.5||p.maxL>12)throw Error('Kiểm tra tên, bản rộng 10–1000 mm, khe 0–500 mm và dài 0.5–12 m');
 if(p.rules)validateRules(p.rules);return p;
}
export function productIndex(list,p){if(!p)return -1;let i=p.id?list.findIndex(x=>x.id===p.id):-1;if(i<0&&p.rules?.sku)i=list.findIndex(x=>x.rules?.sku===p.rules.sku);if(i<0)i=list.findIndex(x=>x.name===p.name);return i;}
export function createProduct(list,p){validateProduct(p);if(list.length>=100||list.some(x=>x.name.toLocaleLowerCase('vi')===p.name.trim().toLocaleLowerCase('vi')||p.rules?.sku&&x.rules?.sku===p.rules.sku))throw Error('Tên/mã mẫu đã tồn tại hoặc thư viện đã đủ 100 mẫu');const products=structuredClone(list);products.push({...structuredClone(p),name:p.name.trim(),id:crypto.randomUUID()});return {products,index:products.length-1};}
export function updateProduct(list,index,changes){
 if(!Number.isInteger(index)||index<0||index>=list.length)throw Error('Mẫu đã thay đổi hoặc không còn tồn tại; hãy chọn lại');
 const original=list[index],p=structuredClone({...original,...changes});p.name=p.name.trim();validateProduct(p);
 if(list.some((x,i)=>i!==index&&(x.name.trim().toLocaleLowerCase('vi')===p.name.toLocaleLowerCase('vi')||p.rules?.sku&&x.rules?.sku===p.rules.sku)))throw Error('Tên hoặc mã sản phẩm đã tồn tại ở mẫu khác');
 if(p.rules&&['pW','gW','maxL'].some(k=>original[k]!==p[k]))p.rules.approved=false;
 p.id=original.id||crypto.randomUUID();const out=structuredClone(list);out[index]=p;return {products:out,index};
}
export function mergeProducts(list,incoming,target=null){
 let products=structuredClone(list),selected=-1;
 for(const [i,input] of incoming.entries()){const p=structuredClone(input);validateProduct(p);let index=i===0&&incoming.length===1&&target?productIndex(products,target):productIndex(products,p);if(index<0)index=products.findIndex(x=>x.name===p.name&&!x.rules?.sku);
 if(index>=0){const r=updateProduct(products,index,p);products=r.products;selected=r.index;}
 else{if(products.length>=100)throw Error('Thư viện tối đa 100 mẫu');if(products.some(x=>x.name.toLocaleLowerCase('vi')===p.name.toLocaleLowerCase('vi')))throw Error('Tên mẫu bị trùng');p.id=crypto.randomUUID();products.push(p);selected=products.length-1;}}
 return {products,index:selected};
}
