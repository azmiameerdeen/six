const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const launcher=path.join(__dirname,'six-launcher.sh');
// A fake Electron per version: logs how it was started and exits with the code in its 'exitcode' file.
function fixture(versions,current){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'six-home-'));const el=path.join(home,'electron');
 fs.mkdirSync(path.join(home,'app'));
 for(const [v,code] of Object.entries(versions)){
  fs.mkdirSync(path.join(el,v),{recursive:true});
  fs.writeFileSync(path.join(el,v,'electron'),'#!/bin/sh\necho "'+v+' $@" >> "'+home+'/log"\nexit '+code+'\n');fs.chmodSync(path.join(el,v,'electron'),0o755);
 }
 if(current)fs.symlinkSync(current,path.join(el,'current'));
 return {home,el,log:()=>fs.existsSync(home+'/log')?fs.readFileSync(home+'/log','utf8').trim().split('\n'):[],read:f=>fs.readFileSync(path.join(el,f),'utf8').trim()};
}
const start=(f,...args)=>spawnSync('bash',[launcher,...args],{env:{...process.env,SIX_HOME:f.home},encoding:'utf8'});
test('starts the current Electron with Six\'s app folder and passes arguments and the exit code through',()=>{
 const f=fixture({'44.10.1':0,},'44.10.1');const r=start(f,'--start-hidden');
 assert.equal(r.status,0);assert.deepEqual(f.log(),['44.10.1 '+path.join(f.home,'app')+' --start-hidden']);
 const g=fixture({'44.10.1':3},'44.10.1');assert.equal(start(g).status,3);
});
test('a staged update is switched in at start-up, remembered as previous and put on trial',()=>{
 const f=fixture({'44.10.1':0,'44.10.2':0},'44.10.1');fs.writeFileSync(path.join(f.el,'pending'),'44.10.2\n');
 const r=start(f);assert.equal(r.status,0);
 assert.equal(fs.readlinkSync(path.join(f.el,'current')),'44.10.2');assert.equal(f.read('previous'),'44.10.1');assert.equal(f.read('trial'),'44.10.2');
 assert.equal(fs.existsSync(path.join(f.el,'pending')),false);assert.match(f.log()[0],/^44\.10\.2 /);
});
test('a new Electron that crashes on trial is rolled back, remembered as bad, and the old one is started instead',()=>{
 const f=fixture({'44.10.1':0,'44.10.2':133},'44.10.1');fs.writeFileSync(path.join(f.el,'pending'),'44.10.2\n');
 const r=start(f,'--start-hidden');assert.equal(r.status,0);
 assert.deepEqual(f.log().map(l=>l.split(' ')[0]),['44.10.2','44.10.1']);assert.match(f.log()[1],/--start-hidden$/);
 assert.equal(fs.readlinkSync(path.join(f.el,'current')),'44.10.1');assert.equal(f.read('bad'),'44.10.2');assert.equal(fs.existsSync(path.join(f.el,'trial')),false);
 assert.match(r.stderr,/going back to 44\.10\.1/);
});
test('a crash that is not on trial is not rolled back; a clean exit on trial keeps the new build',()=>{
 const f=fixture({'44.10.1':9,'44.10.0':0},'44.10.1');fs.writeFileSync(path.join(f.el,'previous'),'44.10.0\n');
 assert.equal(start(f).status,9);assert.equal(fs.readlinkSync(path.join(f.el,'current')),'44.10.1');assert.equal(f.log().length,1);
 const g=fixture({'44.10.1':0,'44.10.2':0},'44.10.1');fs.writeFileSync(path.join(g.el,'pending'),'44.10.2\n');start(g);start(g);
 assert.equal(fs.readlinkSync(path.join(g.el,'current')),'44.10.2');assert.equal(g.read('trial'),'44.10.2'); // still waiting for Six to confirm it
});
test('junk or missing staged builds are ignored',()=>{
 for(const value of ['../etc','44.10.9','44.10.2; rm -rf x']){
  const f=fixture({'44.10.1':0},'44.10.1');fs.writeFileSync(path.join(f.el,'pending'),value+'\n');
  assert.equal(start(f).status,0);assert.equal(fs.readlinkSync(path.join(f.el,'current')),'44.10.1');assert.equal(fs.existsSync(path.join(f.el,'trial')),false);
 }
 const none=fixture({});assert.notEqual(start(none).status,0);
});
