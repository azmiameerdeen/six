const {contextBridge,ipcRenderer}=require('electron');
// Only boolean call activity crosses this bridge; no audio, video, or message data.
if(location.protocol==='https:'&&['teams.microsoft.com','teams.live.com','teams.cloud.microsoft'].some(h=>location.hostname===h||location.hostname.endsWith('.'+h))){
 contextBridge.exposeInMainWorld('__sixCallStatus',{report:(active,ready)=>ipcRenderer.send('teams-call-status',{active:active===true,ready:ready===true})});
 contextBridge.executeInMainWorld({func:()=>{
  const peers=new Set(),tracks=new Set();let last='',ready=false;
  function report(){
   for(const p of peers)if(['closed','failed'].includes(p.connectionState))peers.delete(p);
   for(const t of tracks)if(t.readyState==='ended')tracks.delete(t);
   const active=peers.size>0||tracks.size>0,key=active+':'+ready;
   if(last!==key){last=key;window.__sixCallStatus.report(active,ready)}
  }
  try{
   const NativePC=window.RTCPeerConnection;
   if(typeof NativePC!=='function'){report();return}
   window.RTCPeerConnection=new Proxy(NativePC,{construct(target,args,newTarget){
    const pc=Reflect.construct(target,args,newTarget);peers.add(pc);
    pc.addEventListener('connectionstatechange',report);pc.addEventListener('iceconnectionstatechange',report);
    const close=pc.close;pc.close=function(...a){const result=close.apply(this,a);report();return result};report();return pc;
   }});
   for(const method of ['getUserMedia','getDisplayMedia']){
    const devices=navigator.mediaDevices,original=devices?.[method];if(!original)continue;
    devices[method]=async function(...args){
     // Request an audio track; Six's chooser still decides whether to share it.
     if(method==='getDisplayMedia')args[0]={...(args[0]||{}),audio:true,systemAudio:'include'};
     const stream=await original.apply(this,args);
     for(const track of stream.getTracks()){
      if(tracks.has(track))continue;tracks.add(track);track.addEventListener('ended',report);
      const stop=track.stop;track.stop=function(...a){const result=stop.apply(this,a);report();return result};
     }
     report();return stream;
    };
   }
   ready=true;report();
  }catch{ready=false;report()}
 }});
}
