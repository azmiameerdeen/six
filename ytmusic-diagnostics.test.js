const {test,mock}=require('node:test'),assert=require('node:assert/strict');
const Module=require('node:module'),load=Module._load;
Module._load=function(req,...a){return req==='electron'?{contextBridge:{executeInMainWorld(){throw new Error('must not run outside YouTube')}},ipcRenderer:{}}:load.call(this,req,...a)};
const {ytDiagnostics}=require('./ytmusic-preload');Module._load=load;
class FakeMedia{constructor(o={}){Object.assign(this,{currentTime:61.4,duration:200,ended:false,readyState:4,muted:false},o)}}
function page({prompt=null,ad=false}={}){
 const lines=[],handlers={},actions={};
 globalThis.window=globalThis;globalThis.HTMLMediaElement=FakeMedia;
 globalThis.__sixDiag={log:l=>lines.push(JSON.parse(l))};
 globalThis.document={visibilityState:'hidden',addEventListener:(t,h)=>{(handlers[t]??=[]).push(h)},
  querySelector:sel=>sel==='.ad-showing'?(ad?{}:null):sel==='ytmusic-you-there-renderer'?prompt:null};
 globalThis.navigator={mediaSession:{setActionHandler:(a,h)=>{actions[a]=h}}};
 return {lines,fire:(t,target)=>handlers[t]?.forEach(h=>h({target})),actions};
}
const cleanup=()=>{for(const k of ['window','HTMLMediaElement','__sixDiag','document','navigator'])delete globalThis[k]};
test('a pause is logged with the state of the player, and who caused it',()=>{
 mock.timers.enable({apis:['setInterval']});const p=page();try{
  ytDiagnostics();p.fire('pause',new FakeMedia());
  assert.deepEqual({...p.lines[0]},{what:'pause',vis:'hidden',time:61,of:200,ended:false,ready:4,muted:false,ad:false,youThere:false,byUser:false});
  p.fire('pointerdown');p.fire('pause',new FakeMedia());assert.equal(p.lines[1].byUser,true);
  p.fire('ended',new FakeMedia({ended:true}));p.fire('error',new FakeMedia());assert.deepEqual(p.lines.map(l=>l.what),['pause','pause','ended','error']);
  p.fire('pause',{});assert.equal(p.lines.length,4); // not a media element
 }finally{mock.timers.reset();cleanup()}
});
test('a pause requested by a media key or headset is logged and still handled',()=>{
 mock.timers.enable({apis:['setInterval']});const p=page();try{
  ytDiagnostics();let handled=0;
  navigator.mediaSession.setActionHandler('pause',()=>{handled++});navigator.mediaSession.setActionHandler('play',()=>{});
  p.actions.pause();assert.equal(handled,1);assert.equal(p.lines.at(-1).what,'media control asked to pause');assert.equal(typeof p.actions.play,'function');
 }finally{mock.timers.reset();cleanup()}
});
test('the Continue watching prompt is answered once, and only with a matching button',()=>{
 mock.timers.enable({apis:['setInterval']});
 try{
  let clicks=0;const yes={textContent:' Yes ',getAttribute:()=>null,click:()=>clicks++},no={textContent:'Settings',getAttribute:()=>null,click:()=>assert.fail('wrong button')};
  const prompt={querySelectorAll:()=>[no,yes]};
  const p=page({prompt});ytDiagnostics();
  mock.timers.tick(4000);mock.timers.tick(4000);
  assert.equal(clicks,2);assert.equal(p.lines.filter(l=>l.what==='answered the Continue watching prompt').length,1);
 }finally{mock.timers.reset();cleanup()}
 mock.timers.enable({apis:['setInterval']});
 try{
  const p=page({prompt:{querySelectorAll:()=>[{textContent:'Settings',getAttribute:()=>null,click:()=>assert.fail('wrong button')}]}});ytDiagnostics();
  mock.timers.tick(4000);assert.equal(p.lines[0].what,'Continue watching prompt shown, no button found');
 }finally{mock.timers.reset();cleanup()}
});
