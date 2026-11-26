const services=[['discord','Discord','https://discord.com/app','#939cff','D'],['whatsapp','WhatsApp','https://web.whatsapp.com','#68dba4','W'],['threads','Threads','https://www.threads.com','#eee9e1','@'],['teams','Teams','https://teams.microsoft.com/v2/','#b3a2ff','T'],['telegram','Telegram','https://web.telegram.org/a/','#72cafa','↗'],['ytmusic','YouTube Music','https://music.youtube.com','#ff4e45','♪'],['instagram','Instagram','https://www.instagram.com','#e1306c','◎'],['duckai','Duck.ai','https://duck.ai/','#de5833','D']].map(([id,name,url,color,glyph])=>({id,name,url,color,glyph}));
const iconTypes={whatsapp:'webp',telegram:'png',teams:'ico',threads:'ico',discord:'png',ytmusic:'png',instagram:'png',duckai:'png'};
services.forEach(s=>s.icon='icons/'+s.id+'.'+iconTypes[s.id]);
const alwaysAwake=new Set(['whatsapp','telegram']);
const hibernateAfter=5*60*1000;
const order=['whatsapp','telegram','teams','threads','instagram','discord','ytmusic','duckai'];
services.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
const startupServices=services.filter(s=>alwaysAwake.has(s.id));
// Audio has short silent gaps (between songs, while the next track loads), so "audible" also covers recent sound.
const audibleGrace=3*60*1000;
function recentlyAudible(e,now){return !!e.audible||(e.audibleAt>0&&now-e.audibleAt<audibleGrace)}
function sleepCandidates(entries,active,now,delay=hibernateAfter){return entries.filter(e=>e.id!==active&&!alwaysAwake.has(e.id)&&!e.keepAlive&&!e.callActive&&!recentlyAudible(e,now)&&now-e.lastActive>=delay).map(e=>e.id)}
// Frozen pages still hold their memory; close them after a longer idle so the RAM is returned.
const discardAfter=5*60*1000; // closed 10 minutes after last use (5 to pause + 5 more)
function discardCandidates(entries,active,now,delay=discardAfter){return entries.filter(e=>e.sleeping&&e.id!==active&&!alwaysAwake.has(e.id)&&!e.keepAlive&&!e.callActive&&!recentlyAudible(e,now)&&now-(e.sleptAt||0)>=delay).map(e=>e.id)}
// When the system runs short of memory, idle services are paused sooner and closed a minute later
// (3 minutes in all instead of 10). Normal timing returns once memory has recovered. WhatsApp, Telegram,
// pinned services, calls, sound and the service in use are protected exactly as before.
const lowMemoryEnterMB=2048, lowMemoryLeaveMB=2560;
const lowMemoryHibernateAfter=2*60*1000, lowMemoryDiscardAfter=60*1000;
function nextLowMemory(wasLow,availableMB){
 if(!(availableMB>0))return wasLow;                       // unknown: keep the current mode
 return wasLow?availableMB<lowMemoryLeaveMB:availableMB<lowMemoryEnterMB;
}
function idleDelays(lowMemory){return lowMemory?{sleep:lowMemoryHibernateAfter,discard:lowMemoryDiscardAfter}:{sleep:hibernateAfter,discard:discardAfter}}
function safeURL(value){try{return ['https:','http:'].includes(new URL(value).protocol)}catch{return false}}
module.exports={services,startupServices,sleepCandidates,discardCandidates,nextLowMemory,idleDelays,lowMemoryEnterMB,lowMemoryLeaveMB,recentlyAudible,safeURL,alwaysAwake,hibernateAfter,discardAfter,audibleGrace};
