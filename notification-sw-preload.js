// Runs inside service workers, where some sites (for example Telegram) show their notifications.
// Strips "requireInteraction" so they do not stay on screen until clicked. Fails quietly if this
// context cannot reach the worker's own objects.
try{
 const Registration=self.ServiceWorkerRegistration;
 if(Registration&&Registration.prototype&&typeof Registration.prototype.showNotification==='function'){
  const show=Registration.prototype.showNotification;
  Registration.prototype.showNotification=function(title,options){
   return show.call(this,title,options&&options.requireInteraction?{...options,requireInteraction:false}:options);
  };
 }
}catch{}
