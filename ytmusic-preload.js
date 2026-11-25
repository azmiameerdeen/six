const {contextBridge,ipcRenderer}=require('electron');
// YouTube Music ad removal. Runs in the page before YouTube's own scripts:
// 1. removes ad slots from player data so most ads are never scheduled;
// 2. if an ad still plays, it is muted, run to its end and skipped.
// Self-contained because sandboxed preloads cannot load other local files.
function ytAdShield(){
 const adKeys=['adPlacements','adSlots','playerAds','adBreakHeartbeatParams'];
 function strip(o){
  if(o&&typeof o==='object'){
   for(const k of adKeys)if(k in o)delete o[k];
   if(o.playerResponse&&typeof o.playerResponse==='object')strip(o.playerResponse);
  }
  return o;
 }
 const parse=JSON.parse;
 JSON.parse=function(...args){return strip(parse.apply(this,args))};
 if(typeof Response!=='undefined'){
  const json=Response.prototype.json;
  Response.prototype.json=function(...args){return json.apply(this,args).then(strip)};
 }
 // Player data embedded in the first page load.
 let initial;
 try{Object.defineProperty(window,'ytInitialPlayerResponse',{configurable:true,get:()=>initial,set:v=>{initial=strip(v)}})}catch{}
 // Fallback for ads that still get through.
 // Ads and songs share one <video>, so undo the mute as soon as the ad is gone.
 let mutedVideo=null;
 if(typeof document!=='undefined'&&typeof setInterval!=='undefined')setInterval(()=>{
  const player=document.querySelector('.ad-showing');
  if(!player){if(mutedVideo){mutedVideo.muted=false;mutedVideo=null}return}
  const video=player.querySelector('video');
  if(video){if(!video.muted){video.muted=true;mutedVideo=video}if(isFinite(video.duration)&&video.duration>0)video.currentTime=video.duration}
  document.querySelector('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button')?.click();
 },500);
 return strip;
}
// Records why playback stops, to Six's local diagnostics log (never sent anywhere), and answers YouTube
// Music's "Continue watching?" prompt, which pauses music until it is clicked.
function ytDiagnostics(){
 const send=line=>{try{window.__sixDiag.log(line)}catch{}};
 const log=(what,extra)=>send(JSON.stringify({what,vis:document.visibilityState,...extra}));
 let lastInput=0;
 for(const type of ['pointerdown','keydown','wheel'])document.addEventListener(type,()=>{lastInput=Date.now()},true);
 const snapshot=el=>({time:Math.round(el.currentTime||0),of:Math.round(el.duration)||0,ended:!!el.ended,ready:el.readyState,muted:!!el.muted,ad:!!document.querySelector('.ad-showing'),
  youThere:!!document.querySelector('ytmusic-you-there-renderer'),byUser:Date.now()-lastInput<1500});
 for(const type of ['pause','ended','error','stalled'])
  document.addEventListener(type,e=>{if(typeof HTMLMediaElement!=='undefined'&&e.target instanceof HTMLMediaElement)log(type,snapshot(e.target))},true);
 // Pauses asked for from outside the page: media keys, a headset, the desktop's media controls.
 const session=typeof navigator!=='undefined'&&navigator.mediaSession;
 if(session&&typeof session.setActionHandler==='function'){
  const original=session.setActionHandler.bind(session);
  session.setActionHandler=(action,handler)=>original(action,action==='pause'&&typeof handler==='function'?function(...args){log('media control asked to pause',{});return handler.apply(this,args)}:handler);
 }
 let answered=false;
 if(typeof setInterval!=='undefined')setInterval(()=>{
  const prompt=document.querySelector('ytmusic-you-there-renderer');
  if(!prompt){answered=false;return}
  const yes=[...prompt.querySelectorAll('button,[role=button]')].find(b=>/yes|continue/i.test(b.textContent||b.getAttribute('aria-label')||''));
  if(!answered){answered=true;log(yes?'answered the Continue watching prompt':'Continue watching prompt shown, no button found',{})}
  if(yes)yes.click();
 },4000);
}
if(typeof location!=='undefined'&&location.protocol==='https:'&&['music.youtube.com','www.youtube.com','youtube.com'].includes(location.hostname)){
 contextBridge.exposeInMainWorld('__sixDiag',{log:line=>{if(typeof line==='string')ipcRenderer.send('six-diag',line.slice(0,400))}});
 contextBridge.executeInMainWorld({func:ytAdShield});
 contextBridge.executeInMainWorld({func:ytDiagnostics});
}
if(typeof module!=="undefined")module.exports={ytAdShield,ytDiagnostics}; // for tests
