const {contextBridge}=require('electron');
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
if(typeof location!=='undefined'&&location.protocol==='https:'&&['music.youtube.com','www.youtube.com','youtube.com'].includes(location.hostname)){
 contextBridge.executeInMainWorld({func:ytAdShield});
}
if(typeof module!=="undefined")module.exports={ytAdShield}; // for tests
