// Initialize the gallery before configuration can import an older module URL.
import './showcase.js?v=gallery-order-2';
import {setOrderBump} from './app.js?v=social-5';
document.querySelectorAll('[data-checkout-cta]').forEach(link=>link.addEventListener('click',()=>setOrderBump(true)));
