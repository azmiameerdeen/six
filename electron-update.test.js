const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseVersion,pickUpdate,checkForUpdate}=require('./electron-update');
const asset=v=>({name:'electron-v'+v+'+wvcus-linux-x64.zip',digest:'sha256:'+'a'.repeat(64)});
const rel=(v,extra={})=>({tag_name:'v'+v+'+wvcus',draft:false,prerelease:false,assets:[asset(v)],...extra});
test('versions are read from plain and castlabs strings',()=>{
 assert.deepEqual(parseVersion('44.10.1+wvcus'),[44,10,1]);assert.deepEqual(parseVersion('44.9.3'),[44,9,3]);
 assert.equal(parseVersion('nonsense'),null);assert.equal(parseVersion(undefined),null);
});
test('offers the newest stable release of the same major version only',()=>{
 const releases=[rel('46.0.0',{prerelease:true}),rel('45.2.1'),rel('44.10.3'),rel('44.10.2'),rel('44.10.1'),rel('44.9.3'),rel('43.8.6')];
 assert.deepEqual(pickUpdate(releases,'44.10.1+wvcus'),{version:'44.10.3'});
 assert.equal(pickUpdate(releases,'44.10.3+wvcus'),null);   // already newest
 assert.equal(pickUpdate(releases,'44.12.0+wvcus'),null);   // running newer than anything listed
});
test('ignores drafts, prereleases, odd tags and builds without a published checksum',()=>{
 const releases=[rel('44.11.0',{draft:true}),rel('44.11.1',{prerelease:true}),{...rel('44.11.2'),tag_name:'v44.11.2-alpha.1+wvcus'},
  rel('44.11.3',{assets:[{name:'electron-v44.11.3+wvcus-linux-x64.zip'}]}),rel('44.11.4',{assets:[asset('44.11.5')]}),rel('44.10.2')];
 assert.deepEqual(pickUpdate(releases,'44.10.1'),{version:'44.10.2'});
 assert.equal(pickUpdate(null,'44.10.1'),null);assert.equal(pickUpdate([rel('44.10.2')],'garbage'),null);
});
test('a failed or offline request means no update, not an error',async()=>{
 assert.equal(await checkForUpdate('44.10.1',async()=>({ok:false})),null);
 assert.deepEqual(await checkForUpdate('44.10.1',async()=>({ok:true,json:async()=>[rel('44.10.2')]})),{version:'44.10.2'});
 await assert.rejects(checkForUpdate('44.10.1',async()=>{throw new Error('offline')}));
});
