import {readFile,writeFile,mkdir,readdir,rm,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
// public/ is the source for Vercel; the same source is bundled for the Sites Worker.
const assets={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())await walk(f);else{const name='/'+path.relative(path.join(root,'public'),f).replaceAll('\\','/');assets[name]={type:types[path.extname(f)]||'application/octet-stream',data:(await readFile(f)).toString('base64')};}}}
await walk(path.join(root,'public'));
if(!assets['/index.html']||!assets['/checkout.html']||!assets['/gracias.html'])throw Error('Missing page');
const proof=JSON.parse(await readFile('public/proof.json','utf8'));
for(const t of proof.testimonials||[])if(!t.approved||!t.name||!t.quote||!t.source)throw Error('Testimonials must be authentic, approved and sourced.');
for(const b of proof.brands||[])if(!b.approved||!b.name||!b.source)throw Error('Client brands require confirmation.');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const server=(await readFile('server/commerce.mjs','utf8')).replace("import defaults from '../public/site-settings.json' with {type: 'json'};",'const defaults='+await readFile('public/site-settings.json','utf8')+';');
const worker=server+'\nconst ASSETS='+JSON.stringify(assets)+`;\nexport default {async fetch(request,env){const p=new URL(request.url).pathname;if(p.startsWith('/api/'))return handleApi(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const routes={'/':'/index.html','/checkout':'/checkout.html','/gracias':'/gracias.html'};const a=ASSETS[routes[p]||p];if(!a)return new Response('Página no encontrada',{status:404});const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':a.type,'Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}};\n`;
await writeFile('dist/server/index.js',worker);await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built '+Object.keys(assets).length+' public assets and shared checkout API.');
