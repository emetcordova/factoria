import {get,put,list} from '@vercel/blob';

const encoder=new TextEncoder();
const ADMIN='emet@4we.pe';
const SESSION_COOKIE='factoria_panel_session';
const LEADS='crm/leads/';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const clean=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const blobOptions=env=>({access:'private',token:env.BLOB_READ_WRITE_TOKEN});
const configured=env=>Boolean(env.BLOB_READ_WRITE_TOKEN&&env.CRM_INITIAL_PASSWORD_HASH&&env.CRM_RECOVERY_CODE_HASH&&env.CRM_SESSION_SECRET);
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(v)));
const constantEqual=async(a,b)=>{
 const key=await crypto.subtle.importKey('raw',encoder.encode('factoria-crm-comparison'),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const [x,y]=await Promise.all([crypto.subtle.sign('HMAC',key,encoder.encode(a)),crypto.subtle.sign('HMAC',key,encoder.encode(b))]);
 return crypto.subtle.verify('HMAC',key,x,y);
};
async function hashPassword(password,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:210000,hash:'SHA-256'},key,256));
}
async function verifyPassword(password,stored){const [salt,digest]=(stored||'').split(':');return Boolean(salt&&digest)&&constantEqual(await hashPassword(password,salt),digest)}
async function passwordHash(password){const salt=crypto.randomUUID().replaceAll('-','');return `${salt}:${await hashPassword(password,salt)}`}
async function readBlob(path,env){const blob=await get(path,{...blobOptions(env),useCache:false});return blob?.statusCode===200?{value:await new Response(blob.stream).json(),etag:blob.blob.etag}:null}
async function writeBlob(path,value,env,etag){return put(path,JSON.stringify(value),{...blobOptions(env),contentType:'application/json',allowOverwrite:true,...(etag?{ifMatch:etag}:{})})}
async function credentials(env){const stored=await readBlob('crm/admin.json',env);return stored||{value:{passwordHash:env.CRM_INITIAL_PASSWORD_HASH,recoveryHash:env.CRM_RECOVERY_CODE_HASH,mustChange:true,version:1},etag:null}}

