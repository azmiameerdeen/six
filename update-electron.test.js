const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const script=path.join(__dirname,'update-electron.sh');
function fixture(current,previous){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'six-update-'));
 fs.mkdirSync(path.join(dir,'node_modules/electron/dist'),{recursive:true});
 fs.writeFileSync(path.join(dir,'node_modules/electron/dist/version'),current+'\n');
 if(previous){fs.mkdirSync(path.join(dir,'.electron-previous'));fs.writeFileSync(path.join(dir,'.electron-previous/version'),previous+'\n')}
 return dir;
}
const run=(dir,...args)=>spawnSync('bash',[script,'--dry-run',...args],{env:{...process.env,SIX_DIR:dir},encoding:'utf8'});
test('accepts a newer version in the same major line',()=>{
 const r=run(fixture('44.10.1+wvcus'),'44.10.2');assert.equal(r.status,0);assert.match(r.stdout,/would update 44\.10\.1 to 44\.10\.2/);
 assert.equal(run(fixture('44.9.3+wvcus'),'44.10.0').status,0); // 10 sorts above 9
});
test('refuses same, older and different-major versions',()=>{
 const dir=fixture('44.10.1+wvcus');
 for(const v of ['44.10.1','44.9.9','45.0.0','43.9.9'])assert.notEqual(run(dir,v).status,0,v);
});
test('refuses anything that is not a plain version number',()=>{
 const dir=fixture('44.10.1+wvcus');
 for(const v of ['44.10.2; touch /tmp/x','../44.10.2','44.10','44.10.2+wvcus','','$(id)'])assert.notEqual(run(dir,v).status,0,JSON.stringify(v));
});
test('rollback needs a previous Electron',()=>{
 assert.notEqual(run(fixture('44.10.1+wvcus'),'rollback').status,0);
 const r=run(fixture('44.10.2+wvcus','44.10.1+wvcus'),'rollback');assert.equal(r.status,0);assert.match(r.stdout,/roll back 44\.10\.2 to 44\.10\.1/);
});
test('a real run needs a version or rollback, and root paths are fixed',()=>{
 const r=spawnSync('bash',[script],{encoding:'utf8'});assert.notEqual(r.status,0);
 assert.match(fs.readFileSync(script,'utf8'),/else SIX_DIR=\/opt\/six-messenger; fi/);
});
