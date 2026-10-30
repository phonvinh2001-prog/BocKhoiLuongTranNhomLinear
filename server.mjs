import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||name.includes('/.')){res.writeHead(403).end();return;}const bytes=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end('Not found');}}).listen(8765,'127.0.0.1',()=>console.log('ALU-MASTER: http://127.0.0.1:8765'));
