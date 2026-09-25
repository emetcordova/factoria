export function renderSchedule(c){
 const root=document.querySelector('#country-times');if(!root)return;
 const zones=[['🇵🇪','Perú','America/Lima'],['🇲🇽','México · CDMX','America/Mexico_City'],['🇦🇷','Argentina','America/Argentina/Buenos_Aires'],['🇨🇱','Chile · Santiago','America/Santiago'],['🇨🇴','Colombia','America/Bogota'],['🇺🇸','EE. UU. · Miami / NY','America/New_York'],['🇺🇸','EE. UU. · Los Ángeles','America/Los_Angeles']];
 root.replaceChildren();
 for(const [flag,label,timeZone] of zones){const card=document.createElement('div');card.className='country-time';const country=document.createElement('span');country.textContent=flag+' '+label;const time=document.createElement('strong');if(c.eventStartsAt){const instant=new Date(c.eventStartsAt);time.textContent=new Intl.DateTimeFormat('es-PE',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(instant)}else time.textContent='Por confirmar';card.append(country,time);root.append(card)}
}
const gallery=document.querySelector('#image-gallery');
if(gallery&&!gallery.dataset.initialized){gallery.dataset.initialized='true';init().catch(()=>{document.querySelector('#gallery-description').textContent='Las creaciones estarán disponibles próximamente.'});}
async function init(){
 const response=await fetch('/gallery.json');if(!response.ok)throw Error('gallery');const data=await response.json();
 const safe=url=>typeof url==='string'&&(/^https:\/\//.test(url)||/^\/assets\//.test(url));
 const authentic=(data.images||[]).filter(x=>safe(x.src)&&x.approved===true).slice(0,20);
 const demo=[{src:'/assets/perfume.webp',title:'Fotografía de producto'},{src:'/assets/creator-light.webp',title:'Retrato editorial'},{src:'/assets/community.webp',title:'Escena de marca'}];
 const images=authentic.length?authentic:demo;
 document.querySelector('#gallery-description').textContent=authentic.length?'Diseños creados con IA. Toca una pieza para verla completa.':'Ejemplos ilustrativos creados con IA. Las creaciones de estudiantes se incorporarán próximamente.';
 const dialog=document.querySelector('#media-dialog'),content=document.querySelector('#media-content');let trigger=null,oldOverflow='';
 const previews=[];
 const pendingPlays=new WeakSet();
 function playPreview(video){
  if(document.hidden||dialog.open||pendingPlays.has(video)||!video.paused)return;
  video.muted=true;video.defaultMuted=true;
  pendingPlays.add(video);
  const attempt=video.play();
  Promise.resolve(attempt).then(()=>{
   delete video.dataset.autoplayError;
  }).catch(error=>{
   video.dataset.autoplayError=error.name||'PlaybackError';
   video.parentElement.classList.remove('is-playing');
  }).finally(()=>pendingPlays.delete(video));
 }
 function startPreviews(){previews.forEach(playPreview)}
 function pausePreviews(){previews.forEach(video=>video.pause())}
 const previewObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)playPreview(entry.target.querySelector('video'));
 },{threshold:0}):null;
 function registerPreview(button,video){
  previews.push(video);
  video.addEventListener('loadeddata',()=>playPreview(video));
  video.addEventListener('canplay',()=>playPreview(video));
  video.addEventListener('timeupdate',()=>{if(!video.paused&&video.currentTime>0)button.classList.add('is-playing')});
  video.addEventListener('pause',()=>button.classList.remove('is-playing'));
  video.addEventListener('error',()=>{button.classList.remove('is-playing');video.dataset.autoplayError='MediaError'});
  previewObserver?.observe(button);
  playPreview(video);
 }
 function open(item,video,source){trigger=source;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';gallery.classList.add('paused');pausePreviews();content.replaceChildren();const el=document.createElement(video?'video':'img');el.src=item.src;if(video){el.controls=true;el.playsInline=true;el.setAttribute('playsinline','');el.setAttribute('webkit-playsinline','');el.muted=false;el.autoplay=true;el.preload='auto';el.addEventListener('loadedmetadata',()=>{if(el.currentTime!==0)el.currentTime=0},{once:true})}else el.alt=item.title||'Creación con IA';content.append(el);dialog.showModal();if(video)el.play().catch(()=>{})}
 dialog.querySelector('.media-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{const active=content.querySelector('video');if(active){active.muted=true;active.pause();}content.replaceChildren();document.body.style.overflow=oldOverflow;trigger?.focus({preventScroll:true});gallery.classList.remove('paused');startPreviews()});
 const split=Math.ceil(images.length/2);const rows=[images.slice(0,split),images.slice(split)].filter(row=>row.length);
 rows.forEach((items,i)=>{const viewport=document.createElement('div');viewport.className='gallery-row'+(i%2?' reverse':'');const track=document.createElement('div');track.className='gallery-track';for(let copy=0;copy<2;copy++){const group=document.createElement('div');group.className='gallery-group';if(copy)group.setAttribute('aria-hidden','true');for(const [j,item] of items.entries()){const button=document.createElement('button');button.className='gallery-piece';if(copy||j>=items.length){button.tabIndex=-1;button.setAttribute('aria-hidden','true')}const img=document.createElement('img');img.src=item.src;img.alt=item.title||'Creación con IA';img.loading='lazy';img.width=320;img.height=320;button.append(img);button.addEventListener('click',()=>open(item,false,button));group.append(button)}track.append(group)}viewport.append(track);gallery.append(viewport)});
 const videos=(data.videos||[]).filter(x=>safe(x.src)&&x.approved===true).slice(0,9);const grid=document.querySelector('#video-grid');
 for(let i=0;i<9;i++){const item=videos[i];if(!item){const tile=document.createElement('div');tile.className='video-placeholder';const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('strong');label.textContent='Próximamente';const small=document.createElement('small');small.textContent='Una nueva creación en movimiento';tile.append(n,label,small);grid.append(tile);continue}const button=document.createElement('button');button.className='video-tile';button.setAttribute('aria-label','Reproducir con audio: '+(item.title||'Video '+(i+1)));const video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;video.defaultMuted=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.autoplay=true;video.setAttribute('autoplay','');video.preload='auto';video.src=safe(item.preview)?item.preview:item.src;if(safe(item.poster))video.poster=item.poster;video.setAttribute('aria-hidden','true');if(safe(item.motionPreview)){const motion=document.createElement('img');motion.className='video-motion-fallback';motion.src=item.motionPreview;motion.alt='';motion.setAttribute('aria-hidden','true');motion.loading='eager';button.classList.add('has-motion-preview');button.append(motion)}button.append(video);button.addEventListener('click',()=>open(item,true,button));grid.append(button);registerPreview(button,video)}
 document.querySelector('#video-description').hidden=true;
 if(!videos.length)document.querySelector('#video-description').textContent='Pronto podrás explorar aquí nueve creaciones en video de la comunidad.';
 
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePreviews();else startPreviews()});window.addEventListener('pageshow',startPreviews);document.addEventListener('pointerdown',startPreviews,{once:true,passive:true});document.addEventListener('touchend',startPreviews,{once:true,passive:true});for(const delay of [500,1500,3000])setTimeout(startPreviews,delay);startPreviews();
}
