const {test}=require('node:test'),assert=require('node:assert/strict');
const {notificationsAllowed,audioMuted,browserUserAgent,popupAllowed}=require('./notification-policy');
test('per-service notification setting and global pause work independently',()=>{
 let s={_notifications:{teams:false}};assert.equal(notificationsAllowed(s,'teams'),false);assert.equal(notificationsAllowed(s,'whatsapp'),true);
 s._quiet=true;assert.equal(notificationsAllowed(s,'whatsapp'),false);s._quiet=false;assert.equal(notificationsAllowed(s,'teams'),false);
});
test('service audio and global mute',()=>{assert.equal(audioMuted({_muted:{teams:true}},'teams'),true);assert.equal(audioMuted({_muteAll:true},'whatsapp'),true);assert.equal(audioMuted({},'teams'),false)});
test('Microsoft login can open a blank popup and federated HTTPS sign-in',()=>{
 assert.equal(popupAllowed('about:blank','https://teams.microsoft.com/v2/'),true);
 assert.equal(popupAllowed('https://login.example.org','https://login.microsoftonline.com/'),true);
 for(const url of ['javascript:alert(1)','file:///etc/passwd','http://login.example.org'])assert.equal(popupAllowed(url,'https://teams.microsoft.com'),false);
 assert.equal(popupAllowed('about:blank','https://evil.example'),false);
});
test('browser identifier is consistent across services and sign-in popups',()=>assert.equal(browserUserAgent('Mozilla/5.0 Chrome/144.0.0.0 six-messenger/0.1.0 Electron/44.0 Safari/537.36'),'Mozilla/5.0 Chrome/144.0.0.0 Safari/537.36'));
