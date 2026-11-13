const {components,desktopCapturer,app,BrowserWindow,WebContentsView,ipcMain,shell,dialog,Tray,Menu,nativeImage,session,clipboard}=require('electron');
const {notificationsAllowed,audioMuted,browserUserAgent,popupAllowed}=require('./notification-policy');
const {teamsMediaAllowed,protectedMediaAllowed}=require('./media-policy');
const {jumpTelegramLatest}=require('./telegram-latest');
const {makeScreenShareHandler,sourceLabel}=require('./screen-sharing');
const {updateRenderingPriority}=require('./rendering-priority');
const {layoutServiceView,mountServiceView,hideServiceView,showServiceView}=require('./service-views');
const {contentStyle}=require('./content-style');
const {applyAdblock}=require('./adblock');
const {contextMenuItems}=require('./context-menu');
const path=require('node:path'),fs=require('node:fs');
const {services,startupServices,sleepCandidates,discardCandidates,safeURL,alwaysAwake}=require('./policy');
app.setName('Six');
// Cap each service's HTTP cache (Chromium otherwise grows it to gigabytes per service).
app.commandLine.appendSwitch('disk-cache-size',String(256*1024*1024));
// Hardware video decode/encode through VA-API (Intel media driver), for calls and videos.
// Turn off with "_hardwareVideo": false in settings.json if video misbehaves.
let hardwareVideo=true;try{hardwareVideo=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'settings.json'),'utf8'))._hardwareVideo!==false}catch{}
if(hardwareVideo)app.commandLine.appendSwitch('enable-features','AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL,AcceleratedVideoEncoder,VaapiIgnoreDriverChecks');
// castlabs Electron ships Widevine through a component updater; stock Electron has no `components`.
const widevineReady=app.whenReady().then(()=>components?.whenReady()).catch(err=>console.warn('Six: Widevine unavailable',err));
if(!app.requestSingleInstanceLock()){app.quit()}else{
let win,tray,active=null,quitting=false,settings={},shutdownFlushing=false,shutdownSaved=false,sessions=new Set(),views=new Map(),popups=new Map(),crashes=new Map();
// Write then rename, so a crash or power loss mid-save cannot leave a half-written settings file.
function save(){const file=path.join(app.getPath('userData'),'settings.json');try{fs.writeFileSync(file+'.tmp',JSON.stringify(settings));fs.renameSync(file+'.tmp',file)}catch(err){console.warn('Six: could not save settings',err.message)}}
let memorySample={at:0,value:0};
function sampledMemory(){const now=Date.now();if(now-memorySample.at>=15000){memorySample={at:now,value:Math.round(app.getAppMetrics().reduce((a,p)=>a+p.memory.workingSetSize,0)/1024)}}return memorySample.value}
function syncRenderingPriority(){updateRenderingPriority(views,active,win)}
function state(){if(!win||win.isDestroyed())return;win.webContents.send('state',{active,quiet:!!settings._quiet,muteAll:!!settings._muteAll,services:services.map(s=>({...s,loaded:views.has(s.id),sleeping:!!views.get(s.id)?.sleeping,notifications:notificationsAllowed(settings,s.id),muted:audioMuted(settings,s.id),keepAlive:alwaysAwake.has(s.id)||!!settings[s.id],alwaysAwake:alwaysAwake.has(s.id)})),memory:sampledMemory()})}
function layout(){for(const e of views.values())layoutServiceView(win,e)}
function release(id){const e=views.get(id);if(!e)return;e.view.webContents.session.flushStorageData();views.delete(id);if(e.attached)win.contentView.removeChildView(e.view);e.view.webContents.close({waitForBeforeUnload:false})}
// Freeze page timers without destroying its renderer or in-memory state.
function setSleeping(id,sleeping){
 const e=views.get(id);if(!e)return Promise.resolve();
 e.lifecycle=(e.lifecycle||Promise.resolve()).then(async()=>{
  const wc=e.view.webContents;
  if(quitting||views.get(id)!==e||wc.isDestroyed())return;
  if(sleeping&&(id===active||alwaysAwake.has(id)||settings[id]||(id==='teams'&&(!e.callMonitorReady||e.callActive||e.sharePickerOpen))||wc.isCurrentlyAudible()||wc.isLoading()||[...popups.values()].includes(id)))return;
  if(!!e.sleeping===sleeping)return;
  if(!wc.debugger.isAttached()){wc.debugger.attach('1.3');e.lifecycleDebugger=true}
  if(!e.lifecycleDebugger)return; // Leave a user-opened developer session alone.
  await wc.debugger.sendCommand('Page.setWebLifecycleState',{state:sleeping?'frozen':'active'});
  e.sleeping=sleeping;e.sleptAt=sleeping?Date.now():0;
  if(!sleeping&&e.lifecycleDebugger){wc.debugger.detach();e.lifecycleDebugger=false}
  state();
 }).catch(()=>{if(!e.view.webContents.isDestroyed())console.warn('Six: could not change '+id+' sleep state')});
 return e.lifecycle;
}
// Record which hosts were blocked per service (adblock-blocked.txt in Six's data folder) to diagnose broken pages.
const blockedHosts=new Map();let blockedWrite=null;
function noteBlocked(id,url){let host;try{host=new URL(url).hostname}catch{return}const set=blockedHosts.get(id)||new Set();if(set.has(host))return;set.add(host);blockedHosts.set(id,set);
 blockedWrite??=setTimeout(()=>{blockedWrite=null;try{fs.writeFileSync(path.join(app.getPath('userData'),'adblock-blocked.txt'),[...blockedHosts].map(([sid,hosts])=>sid+': '+[...hosts].sort().join(' ')).join('\n')+'\n')}catch{}},5000);}
// Teams reports call activity; YouTube Music gets ad removal while ad blocking is on (applies when the tab next opens).
function preloadFor(id){if(id==='teams')return path.join(__dirname,'teams-call-preload.js');if(id==='ytmusic'&&settings._adblock!==false)return path.join(__dirname,'ytmusic-preload.js')}
function external(url){if(safeURL(url))shell.openExternal(url)}
function focusService(){const e=views.get(active);if(e&&!e.view.webContents.isDestroyed())e.view.webContents.focus()}
function refreshControls(){
 for(const [id,e] of views)e.view.webContents.setAudioMuted(audioMuted(settings,id));
 for(const [popup,id] of popups)if(!popup.isDestroyed())popup.webContents.setAudioMuted(audioMuted(settings,id));
 if(tray)tray.setContextMenu(Menu.buildFromTemplate([
 {label:'Open Six',click:()=>{win.show();win.focus();focusService()}},
 {label:'Pause all notifications',type:'checkbox',checked:!!settings._quiet,click:()=>{settings._quiet=!settings._quiet;save();refreshControls();state()}},
 {label:'Mute all audio',type:'checkbox',checked:!!settings._muteAll,click:()=>{settings._muteAll=!settings._muteAll;save();refreshControls();state()}},
 {label:'Block ads and trackers',type:'checkbox',checked:settings._adblock!==false,click:()=>{settings._adblock=settings._adblock===false;save();for(const s of services)if(views.has(s.id)||sessions.has(session.fromPartition('persist:six-'+s.id)))applyAdblock(session.fromPartition('persist:six-'+s.id),settings._adblock,url=>noteBlocked(s.id,url));refreshControls()}},
 {type:'separator'},{label:'Quit Six',click:()=>{quitting=true;app.quit()}}]));
}
function configureContents(wc,s,ses){
 // Website content must never act as window chrome.
 // Insert as soon as the new page commits so the scrollbar never flashes during load; dom-ready is a fallback.
 const addStyle=()=>wc.insertCSS(contentStyle,{cssOrigin:'user'}).catch(()=>{});
 wc.on('did-navigate',addStyle);wc.on('dom-ready',addStyle);
 wc.on('context-menu',(_event,params)=>{
  const run={replace:i=>wc.replaceMisspelling(i.word),openLink:()=>external(params.linkURL),copyLink:()=>clipboard.writeText(params.linkURL),copyImage:()=>wc.copyImageAt(params.x,params.y),copyImageURL:()=>clipboard.writeText(params.srcURL),undo:()=>wc.undo(),redo:()=>wc.redo(),cut:()=>wc.cut(),copy:()=>wc.copy(),paste:()=>wc.paste(),pastePlain:()=>wc.pasteAndMatchStyle(),selectAll:()=>wc.selectAll()};
  const items=contextMenuItems(params).map(i=>i.type?i:{label:i.label,enabled:i.enabled!==false,click:i.act?()=>run[i.act](i):undefined});
  if(items.length)Menu.buildFromTemplate(items).popup({window:BrowserWindow.fromWebContents(wc)||win});
 });
 wc.on('unresponsive',()=>console.warn('Six: '+s.id+' renderer unresponsive'));

 wc.setUserAgent(browserUserAgent(wc.getUserAgent()));
 wc.setAudioMuted(audioMuted(settings,s.id));
 wc.setWindowOpenHandler(({url})=>{
  if(popupAllowed(url,wc.getURL()))return {action:'allow',overrideBrowserWindowOptions:{parent:win,autoHideMenuBar:true,webPreferences:{session:ses,preload:preloadFor(s.id),nodeIntegration:false,contextIsolation:true,sandbox:true}}};
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
 if(s.id==='teams')ses.setDisplayMediaRequestHandler(makeScreenShareHandler({
  allowed:origin=>teamsMediaAllowed(s.id,'display-capture',origin),
  getSources:options=>desktopCapturer.getSources(options),
  chooseSource:async sources=>{
   const id=await new Promise(resolve=>{
   const picker=Menu.buildFromTemplate([
    {label:'Choose a screen or window to share',enabled:false},
    {type:'separator'},
    ...sources.map((source,index)=>({label:sourceLabel(source,index),click:()=>resolve(source.id)})),
    {type:'separator'},{label:'Cancel',click:()=>resolve(null)}
   ]);
   picker.popup({window:win,callback:()=>resolve(null)});
   });
   if(!id)return null;
   const result=await dialog.showMessageBox(win,{type:'question',title:'Share with Teams',message:'Share this screen or window?',detail:'Including system audio shares sound playing on this laptop, including other apps.',buttons:['Cancel','Share'],defaultId:1,cancelId:0,checkboxLabel:'Include system audio',checkboxChecked:true});
   return result.response===1?{id,shareAudio:result.checkboxChecked}:null;
  },
  onPicking:value=>{const e=views.get(s.id);if(e){e.sharePickerOpen=value;if(!value)e.lastActive=Date.now()}}
 }));
 ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
 applyAdblock(ses,settings._adblock!==false,url=>noteBlocked(s.id,url));
 ses.setPermissionCheckHandler((_wc,permission,origin,details)=>{
  if(teamsMediaAllowed(s.id,permission,details?.securityOrigin||origin)||protectedMediaAllowed(s.id,permission,details?.securityOrigin||origin))return true;
  return permission==='notifications'&&notificationsAllowed(settings,s.id);
 });
 ses.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
  if(teamsMediaAllowed(s.id,permission,details.requestingUrl||wc?.getURL())||protectedMediaAllowed(s.id,permission,details.requestingUrl||wc?.getURL()))return callback(true);
  if(permission==='notifications')return callback(notificationsAllowed(settings,s.id));
  if(permission==='media'){
   const result=await dialog.showMessageBox(win,{type:'question',buttons:['Deny','Allow'],defaultId:0,cancelId:0,message:s.name+' requests microphone / camera access',detail:'Origin: '+(details.requestingUrl||wc.getURL())});callback(result.response===1);
  }else callback(false);
 });
 const view=new WebContentsView({webPreferences:{session:ses,preload:preloadFor(s.id),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true,webSecurity:true}}),wc=view.webContents;
 configureContents(wc,s,ses);
 wc.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(s.id==='teams'&&isMainFrame&&!_inPlace){const e=views.get(s.id);if(e){e.callMonitorReady=false;e.callActive=false}}});
 wc.on('render-process-gone',(_event,details)=>{
  const current=views.get(s.id);if(!current||current.view.webContents!==wc)return; // intentional release
  const wasActive=active===s.id;release(s.id);if(wasActive)active=null;state();
  if(quitting||details?.reason==='clean-exit'||!(wasActive||alwaysAwake.has(s.id)||settings[s.id]))return;
  // Bring crashed always-awake, pinned or open services back, with backoff; give up after 3 crashes in 10 minutes.
  const now=Date.now(),recent=(crashes.get(s.id)||[]).filter(t=>now-t<10*60*1000);recent.push(now);crashes.set(s.id,recent);
  if(recent.length>3){console.warn('Six: '+s.id+' keeps crashing ('+details?.reason+'); not restarting');return}
  setTimeout(()=>{if(quitting||views.has(s.id))return;if(wasActive&&active===null)select(s.id);else{make(s);state()}},2000*recent.length).unref();
 });
 view.setVisible(false);
 const e={view,lastActive:Date.now(),attached:false,visible:false,sleeping:false,callActive:false,callMonitorReady:false};views.set(s.id,e);mountServiceView(win,e);(s.id==='ytmusic'?widevineReady:Promise.resolve()).then(()=>{if(!wc.isDestroyed())return wc.loadURL(s.url)}).catch(()=>{});return e;
}
function hideActive(){const e=views.get(active);if(e){e.lastActive=Date.now();hideServiceView(e);syncRenderingPriority()}}
function select(id){const s=services.find(s=>s.id===id);if(!s)return;if(active===id&&views.get(id)?.visible){const e=views.get(id);e.lastActive=Date.now();setSleeping(id,false).then(focusService);return}hideActive();active=id;const e=views.get(id)||make(s);e.lastActive=Date.now();showServiceView(win,e);syncRenderingPriority();setSleeping(id,false).then(()=>{if(active===id&&!e.view.webContents.isDestroyed())e.view.webContents.focus()});state()}
app.on('second-instance',()=>{win?.show();win?.focus()});
app.whenReady().then(()=>{
 try{settings=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'settings.json'),'utf8'))}catch{}
 if(!settings._teamsMediaDefaultsV1){settings._muted??={};settings._muted.teams=false;settings._teamsMediaDefaultsV1=true;save()}
 win=new BrowserWindow({width:1280,height:840,minWidth:850,minHeight:580,title:'Six',show:!process.argv.includes('--start-hidden'),frame:false,backgroundColor:'#11171b',icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.setMenuBarVisibility(false);win.loadFile('index.html');win.on('resize',layout);win.on('focus',focusService);for(const event of ['show','hide','minimize','restore'])win.on(event,syncRenderingPriority);win.on('show',state);win.webContents.on('did-finish-load',state);
 win.webContents.once('did-finish-load',()=>{
  select(startupServices[0].id);
  startupServices.slice(1).forEach((s,i)=>setTimeout(()=>{if(!quitting&&!views.has(s.id)){make(s);state()}},(i+1)*800).unref());
 });
 win.on('close',e=>{if(!quitting){e.preventDefault();win.hide()}});
 tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:24,height:24}));tray.setToolTip('Six');refreshControls();tray.on('click',()=>{win.show();win.focus();focusService()});
 ipcMain.on('teams-call-status',(event,status)=>{
  const e=views.get('teams');
  if(!e||event.sender!==e.view.webContents)return;
  let origin;try{origin=event.senderFrame.url}catch{return}
  if(!teamsMediaAllowed('teams','media',origin)||typeof status?.active!=='boolean'||typeof status?.ready!=='boolean')return;
  const wasActive=e.callActive;e.callActive=status.active;e.callMonitorReady=status.ready;syncRenderingPriority();
  if(wasActive&&!e.callActive)e.lastActive=Date.now();
  if(e.callActive)setSleeping('teams',false);
 });
 ipcMain.handle('action',(event,{action,id}={})=>{
  if(event.sender!==win.webContents)return;
  const s=services.find(s=>s.id===(id||active));
  if(action==='notifications'&&s){settings._notifications??={};settings._notifications[s.id]=!notificationsAllowed({...settings,_quiet:false},s.id);save();refreshControls()}
  if(action==='mute'&&s){settings._muted??={};settings._muted[s.id]=!settings._muted[s.id];save();refreshControls()}
  if(action==='quiet'){settings._quiet=!settings._quiet;save();refreshControls()}
  if(action==='minimize')win.minimize();
  if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize()}
  if(action==='close')win.close();
  if(action==='select'&&s){select(s.id);return}
  if(action==='pin'&&s&&!alwaysAwake.has(id)){settings[id]=!settings[id];save();if(settings[id])setSleeping(id,false)}
  if(action==='sleep'&&s&&id!==active&&!alwaysAwake.has(id))setSleeping(id,true);
  if(action==='latest'&&active==='telegram'){const wc=views.get(active)?.view.webContents;if(wc)wc.executeJavaScript('('+jumpTelegramLatest.toString()+')()',true).catch(()=>{})}
  if(action==='reload'&&active)views.get(active)?.view.webContents.reload();
  if(action==='back'&&active){const wc=views.get(active)?.view.webContents;if(wc?.navigationHistory.canGoBack())wc.navigationHistory.goBack()}
  if(action==='external'&&active)external(views.get(active)?.view.webContents.getURL());
  if(action==='home'){hideActive();active=null}
  state();
 });
 setInterval(()=>{const now=Date.now(),entries=[...views].map(([id,e])=>({id,lastActive:e.lastActive,sleeping:!!e.sleeping,sleptAt:e.sleptAt,keepAlive:!!settings[id]||[...popups.values()].includes(id),callActive:id==='teams'&&(!e.callMonitorReady||e.callActive||e.sharePickerOpen),audible:e.view.webContents.isCurrentlyAudible()}));for(const id of sleepCandidates(entries,active,now))setSleeping(id,true);for(const id of discardCandidates(entries,active,now))release(id);if(win.isVisible())state()},15000).unref(); // no UI updates while hidden in the tray
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
}
