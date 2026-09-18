import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleApi,verifySignature,COURSE} from '../server/commerce.mjs';
const env={SITE_URL:'https://example.com',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example',META_PIXEL_ID:'12345',META_ACCESS_TOKEN:'test-token',META_GRAPH_VERSION:'v23.0',META_TEST_EVENT_CODE:'TEST123'};
const session={id:'cs_test_abcdefghijklm',mode:'payment',status:'complete',payment_status:'paid',amount_total:1900,currency:'usd',livemode:true,metadata:{course_id:COURSE.id,marketing_consent:'true'},customer_details:{email:'Person@example.com'}};
const fakeResponse=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
const req=(body,origin=env.SITE_URL)=>new Request('https://example.com/api/checkout',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const never=()=>{throw Error('Must not call external service')};
function webhook(s=session,type='checkout.session.completed'){
 const payload=JSON.stringify({type,livemode:true,created:Math.floor(Date.now()/1000),data:{object:s}});const t=Math.floor(Date.now()/1000);const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(t+'.'+payload).digest('hex');
 return new Request('https://example.com/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${signature}`},body:payload});
}
test('Configuration never exposes secret keys and checkout fails safely when unconfigured',async()=>{
 const r=await handleApi(new Request('https://example.com/api/config'),env,never);const data=await r.json();assert.equal(data.checkoutEnabled,true);assert.equal(data.STRIPE_SECRET_KEY,undefined);assert.equal(data.META_ACCESS_TOKEN,undefined);
 assert.equal((await handleApi(req({}),{},never)).status,503);
});
test('Checkout rejects a foreign origin',async()=>assert.equal((await handleApi(req({},'https://evil.example'),env,never)).status,403));
test('Checkout price, currency, quantity and redirect are fixed server-side',async()=>{
 let body,headers;const r=await handleApi(req({requestId:'abcdefghijklmnopqrstuvwx',amount:1,currency:'pen',return_url:'https://evil.example',quantity:100,consent:false}),env,async(url,o)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');body=new URLSearchParams(o.body);headers=o.headers;return fakeResponse({client_secret:'secret',id:session.id})});
 assert.equal(r.status,200);assert.equal(body.get('line_items[0][price_data][unit_amount]'),'1900');assert.equal(body.get('line_items[0][price_data][currency]'),'usd');assert.equal(body.get('line_items[0][quantity]'),'1');assert.match(body.get('return_url'),/^https:\/\/example.com\/gracias\?/);assert.equal(body.get('metadata[marketing_consent]'),'false');assert.equal(headers['Idempotency-Key'],'emet-abcdefghijklmnopqrstuvwx');assert.equal(body.get('ui_mode'),'embedded_page');
});
test('Raw webhook signature rejects invalid or stale payloads and accepts a valid one',async()=>{
 const raw='{"test":true}',t=Math.floor(Date.now()/1000);const sig=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(t+'.'+raw).digest('hex');
 assert.equal(await verifySignature(raw,`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET),true);
 assert.equal(await verifySignature(raw+' ',`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET),false);
 assert.equal(await verifySignature(raw,`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET,Date.now()+400000),false);
});
test('Status confirms only paid sessions; does not expose customer email',async()=>{
 const request=()=>new Request('https://example.com/api/session?session_id='+session.id);
 const unpaid=await (await handleApi(request(),env,async()=>fakeResponse({...session,payment_status:'unpaid'}))).json();assert.equal(unpaid.paid,false);
 const paid=await (await handleApi(request(),env,async()=>fakeResponse(session))).json();assert.equal(paid.paid,true);assert.equal(paid.eventId,'purchase_'+session.id);assert.equal(paid.customer_details,undefined);assert.equal(JSON.stringify(paid).includes('Person@'),false);
});
test('A different product cannot be reported as a course purchase',async()=>{
 const r=await handleApi(new Request('https://example.com/api/session?session_id='+session.id),env,async()=>fakeResponse({...session,metadata:{course_id:'another_product'}}));assert.equal(r.status,404);
});
test('Unsigned webhook cannot create a conversion',async()=>{
 const r=await handleApi(new Request('https://example.com/api/stripe-webhook',{method:'POST',body:'{}'}),env,never);assert.equal(r.status,400);
});
test('Confirmed webhook sends actual amount, hashed email and same event_id as browser; retries keep same ID',async()=>{
 const sent=[];const fetcher=async(url,o)=>{assert.match(url,/graph.facebook.com/);sent.push(JSON.parse(o.body));return fakeResponse({events_received:1})};
 assert.equal((await handleApi(webhook(),env,fetcher)).status,200);assert.equal((await handleApi(webhook(),env,fetcher)).status,200);
 assert.equal(sent[0].data[0].event_id,'purchase_'+session.id);assert.equal(sent[0].data[0].event_id,sent[1].data[0].event_id);assert.equal(sent[0].data[0].custom_data.value,19);assert.match(sent[0].data[0].user_data.em[0],/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(sent).includes('Person@'),false);
});
test('Unpaid or unconsented purchases never trigger CAPI',async()=>{
 assert.equal((await handleApi(webhook({...session,payment_status:'unpaid'}),env,never)).status,200);
 const r=await handleApi(webhook({...session,metadata:{course_id:COURSE.id,marketing_consent:'false'}}),env,never);assert.equal((await r.json()).delivery,'no_consent');
});
test('Failed Meta delivery returns an error so Stripe can retry',async()=>{
 const r=await handleApi(webhook(),env,async()=>new Response('{}',{status:500}));assert.equal(r.status,502);
});
