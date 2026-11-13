const {app,BrowserWindow,WebContentsView,ipcMain,shell,dialog,Tray,Menu,nativeImage,session}=require('electron');
const {notificationsAllowed,audioMuted,browserUserAgent,popupAllowed}=require('./notification-policy');
const {teamsMediaAllowed}=require('./media-policy');
const {jumpTelegramLatest}=require('./telegram-latest');
const path=require('node:path'),fs=require('node:fs');
const {services,sleepCandidates,safeURL,alwaysAwake}=require('./policy');
app.setName('Six Test');app.setPath('userData','/tmp/six-telegram-latest-test');
if(!app.requestSingleInstanceLock()){app.quit()}else{
let win,tray,active=null,quitting=false,settings={},shutdownFlushing=false,shutdownSaved=false,sessions=new Set(),views=new Map(),popups=new Map();
function save(){fs.writeFileSync(path.join(app.getPath('userData'),'settings.json'),JSON.stringify(settings))}
function state(){if(!win||win.isDestroyed())return;win.webContents.send('state',{active,quiet:!!settings._quiet,muteAll:!!settings._muteAll,services:services.map(s=>({...s,loaded:views.has(s.id),sleeping:!!views.get(s.id)?.sleeping,notifications:notificationsAllowed(settings,s.id),muted:audioMuted(settings,s.id),keepAlive:alwaysAwake.has(s.id)||!!settings[s.id],alwaysAwake:alwaysAwake.has(s.id),title:views.get(s.id)?.view.webContents.getTitle()||''})),memory:Math.round(app.getAppMetrics().reduce((a,p)=>a+p.memory.workingSetSize,0)/1024)})}
function layout(){const e=views.get(active);if(e){const [w,h]=win.getContentSize();e.view.setBounds({x:0,y:48,width:w,height:h-48})}}
function release(id){const e=views.get(id);if(!e)return;e.view.webContents.session.flushStorageData();views.delete(id);if(e.attached)win.contentView.removeChildView(e.view);e.view.webContents.close({waitForBeforeUnload:false})}
// Freeze page timers without destroying its renderer or in-memory state.
function setSleeping(id,sleeping){
 const e=views.get(id);if(!e)return Promise.resolve();
 e.lifecycle=(e.lifecycle||Promise.resolve()).then(async()=>{
  const wc=e.view.webContents;
  if(quitting||views.get(id)!==e||wc.isDestroyed())return;
  if(sleeping&&(id===active||alwaysAwake.has(id)||settings[id]||wc.isCurrentlyAudible()||wc.isLoading()||[...popups.values()].includes(id)))return;
  if(!!e.sleeping===sleeping)return;
  if(!wc.debugger.isAttached()){wc.debugger.attach('1.3');e.lifecycleDebugger=true}
  if(!e.lifecycleDebugger)return; // Leave a user-opened developer session alone.
  await wc.debugger.sendCommand('Page.setWebLifecycleState',{state:sleeping?'frozen':'active'});
  e.sleeping=sleeping;
  if(!sleeping&&e.lifecycleDebugger){wc.debugger.detach();e.lifecycleDebugger=false}
  state();
 }).catch(()=>{if(!e.view.webContents.isDestroyed())console.warn('Six: could not change '+id+' sleep state')});
 return e.lifecycle;
}
function external(url){if(safeURL(url))shell.openExternal(url)}
function focusService(){const e=views.get(active);if(e&&!e.view.webContents.isDestroyed())e.view.webContents.focus()}
function refreshControls(){
 for(const [id,e] of views)e.view.webContents.setAudioMuted(audioMuted(settings,id));
 for(const [popup,id] of popups)if(!popup.isDestroyed())popup.webContents.setAudioMuted(audioMuted(settings,id));
 if(tray)tray.setContextMenu(Menu.buildFromTemplate([
 {label:'Open Six',click:()=>{win.show();win.focus();focusService()}},
 {label:'Pause all notifications',type:'checkbox',checked:!!settings._quiet,click:()=>{settings._quiet=!settings._quiet;save();refreshControls();state()}},
 {label:'Mute all audio',type:'checkbox',checked:!!settings._muteAll,click:()=>{settings._muteAll=!settings._muteAll;save();refreshControls();state()}},
 {type:'separator'},{label:'Quit Six',click:()=>{quitting=true;app.quit()}}]));
}
function configureContents(wc,s,ses){
 // Website content must never act as window chrome.
 wc.on('dom-ready',()=>wc.insertCSS('html,body,*{-webkit-app-region:no-drag!important;app-region:no-drag!important}').catch(()=>{}));
 wc.on('unresponsive',()=>console.warn('Six: '+s.id+' renderer unresponsive'));

 wc.setUserAgent(browserUserAgent(wc.getUserAgent()));
 wc.setAudioMuted(audioMuted(settings,s.id));
 wc.setWindowOpenHandler(({url})=>{
  if(popupAllowed(url,wc.getURL()))return {action:'allow',overrideBrowserWindowOptions:{parent:win,autoHideMenuBar:true,webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true}}};
  if(safeURL(url))external(url);
  return {action:'deny'};
 });
 wc.on('did-create-window',popup=>{
  popups.set(popup,s.id);configureContents(popup.webContents,s,ses);
  popup.on('closed',()=>{popups.delete(popup);if(!quitting){win.show();win.focus();focusService()}});
 });
 wc.on('will-navigate',(event,url)=>{if(!safeURL(url)&&url!=='about:blank')event.preventDefault()});
}
function make(s){
 const ses=session.fromPartition('persist:six-'+s.id);
 sessions.add(ses);
 ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
 ses.setPermissionCheckHandler((_wc,permission,origin,details)=>{
  if(teamsMediaAllowed(s.id,permission,details?.securityOrigin||origin))return true;
  return permission==='notifications'&&notificationsAllowed(settings,s.id);
 });
 ses.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
  if(teamsMediaAllowed(s.id,permission,details.requestingUrl||wc?.getURL()))return callback(true);
  if(permission==='notifications')return callback(notificationsAllowed(settings,s.id));
  if(permission==='media'){
   const result=await dialog.showMessageBox(win,{type:'question',buttons:['Deny','Allow'],defaultId:0,cancelId:0,message:s.name+' requests microphone / camera access',detail:'Origin: '+(details.requestingUrl||wc.getURL())});callback(result.response===1);
  }else callback(false);
 });
 const view=new WebContentsView({webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true,webSecurity:true}}),wc=view.webContents;
 configureContents(wc,s,ses);
 wc.on('page-title-updated',state);
 wc.on('render-process-gone',()=>{release(s.id);if(active===s.id)active=null;state()});
 view.setVisible(false);
 const e={view,lastActive:Date.now(),attached:false,sleeping:false};views.set(s.id,e);wc.loadURL(s.url).catch(()=>{});return e;
}
function detach(){const e=views.get(active);if(e){e.lastActive=Date.now();win.contentView.removeChildView(e.view);e.attached=false;e.view.setVisible(false)}}
function select(id){const s=services.find(s=>s.id===id);if(!s)return;detach();active=id;const e=views.get(id)||make(s);e.lastActive=Date.now();win.contentView.addChildView(e.view);e.attached=true;e.view.setVisible(true);layout();setSleeping(id,false).then(()=>{if(active===id&&!e.view.webContents.isDestroyed())e.view.webContents.focus()});state()}
app.on('second-instance',()=>{win?.show();win?.focus()});
app.whenReady().then(()=>{
 try{settings=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'settings.json'),'utf8'))}catch{}
 if(!settings._teamsMediaDefaultsV1){settings._muted??={};settings._muted.teams=false;settings._teamsMediaDefaultsV1=true;save()}
 win=new BrowserWindow({width:1280,height:840,minWidth:850,minHeight:580,title:'Six',show:!process.argv.includes('--start-hidden'),frame:false,backgroundColor:'#11171b',icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.setMenuBarVisibility(false);win.loadFile('index.html');win.on('resize',layout);win.on('focus',focusService);win.webContents.on('did-finish-load',state);
 win.webContents.once('did-finish-load',()=>{
  select(services[0].id);
  services.slice(1).forEach((s,i)=>setTimeout(()=>{if(!quitting&&!views.has(s.id)){make(s);state()}},(i+1)*800).unref());
 });
 win.on('close',e=>{if(!quitting){e.preventDefault();win.hide()}});
 tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:24,height:24}));tray.setToolTip('Six');refreshControls();tray.on('click',()=>{win.show();win.focus();focusService()});
 ipcMain.handle('action',(event,{action,id}={})=>{
  if(event.sender!==win.webContents)return;
  const s=services.find(s=>s.id===(id||active));
  if(action==='notifications'&&s){settings._notifications??={};settings._notifications[s.id]=!notificationsAllowed({...settings,_quiet:false},s.id);save();refreshControls()}
  if(action==='mute'&&s){settings._muted??={};settings._muted[s.id]=!settings._muted[s.id];save();refreshControls()}
  if(action==='quiet'){settings._quiet=!settings._quiet;save();refreshControls()}
  if(action==='minimize')win.minimize();
  if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize()}
  if(action==='close')win.close();
  if(action==='select'&&s)select(id);
  if(action==='pin'&&s&&!alwaysAwake.has(id)){settings[id]=!settings[id];save();if(settings[id])setSleeping(id,false)}
  if(action==='sleep'&&s&&id!==active&&!alwaysAwake.has(id))setSleeping(id,true);
  if(action==='latest'&&active==='telegram'){const wc=views.get(active)?.view.webContents;if(wc)wc.executeJavaScript('('+jumpTelegramLatest.toString()+')()',true).catch(()=>{})}
  if(action==='reload'&&active)views.get(active)?.view.webContents.reload();
  if(action==='back'&&active){const wc=views.get(active)?.view.webContents;if(wc?.navigationHistory.canGoBack())wc.navigationHistory.goBack()}
  if(action==='external'&&active)external(views.get(active)?.view.webContents.getURL());
  if(action==='home'){detach();active=null}
  state();
 });
 setInterval(()=>{const entries=[...views].map(([id,e])=>({id,lastActive:e.lastActive,keepAlive:!!settings[id]||[...popups.values()].includes(id),audible:e.view.webContents.isCurrentlyAudible()}));for(const id of sleepCandidates(entries,active,Date.now()))setSleeping(id,true);state()},15000).unref();
});
process.on('SIGTERM',()=>{quitting=true;app.quit()});
app.on('before-quit',event=>{
 quitting=true;
 if(shutdownSaved)return;
 event.preventDefault();
 if(shutdownFlushing)return;
 shutdownFlushing=true;
 Promise.allSettled([...sessions].map(async ses=>{ses.flushStorageData();await ses.cookies.flushStore()})).then(results=>{
  if(results.some(r=>r.status==='rejected'))console.warn('Six: a session storage flush failed');
  for(const id of [...views.keys()])release(id);
  shutdownSaved=true;app.quit();
 });
});
app.whenReady().then(()=>{
for(const service of services)session.fromPartition('persist:six-'+service.id).protocol.handle('https',()=>new Response('<!doctype html><div id="side" style="height:80px;overflow:auto"><div style="height:1200px"></div></div><div id="MiddleColumn"><div class="MessageList" style="height:200px;overflow:auto"><div style="height:1800px">Test messages</div></div><input id="draft" value="unsent dummy draft"></div>',{headers:{'content-type':'text/html'}}));
setTimeout(async()=>{try{
 const assert=require('node:assert/strict');select('telegram');const wc=views.get('telegram').view.webContents;
 if(wc.isLoading())await new Promise(r=>wc.once('did-finish-load',r));
 assert.equal(await win.webContents.executeJavaScript("document.querySelector('#latest').hidden"),false);
 assert.equal(await wc.executeJavaScript('('+jumpTelegramLatest.toString()+')()',true),true);
 const result=await wc.executeJavaScript("({bottom:document.querySelector('.MessageList').scrollTop+200>=document.querySelector('.MessageList').scrollHeight-1,side:document.querySelector('#side').scrollTop,draft:document.querySelector('#draft').value})");
 assert.equal(result.bottom,true);assert.equal(result.side,0);assert.equal(result.draft,'unsent dummy draft');
 await wc.executeJavaScript("const button=document.createElement('button');button.innerHTML='<i class=icon-arrow-down></i>';button.onclick=()=>window.nativeClicks=(window.nativeClicks||0)+1;document.querySelector('#MiddleColumn').append(button)");
 await wc.executeJavaScript('('+jumpTelegramLatest.toString()+')()',true);assert.equal(await wc.executeJavaScript('window.nativeClicks'),1);
 select('whatsapp');assert.equal(await win.webContents.executeJavaScript("document.querySelector('#latest').hidden"),true);
 console.log('PASS: Latest button visible only on Telegram; native action invoked; fallback scrolls chat to bottom without moving chat list or touching draft');
}catch(e){console.error(e);process.exitCode=1}finally{quitting=true;app.quit()}},5000);
});

}