export async function saveLead(env,id,patch){
 if(!env.BLOB_READ_WRITE_TOKEN||!/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(id||''))return;
 const path=LEADS+id+'.json';
 for(let attempt=0;attempt<3;attempt++){
  const existing=await readBlob(path,env),prior=existing?.value||{};
  const value={...prior,...patch,sessionId:id,createdAt:prior.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),paid:prior.paid===true||patch.paid===true};
  for(const field of ['name','email','whatsapp'])if(!value[field]&&prior[field])value[field]=prior[field];
  if(prior.paid===true&&patch.paid!==true){value.recordings=prior.recordings;value.personalCall=prior.personalCall;value.amount=prior.amount;value.paidAt=prior.paidAt;}
  try{await writeBlob(path,value,env,existing?.etag);return value}catch(error){if(attempt===2)throw error}
 }
}
async function allLeads(env){
 const paths=[];let cursor;
 do{const page=await list({prefix:LEADS,limit:1000,cursor,token:env.BLOB_READ_WRITE_TOKEN});paths.push(...page.blobs.map(b=>b.pathname));cursor=page.hasMore?page.cursor:undefined}while(cursor&&paths.length<10000);
 const rows=[];for(let i=0;i<paths.length;i+=12){const batch=await Promise.all(paths.slice(i,i+12).map(path=>readBlob(path,env)));rows.push(...batch.filter(Boolean).map(x=>x.value))}
 return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
function cookies(request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=').slice(0,2)).filter(x=>x.length===2))}
const b64=value=>Buffer.from(value).toString('base64url');
async function sign(value,env){const key=await crypto.subtle.importKey('raw',encoder.encode(env.CRM_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))}
async function session(request,env,admin){const token=cookies(request)[SESSION_COOKIE]||'';const [payload,signature]=token.split('.');if(!payload||!signature||!await constantEqual(signature,await sign(payload,env)))return false;try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.exp>Date.now()&&data.version===admin.version}catch{return false}}
const cookie=(value,maxAge)=>`${SESSION_COOKIE}=${value}; Path=/api/panel; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
function sameOrigin(request){const url=new URL(request.url);return request.headers.get('origin')===url.origin}
async function bodyJson(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('invalid_content_type');const raw=await request.text();if(raw.length>4096)throw Error('invalid_size');return JSON.parse(raw)}
async function throttle(request,env,failed){const ip=clean(request.headers.get('x-forwarded-for')?.split(',')[0],100)||'unknown',key='crm/attempts/'+await sha(ip)+'.json',entry=await readBlob(key,env),now=Date.now();let value=entry?.value||{count:0,until:now+900000};if(value.until<now)value={count:0,until:now+900000};if(failed){value.count++;await writeBlob(key,value,env,entry?.etag)}return value.count>=6}
function csv(rows){const cols=['createdAt','name','email','whatsapp','paid','recordings','personalCall','amount','paidAt','sessionId'];const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[cols.join(','),...rows.map(row=>cols.map(c=>quote(typeof row[c]==='boolean'?(row[c]?'Sí':'No'):row[c])).join(','))].join('\r\n')}

export async function handlePanelApi(request,env){
 if(!configured(env))return json({error:'El panel aún no está configurado.'},503);
 const path=new URL(request.url).pathname,method=request.method;
 if(method==='POST'&&!sameOrigin(request))return json({error:'Solicitud no autorizada.'},403);
 try{
  const stored=await credentials(env),admin=stored.value;
  if(path==='/api/panel/login'&&method==='POST'){
   if(await throttle(request,env,false))return json({error:'Demasiados intentos. Espera 15 minutos.'},429);
   const data=await bodyJson(request),valid=clean(data.email,120).toLowerCase()===ADMIN&&typeof data.password==='string'&&await verifyPassword(data.password,admin.passwordHash);
   if(!valid){await throttle(request,env,true);return json({error:'Usuario o contraseña incorrectos.'},401)}
   const payload=b64(JSON.stringify({exp:Date.now()+8*3600000,version:admin.version}));
   return json({ok:true,mustChange:admin.mustChange},200,{'Set-Cookie':cookie(payload+'.'+await sign(payload,env),8*3600)});
  }
  if(path==='/api/panel/recover'&&method==='POST'){
   if(await throttle(request,env,false))return json({error:'Demasiados intentos. Espera 15 minutos.'},429);
   const data=await bodyJson(request),valid=clean(data.email,120).toLowerCase()===ADMIN&&typeof data.code==='string'&&await constantEqual(await sha(data.code),admin.recoveryHash);
   if(!valid){await throttle(request,env,true);return json({error:'Código de recuperación incorrecto.'},401)}
   if(typeof data.password!=='string'||data.password.length<14||data.password.length>128)return json({error:'Usa una contraseña de al menos 14 caracteres.'},400);
   const nextCode=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','').slice(0,8);
   await writeBlob('crm/admin.json',{passwordHash:await passwordHash(data.password),recoveryHash:await sha(nextCode),mustChange:false,version:admin.version+1},env,stored.etag);
   return json({ok:true,recoveryCode:nextCode});
  }
  if(path==='/api/panel/logout'&&method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
  if(!await session(request,env,admin))return json({error:'Inicia sesión para continuar.'},401);
  if(path==='/api/panel/me'&&method==='GET')return json({email:ADMIN,mustChange:admin.mustChange});
  if(path==='/api/panel/password'&&method==='POST'){
   const data=await bodyJson(request);
   if(!await verifyPassword(data.current||'',admin.passwordHash))return json({error:'Contraseña actual incorrecta.'},401);
   if(typeof data.password!=='string'||data.password.length<14||data.password.length>128)return json({error:'Usa una contraseña de al menos 14 caracteres.'},400);
   const next={...admin,passwordHash:await passwordHash(data.password),mustChange:false,version:admin.version+1};
   await writeBlob('crm/admin.json',next,env,stored.etag);
   const payload=b64(JSON.stringify({exp:Date.now()+8*3600000,version:next.version}));return json({ok:true},200,{'Set-Cookie':cookie(payload+'.'+await sign(payload,env),8*3600)});
  }
  if(admin.mustChange)return json({error:'Cambia la contraseña inicial para continuar.'},403);
  if(path==='/api/panel/api-key'&&method==='GET')return json({key:env.CRM_API_KEY||null,endpoint:new URL('/api/crm/paid',request.url).href});
  if(path==='/api/panel/leads'&&method==='GET'){
   const rows=await allLeads(env);
   if(new URL(request.url).searchParams.get('format')==='csv')return new Response(csv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="factoria-clientes.csv"','Cache-Control':'no-store'}});
   return json({rows});
  }
  return json({error:'Ruta no encontrada.'},404);
 }catch{return json({error:'No se pudo completar la solicitud.'},500)}
}

export async function handlePaidApi(request,env){
 if(request.method!=='GET')return json({error:'Método no permitido.'},405);
 if(!env.CRM_API_KEY||!env.BLOB_READ_WRITE_TOKEN||!await constantEqual(request.headers.get('authorization')||'',`Bearer ${env.CRM_API_KEY}`))return json({error:'Clave de API no válida.'},401);
 try{
  const u=new URL(request.url),since=clean(u.searchParams.get('since'),40),limit=Math.min(200,Math.max(1,Number(u.searchParams.get('limit'))||100));
  const rows=(await allLeads(env)).filter(row=>row.paid===true&&(!since||row.paidAt>=since)).slice(0,limit).map(row=>({id:row.sessionId,name:row.name,email:row.email||null,whatsapp:row.whatsapp||null,paidAt:row.paidAt,amountUSD:row.amount,coursePaid:true,recordingsPaid:row.recordings===true,personalCallPaid:row.personalCall===true}));
  return json({customers:rows});
 }catch{return json({error:'No se pudo consultar la API.'},500)}
}
