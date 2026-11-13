const {test}=require('node:test'),assert=require('node:assert/strict');
// Load the preload with a stub Electron, outside any YouTube page, to get the shield function.
const Module=require('node:module'),load=Module._load;
Module._load=function(req,...a){return req==='electron'?{contextBridge:{executeInMainWorld(){throw new Error('must not run outside YouTube')}}}:load.call(this,req,...a)};
const {ytAdShield}=require('./ytmusic-preload');Module._load=load;
test('ad slots are removed from player data, music data is kept',()=>{
 const realParse=JSON.parse;
 try{
  globalThis.window=globalThis;
  const strip=ytAdShield();
  const data=JSON.parse('{"adPlacements":[1],"playerAds":[2],"adSlots":[3],"streamingData":{"formats":[1]},"playerResponse":{"adPlacements":[4],"videoDetails":{"title":"x"}}}');
  assert.equal('adPlacements' in data,false);assert.equal('playerAds' in data,false);assert.equal('adSlots' in data,false);
  assert.deepEqual(data.streamingData,{formats:[1]});
  assert.equal('adPlacements' in data.playerResponse,false);assert.equal(data.playerResponse.videoDetails.title,'x');
  window.ytInitialPlayerResponse={adPlacements:[1],videoDetails:{}};
  assert.equal('adPlacements' in window.ytInitialPlayerResponse,false);
  assert.equal(strip(null),null);assert.equal(JSON.parse('5'),5);
 }finally{JSON.parse=realParse;delete globalThis.ytInitialPlayerResponse}
});
