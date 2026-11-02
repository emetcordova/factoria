// The hero starts paused and plays at most twice per user-initiated cycle.
const video=document.querySelector('#hero-video');
const playButton=document.querySelector('#hero-play');
if(video&&playButton){
 let completedPlays=0;
 video.controls=false;
 video.autoplay=false;
 video.loop=false;
 video.muted=false;
 video.defaultMuted=false;

 const sync=()=>{
  const paused=video.paused;
  video.parentElement.classList.toggle('is-paused',paused);
  playButton.hidden=!paused;
  playButton.setAttribute('aria-label',completedPlays>=2?'Reproducir nuevamente el video del taller':'Reproducir video del taller con sonido');
 };

 const start=()=>{
  if(completedPlays>=2||video.ended){
   completedPlays=0;
   video.currentTime=0;
  }
  video.muted=false;
  video.play().catch(sync);
 };

 const toggle=()=>{
  if(video.paused)start();
  else video.pause();
 };

 playButton.addEventListener('click',event=>{event.stopPropagation();start()});
 video.addEventListener('click',toggle);
 video.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle()}});
 video.addEventListener('ended',()=>{
  completedPlays+=1;
  if(completedPlays<2){
   video.currentTime=0;
   video.play().catch(sync);
  }else sync();
 });
 for(const event of ['play','pause','volumechange','error'])video.addEventListener(event,sync);
 window.addEventListener('emet-gallery-video',()=>{if(!video.paused)video.pause()});
 sync();
}
