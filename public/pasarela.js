import './showcase.js?v=hero-controls-1';
import './app.js?v=pasarela-2';
const checkoutUrl='/pasarela/checkout'+location.search;
document.querySelectorAll('[data-checkout-cta]').forEach(button=>button.addEventListener('click',()=>{
 window.location.assign(checkoutUrl);
}));
