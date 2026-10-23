// The hero owns its controls; gallery videos always take audio priority.
const video=document.querySelector('#hero-video');
const sound=document.querySelector('#sound-toggle');
if(video){
 let userPaused=false;
 video.controls=false;
 video.muted=true;
 video.defaultMuted=true;
 const sync=()=>{
  video.parentElement.classList.toggle('is-paused',video.paused);
  video.setAttribute('aria-label',video.paused?'Reproducir video del taller':'Pausar video del taller');
  if(sound){sound.hidden=!video.muted;sound.textContent='Activar sonido';}
 };
 const play=()=>video.play().catch(()=>{sync()});
 const autoPlay=()=>{if(!userPaused&&!document.hidden&&video.paused)play()};
 const toggle=()=>{if(video.paused){userPaused=false;play()}else{userPaused=true;video.pause()}};
 video.addEventListener('click',toggle);
 video.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle()}});
 for(const event of ['play','pause','volumechange','error'])video.addEventListener(event,sync);
 for(const event of ['loadeddata','canplay'])video.addEventListener(event,autoPlay);
 document.addEventListener('visibilitychange',autoPlay);
 sound?.addEventListener('click',event=>{event.stopPropagation();video.muted=false;userPaused=false;sync();play()});
 window.addEventListener('emet-gallery-video',()=>{video.muted=true;sync()});
 sync();autoPlay();
}
