import {configuration,consentAllowed,attribution,track} from './app.js';
const loading=document.querySelector('#checkout-loading');
const error=document.querySelector('#checkout-error');
let activeConfig=null,checkoutTracked=false;
document.querySelector('#retry-checkout').addEventListener('click',()=>location.reload());
function loadStripe(){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el formulario de pago. Revisa tu conexión e inténtalo nuevamente.'));document.head.append(s)})}
async function trackCheckout(c){if(checkoutTracked||!consentAllowed())return;checkoutTracked=true;let eventID;try{eventID=sessionStorage.getItem('emet_checkout_event_id');if(!eventID){eventID='checkout_'+crypto.randomUUID();sessionStorage.setItem('emet_checkout_event_id',eventID)}}catch{eventID='checkout_'+crypto.randomUUID()}await track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'USD',value:c.course.amount,num_items:1},eventID)}
window.addEventListener('emet-consent',()=>{if(activeConfig)trackCheckout(activeConfig)});
async function start(){
 try {
  const [c]=await Promise.all([configuration,loadStripe()]);
  activeConfig=c;
  if(!c.checkoutEnabled)throw Error('Las inscripciones online todavía no están habilitadas. Escríbenos para coordinar tu acceso al taller.');
  document.querySelector('#test-mode').hidden=!c.testMode;
  await trackCheckout(c);
  const stripe=window.Stripe(c.publishableKey);
  const checkout=await stripe.createEmbeddedCheckoutPage({fetchClientSecret:async()=>{
   const body={requestId:crypto.randomUUID(),consent:consentAllowed(),...attribution()};
   const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo iniciar el pago.');
   return data.clientSecret;
  }});
  loading.hidden=true;checkout.mount('#checkout');
 }catch(e){loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'No pudimos abrir el pago. Inténtalo de nuevo.';}
}
start();

