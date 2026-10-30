import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cache=new Map();
function moduleURL(file){if(cache.has(file))return cache.get(file);const text=fs.readFileSync(file,'utf8').replace(/(from\s*["'])(\.\.?\/[^"']+)(["'])/g,(m,a,b,c)=>a+moduleURL(path.resolve(path.dirname(file),b))+c);const url='data:text/javascript;base64,'+Buffer.from(text).toString('base64');cache.set(file,url);return url;}
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/>/g,(m,name)=>'<style>'+fs.readFileSync(path.join(root,name),'utf8')+'</style>');
html=html.replace(/src="js\/main.js[^\"]*"/,'src="'+moduleURL(path.join(root,'js/main.js'))+'"');
const target=path.resolve(process.argv[2]||path.join(root,'ALU-MASTER-v18.5.html'));fs.writeFileSync(target,html);console.log(target);
