const {contextBridge}=require('electron');
// Notifications that ask to stay until clicked ("requireInteraction") are shown by GNOME as persistent
// banners. Make them ordinary: strip the flag, and also close such a notification after `hideAfter` ms.
// Notifications that do not ask to stay are left alone, so they keep their normal place in the tray.
// Self-contained because it runs in the page's own world, ahead of the site's scripts.
function notificationShield(hideAfter){
 const strip=o=>o&&typeof o==='object'&&o.requireInteraction?{...o,requireInteraction:false}:o;
 const Native=window.Notification;
 if(typeof Native==='function'){
  window.Notification=new Proxy(Native,{construct(target,args,newTarget){
   const sticky=!!(args[1]&&args[1].requireInteraction);
   if(sticky)args[1]=strip(args[1]);
   const n=Reflect.construct(target,args,newTarget);
   if(sticky)setTimeout(()=>{try{n.close()}catch{}},hideAfter);
   return n;
  }});
 }
 const Registration=window.ServiceWorkerRegistration;
 if(Registration&&Registration.prototype&&typeof Registration.prototype.showNotification==='function'){
  const show=Registration.prototype.showNotification;
  Registration.prototype.showNotification=function(title,options){return show.call(this,title,strip(options))};
 }
}
if(typeof location!=='undefined'&&/^https?:$/.test(location.protocol)){
 try{contextBridge.executeInMainWorld({func:notificationShield,args:[5000]})}catch{}
}
if(typeof module!=='undefined')module.exports={notificationShield}; // for tests
