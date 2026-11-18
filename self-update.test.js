const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {stageUpdate,pruneOldVersions,readBad}=require('./self-update');
const URL='https://github.com/castlabs/electron-releases/releases/download/v44.10.2%2Bwvcus/electron-v44.10.2+wvcus-linux-x64.zip';
const ZIP=Buffer.from('pretend this is a zip');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const dir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'six-self-'));
const fetchOf=(bytes,ok=true)=>async()=>({ok,status:ok?200:500,body:new Response(bytes).body});
const unzipTo=(version='44.10.2+wvcus',withBinary=true)=>async(_zip,dest)=>{
 fs.writeFileSync(path.join(dest,'version'),version+'\n');
 if(withBinary){fs.writeFileSync(path.join(dest,'electron'),'#!/bin/sh\n');fs.chmodSync(path.join(dest,'electron'),0o755)}
};
const base=(over={})=>({update:{version:'44.10.2',url:URL,sha256:sha(ZIP)},fetchImpl:fetchOf(ZIP),unzip:unzipTo(),smoke:async()=>{},...over});
test('a good download is unpacked and staged for the next start',async()=>{
 const d=dir();assert.equal(await stageUpdate({electronDir:d,...base()}),true);
 assert.ok(fs.existsSync(path.join(d,'44.10.2','electron')));assert.equal(fs.readFileSync(path.join(d,'pending'),'utf8').trim(),'44.10.2');
 assert.deepEqual(fs.readdirSync(d).sort(),['44.10.2','pending']); // no staging leftovers
 assert.equal(await stageUpdate({electronDir:d,...base()}),false);  // already staged
});
test('nothing is installed when the checksum does not match',async()=>{
 const d=dir();await assert.rejects(stageUpdate({electronDir:d,...base({fetchImpl:fetchOf(Buffer.from('tampered'))})}),/checksum/);
 assert.deepEqual(fs.readdirSync(d),[]);
});
test('refuses odd versions, other download addresses and bad checksums before downloading',async()=>{
 const d=dir();let called=false;const fetchImpl=async()=>{called=true;return fetchOf(ZIP)()};
 for(const update of [{version:'44.10',url:URL,sha256:sha(ZIP)},{version:'44.10.2',url:'https://evil.example/e.zip',sha256:sha(ZIP)},{version:'44.10.2',url:URL,sha256:'abc'},{version:'../x',url:URL,sha256:sha(ZIP)}])
  await assert.rejects(stageUpdate({electronDir:d,...base({update,fetchImpl})}));
 assert.equal(called,false);
});
test('refuses a build that reports another version, lacks the binary, fails the smoke test or fails to download',async()=>{
 for(const over of [{unzip:unzipTo('44.9.9+wvcus')},{unzip:unzipTo('44.10.2+wvcus',false)},{smoke:async()=>{throw new Error('does not run')}},{fetchImpl:fetchOf(ZIP,false)}]){
  const d=dir();await assert.rejects(stageUpdate({electronDir:d,...base(over)}));assert.deepEqual(fs.readdirSync(d),[]);
 }
});
test('old builds are removed but the current, previous and staged ones stay',()=>{
 const d=dir();for(const v of ['44.9.1','44.9.2','44.9.3','44.10.1','44.10.2'])fs.mkdirSync(path.join(d,v));
 fs.symlinkSync('44.10.1',path.join(d,'current'));fs.writeFileSync(path.join(d,'previous'),'44.9.3\n');fs.writeFileSync(path.join(d,'pending'),'44.10.2\n');
 pruneOldVersions(d);assert.deepEqual(fs.readdirSync(d).filter(n=>/^\d/.test(n)).sort(),['44.10.1','44.10.2','44.9.3']);
});
test('versions listed as bad are read back, ignoring junk',()=>{
 const d=dir();assert.deepEqual(readBad(d),[]);fs.writeFileSync(path.join(d,'bad'),'44.10.3\nnot a version\n\n44.10.4\n');
 assert.deepEqual(readBad(d),['44.10.3','44.10.4']);
});
