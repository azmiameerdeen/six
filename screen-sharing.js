function sourceLabel(source,index){
 const name=typeof source.name==='string'?source.name.trim():'';
 if(name)return name.replace(/&/g,'&&');
 if(source.id?.startsWith('window:'))return 'Window '+(index+1);
 if(source.id?.startsWith('screen:'))return 'Screen '+(index+1);
 return 'Selected screen or window '+(index+1);
}
function makeScreenShareHandler({allowed,getSources,chooseSource,onPicking=()=>{}}){
 return async(request,callback)=>{
  let completed=false;
  const finish=streams=>{if(!completed){completed=true;callback(streams)}};
  if(!allowed(request.securityOrigin)||!request.frame||!request.videoRequested){finish({});return}
  onPicking(true);
  try{
   const sources=await getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});
   if(!sources.length){finish({});return}
   const choice=await chooseSource(sources);
   const id=typeof choice==='string'?choice:choice?.id;
   const source=sources.find(s=>s.id===id);
   // The page can navigate while the chooser is open. Re-check before granting.
   if(!source||!allowed(request.frame.url)||new URL(request.frame.url).origin!==new URL(request.securityOrigin).origin){finish({});return}
   finish({video:source,...(choice?.shareAudio&&request.audioRequested?{audio:'loopback'}:{})});
  }catch{finish({})}finally{onPicking(false)}
 };
}
module.exports={makeScreenShareHandler,sourceLabel};
