const {test}=require('node:test'),assert=require('node:assert/strict');const {teamsMediaAllowed}=require('./media-policy');
test('Teams device permissions granted only on official HTTPS Teams origins',()=>{
 for(const host of ['teams.microsoft.com','teams.live.com','teams.cloud.microsoft'])for(const permission of ['media','speaker-selection'])assert.equal(teamsMediaAllowed('teams',permission,'https://'+host+'/v2/'),true);
 for(const origin of ['https://teams.microsoft.com.evil.test','http://teams.microsoft.com','https://login.microsoftonline.com','about:blank'])assert.equal(teamsMediaAllowed('teams','media',origin),false);
 assert.equal(teamsMediaAllowed('discord','media','https://teams.microsoft.com'),false);
 assert.equal(teamsMediaAllowed('teams','display-capture','https://teams.microsoft.com'),true);
});
test('Widevine is allowed only for YouTube Music on YouTube over HTTPS',()=>{
 const {protectedMediaAllowed}=require('./media-policy');
 assert.equal(protectedMediaAllowed('ytmusic','mediaKeySystem','https://music.youtube.com/'),true);
 assert.equal(protectedMediaAllowed('ytmusic','mediaKeySystem','http://music.youtube.com/'),false);
 assert.equal(protectedMediaAllowed('ytmusic','mediaKeySystem','https://music.youtube.com.evil.test/'),false);
 assert.equal(protectedMediaAllowed('discord','mediaKeySystem','https://music.youtube.com/'),false);
 assert.equal(protectedMediaAllowed('ytmusic','media','https://music.youtube.com/'),false);
});
test('copy buttons may write to the clipboard on HTTPS pages; reading it and other permissions stay denied',()=>{
 const {clipboardWriteAllowed}=require('./media-policy');
 assert.equal(clipboardWriteAllowed('clipboard-sanitized-write','https://teams.microsoft.com/v2/'),true);
 assert.equal(clipboardWriteAllowed('clipboard-sanitized-write','https://duckduckgo.com/'),true);
 assert.equal(clipboardWriteAllowed('clipboard-sanitized-write','http://example.com/'),false);
 assert.equal(clipboardWriteAllowed('clipboard-sanitized-write','not a url'),false);assert.equal(clipboardWriteAllowed('clipboard-sanitized-write',undefined),false);
 for(const p of ['clipboard-read','geolocation','midi','notifications','media'])assert.equal(clipboardWriteAllowed(p,'https://teams.microsoft.com/'),false,p);
});
test('persistent storage is allowed for WhatsApp on its own HTTPS pages and nowhere else',()=>{
 const {persistentStorageAllowed}=require('./media-policy');
 assert.equal(persistentStorageAllowed('whatsapp','persistent-storage','https://web.whatsapp.com/'),true);
 assert.equal(persistentStorageAllowed('whatsapp','persistent-storage','http://web.whatsapp.com/'),false);
 assert.equal(persistentStorageAllowed('whatsapp','persistent-storage','https://whatsapp.com.evil.test/'),false);
 assert.equal(persistentStorageAllowed('telegram','persistent-storage','https://web.whatsapp.com/'),false);
 assert.equal(persistentStorageAllowed('whatsapp','persistent-storage','garbage'),false);
 for(const p of ['background-sync','geolocation','clipboard-read','notifications'])assert.equal(persistentStorageAllowed('whatsapp',p,'https://web.whatsapp.com/'),false,p);
});
