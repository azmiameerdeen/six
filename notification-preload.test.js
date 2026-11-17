const {test,mock}=require('node:test'),assert=require('node:assert/strict');
const Module=require('node:module'),load=Module._load;
Module._load=function(req,...a){return req==='electron'?{contextBridge:{executeInMainWorld(){throw new Error('must not run outside a web page')}}}:load.call(this,req,...a)};
const {notificationShield}=require('./notification-preload');Module._load=load;
function page(){
 const made=[];
 class FakeNotification{constructor(title,options){this.title=title;this.options=options;this.closed=false;made.push(this)}close(){this.closed=true}}
 FakeNotification.permission='granted';
 const shown=[];
 class FakeRegistration{showNotification(title,options){shown.push({title,options});return Promise.resolve()}}
 globalThis.window=globalThis;globalThis.Notification=FakeNotification;globalThis.ServiceWorkerRegistration=FakeRegistration;
 return {made,shown,FakeRegistration};
}
test('a notification that asks to stay is made ordinary and closed after 5 seconds',()=>{
 mock.timers.enable({apis:['setTimeout']});
 try{
  const {made}=page();notificationShield(5000);
  const n=new Notification('Alice',{body:'hi',requireInteraction:true});
  assert.equal(made[0].options.requireInteraction,false);assert.equal(made[0].options.body,'hi');
  assert.equal(n.closed,false);mock.timers.tick(4999);assert.equal(n.closed,false);mock.timers.tick(1);assert.equal(n.closed,true);
 }finally{mock.timers.reset();delete globalThis.Notification;delete globalThis.ServiceWorkerRegistration}
});
test('ordinary notifications are untouched and never closed by Six',()=>{
 mock.timers.enable({apis:['setTimeout']});
 try{
  const {made}=page();notificationShield(5000);
  const n=new Notification('Bob',{body:'yo'});
  assert.deepEqual(made[0].options,{body:'yo'});mock.timers.tick(60000);assert.equal(n.closed,false);
  assert.equal(Notification.permission,'granted');assert.ok(n instanceof Notification);
  new Notification('No options');assert.equal(made[1].options,undefined);
 }finally{mock.timers.reset();delete globalThis.Notification;delete globalThis.ServiceWorkerRegistration}
});
test('service worker style notifications lose requireInteraction too',async()=>{
 const {shown,FakeRegistration}=page();notificationShield(5000);
 try{
  await new FakeRegistration().showNotification('Carol',{requireInteraction:true,tag:'t'});
  await new FakeRegistration().showNotification('Dan');
  assert.deepEqual(shown[0].options,{requireInteraction:false,tag:'t'});assert.equal(shown[1].options,undefined);
 }finally{delete globalThis.Notification;delete globalThis.ServiceWorkerRegistration}
});
