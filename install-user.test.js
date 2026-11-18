const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function setup(version='44.10.1'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'six-inst-')),src=path.join(root,'src'),home=path.join(root,'home');
 fs.mkdirSync(path.join(src,'icons'),{recursive:true});fs.mkdirSync(path.join(src,'node_modules/electron/dist'),{recursive:true});
 for(const f of ['install-user.sh','six-launcher.sh'])fs.copyFileSync(path.join(__dirname,f),path.join(src,f));
 fs.writeFileSync(path.join(src,'main.js'),'//app');fs.writeFileSync(path.join(src,'main.test.js'),'//test');fs.writeFileSync(path.join(src,'package.json'),'{}');
 fs.writeFileSync(path.join(src,'icon.png'),'png');fs.writeFileSync(path.join(src,'icons/a.png'),'png');
 fs.writeFileSync(path.join(src,'node_modules/electron/dist/version'),version+'+wvcus\n');
 fs.writeFileSync(path.join(src,'node_modules/electron/dist/electron'),'#!/bin/sh\n');fs.chmodSync(path.join(src,'node_modules/electron/dist/electron'),0o755);
 const menu=path.join(home,'.local/share/applications/six-messenger.desktop'),auto=path.join(home,'.config/autostart/six-messenger.desktop');
 fs.mkdirSync(path.dirname(menu),{recursive:true});fs.mkdirSync(path.dirname(auto),{recursive:true});
 fs.writeFileSync(menu,'[Desktop Entry]\nName=Six\nExec=/opt/six-messenger/electron /opt/six-messenger\nIcon=/opt/six-messenger/icon.png\n');
 fs.writeFileSync(auto,'[Desktop Entry]\nName=Six\nExec=/opt/six-messenger/electron /opt/six-messenger --start-hidden\nIcon=/opt/six-messenger/icon.png\n');
 const run=(...args)=>spawnSync('bash',[path.join(src,'install-user.sh'),...args],{env:{...process.env,HOME:home,SIX_SKIP_APPARMOR_CHECK:'1'},encoding:'utf8'});
 return {src,home,menu,auto,run,base:path.join(home,'.local/share/six')};
}
test('copies Six, Electron and the launcher, but leaves the menu alone without --switch',()=>{
 const t=setup();const r=t.run();assert.equal(r.status,0,r.stderr);
 assert.ok(fs.existsSync(path.join(t.base,'app/main.js')));assert.equal(fs.existsSync(path.join(t.base,'app/main.test.js')),false);assert.ok(fs.existsSync(path.join(t.base,'app/icons/a.png')));
 assert.equal(fs.readlinkSync(path.join(t.base,'electron/current')),'44.10.1');assert.ok(fs.existsSync(path.join(t.base,'electron/44.10.1/electron')));
 assert.ok(fs.statSync(path.join(t.home,'.local/bin/six')).mode&0o100);assert.match(fs.readFileSync(t.menu,'utf8'),/Exec=\/opt\//);
});
test('--switch points menu and autostart at the launcher, --revert restores them',()=>{
 const t=setup();assert.equal(t.run('--switch').status,0);
 const menu=fs.readFileSync(t.menu,'utf8'),auto=fs.readFileSync(t.auto,'utf8');
 assert.match(menu,new RegExp('Exec='+path.join(t.home,'.local/bin/six')+'\\n'));assert.match(auto,/six --start-hidden\n/);assert.match(menu,/Icon=.*\.local\/share\/six\/app\/icon\.png/);
 assert.equal(t.run('--revert').status,0);assert.match(fs.readFileSync(t.menu,'utf8'),/Exec=\/opt\/six-messenger\/electron/);assert.match(fs.readFileSync(t.auto,'utf8'),/--start-hidden/);
});
test('never moves Electron backwards when Six has already updated itself',()=>{
 const t=setup('44.10.1');assert.equal(t.run().status,0);
 fs.mkdirSync(path.join(t.base,'electron/44.10.5'));fs.rmSync(path.join(t.base,'electron/current'));fs.symlinkSync('44.10.5',path.join(t.base,'electron/current'));
 assert.equal(t.run().status,0);assert.equal(fs.readlinkSync(path.join(t.base,'electron/current')),'44.10.5');
});
test('refuses to run without the AppArmor rule',()=>{
 const t=setup();const r=spawnSync('bash',[path.join(t.src,'install-user.sh')],{env:{...process.env,HOME:t.home,SIX_SKIP_APPARMOR_CHECK:''},encoding:'utf8'});
 if(!fs.existsSync('/etc/apparmor.d/six-electron')){assert.notEqual(r.status,0);assert.match(r.stderr,/setup-apparmor/)}
});
test('on a fresh machine --switch creates the app-menu entry, and does not create an autostart one',()=>{
 const t=setup();fs.rmSync(t.menu);fs.rmSync(t.auto);
 const r=t.run('--switch');assert.equal(r.status,0,r.stderr);
 const menu=fs.readFileSync(t.menu,'utf8');
 assert.match(menu,new RegExp('Exec='+path.join(t.home,'.local/bin/six')+'\n'));assert.match(menu,/Name=Six/);assert.match(menu,/StartupWMClass=six-messenger/);
 assert.equal(fs.existsSync(t.menu+'.opt-backup'),false);assert.equal(fs.existsSync(t.auto),false);
 assert.equal(t.run('--revert').status,0);
});
