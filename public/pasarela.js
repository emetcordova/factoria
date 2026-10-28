import './showcase.js?v=hero-controls-1';
import {configuration,consentAllowed,attribution,track} from './app.js?v=pasarela-1';
const buttons=[...document.querySelectorAll('[data-checkout-cta]')];
const loading=document.querySelector('#checkout-loading');
const error=document.querySelector('#checkout-error');
let instance=null,opening=null,checkoutTracked=false;
function loadStripe(){return new Promise((resolve,reject)=>{if(window.Stripe)return resolve();const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el formulario de pago. Revisa tu conexión.'));document.head.append(s)})}
async function openCheckout(){
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
 document.querySelector('#pago').scrollIntoView({behavior:'smooth',block:'start'});
 if(instance)return;
 if(opening)return opening;
 error.hidden=true;loading.hidden=false;
 opening=(async()=>{
  try{
   const [c]=await Promise.all([configuration,loadStripe()]);
   if(!c.checkoutEnabled)throw Error('El pago en línea no está disponible en este momento. Inténtalo de nuevo.');
   document.querySelector('#test-mode').hidden=!c.testMode;
   const stripe=window.Stripe(c.publishableKey);
   instance=await stripe.createEmbeddedCheckoutPage({fetchClientSecret:async()=>{
    const response=await fetch('/api/checkout-pasarela',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),consent:consentAllowed(),...attribution()})});
    const data=await response.json();if(!response.ok||!data.clientSecret)throw Error(data.error||'No pudimos iniciar el pago.');
    if(!checkoutTracked){checkoutTracked=true;await track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'PEN',value:50,num_items:1},'checkout_'+data.sessionId)}
    return data.clientSecret;
   }});
   instance.mount('#checkout');loading.hidden=true;
  }catch(e){instance=null;loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'Inténtalo de nuevo.'}
  finally{opening=null}
 })();
 return opening;
}
buttons.forEach(button=>button.addEventListener('click',openCheckout));
document.querySelector('#retry-checkout').addEventListener('click',openCheckout);
