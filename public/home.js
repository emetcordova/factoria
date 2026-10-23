// Initialize the gallery before configuration can import an older module URL.
import './showcase.js?v=gallery-order-2';
import './app.js?v=social-5';
// Keep the vertical hero media compact enough that the mobile first viewport
// can contain headline, video, sales copy and the primary CTA at 375px.
const responsive=document.createElement('style');
responsive.textContent='@media(max-width:760px){.hero-video-wrap{max-width:200px!important}.hero-video{max-height:44vh!important}}';
document.head.append(responsive);
