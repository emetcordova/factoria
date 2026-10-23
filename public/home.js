// Initialize the gallery before configuration can import an older module URL.
import './showcase.js?v=hero-controls-1';
import {setOrderBump} from './app.js?v=price-50-2';
document.querySelectorAll('[data-checkout-cta]').forEach(link=>link.addEventListener('click',()=>setOrderBump(false)));
