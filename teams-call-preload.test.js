const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./teams-call-preload.js'),'utf8');
function setup(){
 const reports=[];
 class Peer extends EventTarget{constructor(){super();this.connectionState='new'}close(){this.connectionState='closed';this.dispatchEvent(new Event('connectionstatechange'))}}
 class Track extends EventTarget{constructor(){super();this.readyState='live';this.enabled=true}stop(){this.readyState='ended'}}
 const track=new Track(),stream={getTracks:()=>[track]};
 const page={RTCPeerConnection:Peer,navigator:{mediaDevices:{getUserMedia:async()=>stream}},location:{protocol:'https:',hostname:'teams.microsoft.com'}};page.window=page;
 const context=vm.createContext(page);
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>{page[name]=value},executeInMainWorld:({func})=>vm.runInContext('('+func.toString()+')()',context)},ipcRenderer:{send:(_channel,status)=>reports.push({...status})}};
 vm.runInNewContext(source,{require:()=>electron,location:page.location});
 return {page,track,reports,last:()=>reports.at(-1)};
}
test('silent, connecting and reconnecting calls remain active until closed',()=>{
 const m=setup();assert.deepEqual(m.last(),{active:false,ready:true});
 const pc=new m.page.RTCPeerConnection();assert.equal(m.last().active,true);
 pc.connectionState='disconnected';pc.dispatchEvent(new Event('connectionstatechange'));assert.equal(m.last().active,true);
 pc.close();assert.equal(m.last().active,false);
});
test('muted live microphone protects call until track stops',async()=>{
 const m=setup();await m.page.navigator.mediaDevices.getUserMedia({audio:true});assert.equal(m.last().active,true);
 m.track.enabled=false;assert.equal(m.last().active,true);
 m.track.stop();assert.equal(m.last().active,false);
});
test('camera activity and peer call are independent protections',async()=>{
 const m=setup();const pc=new m.page.RTCPeerConnection();await m.page.navigator.mediaDevices.getUserMedia({video:true});
 pc.close();assert.equal(m.last().active,true);m.track.stop();assert.equal(m.last().active,false);
});
test('sleep policy skips active silent calls, permits idle tabs after timeout',()=>{
 const {sleepCandidates,hibernateAfter}=require('./policy');
 assert.deepEqual(sleepCandidates([{id:'teams',lastActive:0,callActive:true,audible:false}], 'whatsapp',hibernateAfter*2),[]);
 assert.deepEqual(sleepCandidates([{id:'teams',lastActive:hibernateAfter,callActive:false,audible:false}], 'whatsapp',hibernateAfter*2),['teams']);
});
