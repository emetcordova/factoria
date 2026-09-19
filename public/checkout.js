import {configuration,consentAllowed,attribution,track} from './app.js';
const loading=document.querySelector('#checkout-loading');
const error=document.querySelector('#checkout-error');
document.querySelector('#retry-checkout').addEventListener('click',()=>location.reload());
function loadStripe(){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el formulario de pago. Revisa tu conexión e inténtalo nuevamente.'));document.head.append(s)})}
async function start(){
 try {
  const [c]=await Promise.all([configuration,loadStripe()]);
  if(!c.checkoutEnabled)throw Error('Las inscripciones online todavía no están habilitadas. Escríbenos para coordinar tu acceso al taller.');
  document.querySelector('#test-mode').hidden=!c.testMode;
  const body={requestId:crypto.randomUUID(),consent:consentAllowed(),...attribution()};
  const stripe=window.Stripe(c.publishableKey);
  const checkout=await stripe.createEmbeddedCheckoutPage({fetchClientSecret:async()=>{
   const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo iniciar el pago.');
   if(!c.testMode)track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',currency:'USD',value:c.course.amount,num_items:1});
   return data.clientSecret;
  }});
  loading.hidden=true;checkout.mount('#checkout');
 }catch(e){loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'No pudimos abrir el pago. Inténtalo de nuevo.';}
}
start();
