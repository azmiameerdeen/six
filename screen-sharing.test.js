const {test}=require('node:test'),assert=require('node:assert/strict');const {makeScreenShareHandler}=require('./screen-sharing');
const request=()=>({securityOrigin:'https://teams.microsoft.com',frame:{url:'https://teams.microsoft.com/v2/'},videoRequested:true});
const allowed=url=>{try{return new URL(url).origin==='https://teams.microsoft.com'}catch{return false}};
test('only selected source is shared, with no system audio',async()=>{
 const calls=[],states=[],sources=[{id:'screen:1',name:'Screen 1'},{id:'window:2',name:'Editor'}];
 const handler=makeScreenShareHandler({allowed,getSources:async()=>sources,chooseSource:async()=>sources[1].id,onPicking:b=>states.push(b)});
 await handler(request(),r=>calls.push(r));assert.equal(calls.length,1);assert.equal(calls[0].video,sources[1]);assert.equal(calls[0].audio,undefined);assert.deepEqual(states,[true,false]);
});
test('cancel, no sources and capture errors never grant a stream',async()=>{
 for(const mode of ['cancel','empty','error']){const calls=[];const h=makeScreenShareHandler({allowed,getSources:async()=>{if(mode==='error')throw Error('cancelled');return mode==='empty'?[]:[{id:'screen:1'}]},chooseSource:async()=>null});await h(request(),r=>calls.push(r));assert.deepEqual(calls,[{}])}
});
test('untrusted origins and navigated frames cannot receive a screen',async()=>{
 const calls=[];let enumerated=false;
 const h=makeScreenShareHandler({allowed,getSources:async()=>{enumerated=true;return [{id:'s'}]},chooseSource:async()=> 's'});
 await h({...request(),securityOrigin:'https://evil.example'},r=>calls.push(r));assert.equal(enumerated,false);
 await h({...request(),frame:{url:'https://evil.example'}},r=>calls.push(r));assert.deepEqual(calls,[{},{}]);
});
test('system audio included only with explicit choice and requested audio track',async()=>{
 for(const [shareAudio,audioRequested,expected] of [[true,true,'loopback'],[false,true,undefined],[true,false,undefined]]){
  const calls=[];const h=makeScreenShareHandler({allowed,getSources:async()=>[{id:'s'}],chooseSource:async()=>({id:'s',shareAudio})});
  await h({...request(),audioRequested},r=>calls.push(r));assert.equal(calls.length,1);assert.equal(calls[0].audio,expected);
 }
});
test('unnamed portal sources always receive visible labels',()=>{
 const {sourceLabel}=require('./screen-sharing');
 assert.equal(sourceLabel({name:'',id:'screen:0'},0),'Screen 1');
 assert.equal(sourceLabel({name:'  ',id:'window:4'},1),'Window 2');
 assert.equal(sourceLabel({id:'portal-selected'},0),'Selected screen or window 1');
 assert.equal(sourceLabel({name:'Browser & Editor'},0),'Browser && Editor');
});
