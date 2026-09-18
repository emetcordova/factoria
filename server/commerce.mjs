export const COURSE = { id: 'emet-contenido-ia-2026-10-01', name: 'Contenido en minutos con IA — Emet', amount: 1900, currency: 'usd' };
const API_VERSION = '2026-08-26.dahlia';
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const clean = (v, max=250) => typeof v === 'string' ? v.slice(0,max) : '';
function origin(env) { try { const u = new URL(env.SITE_URL || ''); return u.protocol === 'https:' ? u.origin : null; } catch { return null; } }
function ready(env) { return Boolean(origin(env) && /^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'') && /^pk_(test|live)_/.test(env.STRIPE_PUBLISHABLE_KEY||'') && env.STRIPE_SECRET_KEY.split('_')[1] === env.STRIPE_PUBLISHABLE_KEY.split('_')[1]); }
async function stripe(path,env,fetcher,options={}) {
 const response = await fetcher('https://api.stripe.com/v1/'+path,{...options,headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':API_VERSION,...options.headers}});
 const data = await response.json();
 if(!response.ok) throw new Error('stripe_request_failed');
 return data;
}
export async function verifySignature(raw,header,secret,now=Date.now()) {
 if(!secret || !header) return false;
 const entries=header.split(',').map(x=>x.split('='));
 const t=entries.find(x=>x[0]==='t')?.[1];
 if(!/^\d+$/.test(t||'') || Math.abs(now/1000-Number(t))>300) return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [name,sig] of entries) {
  if(name!=='v1' || !/^[0-9a-f]{64}$/i.test(sig))continue;
  const bytes=Uint8Array.from(sig.match(/../g),x=>parseInt(x,16));
  if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(t+'.'+raw)))return true;
 }
 return false;
}
async function sha256(value) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function isCoursePurchase(s) {return s?.metadata?.course_id===COURSE.id && s.payment_status==='paid' && s.amount_total===COURSE.amount && s.currency===COURSE.currency && s.mode==='payment';}
export async function sendPurchase(s,event,env,fetcher) {
 if(s.metadata.marketing_consent!=='true')return 'no_consent';
 if(!env.META_ACCESS_TOKEN)return 'not_configured';
 if(!/^\d+$/.test(env.META_PIXEL_ID||'') || !env.META_ACCESS_TOKEN || !/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||''))throw Error('meta_not_configured');
 // Test Stripe payments must never enter production advertising data.
 if(!event.livemode && !env.META_TEST_EVENT_CODE)return 'test_payment';
 const user={};
 const email=s.customer_details?.email?.trim().toLowerCase();
 if(email)user.em=[await sha256(email)];
 for(const name of ['fbp','fbc'])if(s.metadata[name])user[name]=s.metadata[name];
 if(s.metadata.client_user_agent)user.client_user_agent=s.metadata.client_user_agent;
 const payload={data:[{event_name:'Purchase',event_time:event.created,event_id:'purchase_'+s.id,action_source:'website',event_source_url:origin(env)+'/checkout',user_data:user,custom_data:{currency:COURSE.currency.toUpperCase(),value:s.amount_total/100,content_ids:[COURSE.id],content_type:'product',num_items:1}}]};
 if(env.META_TEST_EVENT_CODE)payload.test_event_code=env.META_TEST_EVENT_CODE;
 const r=await fetcher(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PIXEL_ID}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.META_ACCESS_TOKEN},body:JSON.stringify(payload)});
 if(!r.ok)throw Error('meta_delivery_failed');
 const result=await r.json();if(result.events_received!==1)throw Error('meta_not_accepted');
 return 'sent';
}
export async function handleApi(request,env,fetcher=fetch) {
 const u=new URL(request.url), path=u.pathname;
 try {
  if(path==='/api/config' && request.method==='GET')return json({checkoutEnabled:ready(env),publishableKey:ready(env)?env.STRIPE_PUBLISHABLE_KEY:null,pixelId:/^\d+$/.test(env.META_PIXEL_ID||'')?env.META_PIXEL_ID:null,testMode:!env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),course:COURSE});
  if(path==='/api/checkout' && request.method==='POST') {
   if(!ready(env))return json({error:'Las inscripciones online todavía no están habilitadas. Escríbenos para coordinar tu acceso.'},503);
   if(request.headers.get('origin')!==origin(env))return json({error:'Solicitud no autorizada.'},403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato no válido.'},415);
   const raw=await request.text();if(raw.length>8192)return json({error:'Solicitud demasiado grande.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Solicitud no válida.'},400)}
   if(!body || typeof body!=='object' || !/^[a-zA-Z0-9-]{20,80}$/.test(body.requestId||''))return json({error:'Recarga la página e inténtalo nuevamente.'},400);
   const params=new URLSearchParams({ui_mode:'embedded_page',mode:'payment',locale:'es',return_url:origin(env)+'/gracias?session_id={CHECKOUT_SESSION_ID}',
    'line_items[0][price_data][currency]':COURSE.currency,'line_items[0][price_data][unit_amount]':String(COURSE.amount),'line_items[0][price_data][product_data][name]':COURSE.name,'line_items[0][quantity]':'1',
    'metadata[course_id]':COURSE.id,'metadata[marketing_consent]':String(body.consent===true),'payment_intent_data[metadata][course_id]':COURSE.id});
   if(body.consent===true) {
    for(const name of ['fbp','fbc']){const v=clean(body[name]);if(/^fb\.\d+\.\d+\.[a-zA-Z0-9_-]+$/.test(v))params.set('metadata['+name+']',v);}
    params.set('metadata[client_user_agent]',clean(request.headers.get('user-agent'),450));
    for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(body[name])params.set('metadata['+name+']',clean(body[name],200));
   }
   const session=await stripe('checkout/sessions',env,fetcher,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'emet-'+body.requestId},body:params.toString()});
   return json({clientSecret:session.client_secret,sessionId:session.id});
  }
  if(path==='/api/session' && request.method==='GET') {
   if(!ready(env))return json({error:'No podemos verificar el pago en este momento.'},503);
   const id=u.searchParams.get('session_id');if(!/^cs_(test_|live_)?[a-zA-Z0-9]{10,250}$/.test(id||''))return json({error:'Referencia de compra no válida.'},400);
   const session=await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher);
   if(session.metadata?.course_id!==COURSE.id)return json({error:'Compra no encontrada.'},404);
   return json({paid:isCoursePurchase(session),status:session.status,paymentStatus:session.payment_status,value:session.amount_total/100,currency:session.currency?.toUpperCase(),eventId:'purchase_'+session.id,allowTracking:session.metadata.marketing_consent==='true' && session.livemode===true});
  }
  if(path==='/api/stripe-webhook' && request.method==='POST') {
   if(!env.STRIPE_WEBHOOK_SECRET)return json({error:'Webhook no configurado.'},503);
   const raw=await request.text();if(raw.length>1000000)return json({error:'Payload too large.'},413);
   if(!await verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid signature.'},400);
   const event=JSON.parse(raw);
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type) && isCoursePurchase(event.data?.object)) {
    // A non-2xx response on delivery failure makes Stripe retry; deterministic event_id deduplicates retries and Pixel.
    const delivery=await sendPurchase(event.data.object,event,env,fetcher);return json({received:true,delivery});
   }
   return json({received:true});
  }
  return json({error:'Ruta no encontrada.'},404);
 } catch { return json({error:'No pudimos completar la solicitud. Inténtalo nuevamente en unos minutos.'},502); }
}
