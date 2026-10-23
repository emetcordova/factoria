import {configuration,consentAllowed,attribution,track,orderBumpSelected,setOrderBump} from './app.js?v=price-50-2';
const loading=document.querySelector('#checkout-loading');
const error=document.querySelector('#checkout-error');
let activeConfig=null,checkoutTracked=false,checkoutInstance=null,mountGeneration=0;
document.querySelector('#retry-checkout').addEventListener('click',()=>location.reload());
function loadStripe(){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el formulario de pago. Revisa tu conexión e inténtalo nuevamente.'));document.head.append(s)})}
async function trackCheckout(c){if(checkoutTracked||!consentAllowed())return;checkoutTracked=true;let eventID;try{eventID=sessionStorage.getItem('emet_checkout_event_id');if(!eventID){eventID='checkout_'+crypto.randomUUID();sessionStorage.setItem('emet_checkout_event_id',eventID)}}catch{eventID='checkout_'+crypto.randomUUID()}const selected=orderBumpSelected(),value=Number(c.course.amount)+(selected?Number(c.orderBump.amount):0);await track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'PEN',value,num_items:selected?2:1},eventID)}
window.addEventListener('emet-consent',()=>{if(activeConfig)trackCheckout(activeConfig)});
async function mountCheckout(c,stripe){
 const generation=++mountGeneration;loading.hidden=false;error.hidden=true;
 if(checkoutInstance){checkoutInstance.destroy();checkoutInstance=null;document.querySelector('#checkout').replaceChildren();}
 const checkout=await stripe.createEmbeddedCheckoutPage({fetchClientSecret:async()=>{
  const body={requestId:crypto.randomUUID(),consent:consentAllowed(),orderBump:orderBumpSelected(),...attribution()};
  const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo iniciar el pago.');return data.clientSecret;
 }});
 if(generation!==mountGeneration){checkout.destroy();return;}
 checkoutInstance=checkout;loading.hidden=true;checkout.mount('#checkout');
}
async function start(){
 setOrderBump(false);
 try {
  const [c]=await Promise.all([configuration,loadStripe()]);activeConfig=c;
  if(!c.checkoutEnabled)throw Error('Las inscripciones online todavía no están habilitadas. Escríbenos para coordinar tu acceso al taller.');
  document.querySelector('#test-mode').hidden=!c.testMode;
  const bump=document.querySelector('#checkout-bump'),total=document.querySelector('#checkout-total'),stripe=window.Stripe(c.publishableKey);
  const refresh=()=>{const selected=orderBumpSelected(),value=Number(c.course.amount)+(selected?Number(c.orderBump.amount):0);bump.checked=selected;total.textContent=`S/ ${value}`;document.querySelectorAll('[data-checkout-price]').forEach(el=>el.textContent=`S/ ${value}`)};
  bump.addEventListener('change',async()=>{setOrderBump(bump.checked);refresh();checkoutTracked=false;try{sessionStorage.removeItem('emet_checkout_event_id')}catch{}await trackCheckout(c);try{await mountCheckout(c,stripe)}catch(e){loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'No pudimos actualizar el pago. Inténtalo nuevamente.'}});refresh();
  await trackCheckout(c);await mountCheckout(c,stripe);
 }catch(e){loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'No pudimos abrir el pago. Inténtalo de nuevo.';}
}
start();
