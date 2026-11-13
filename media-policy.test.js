const {test}=require('node:test'),assert=require('node:assert/strict');const {teamsMediaAllowed}=require('./media-policy');
test('Teams device permissions granted only on official HTTPS Teams origins',()=>{
 for(const host of ['teams.microsoft.com','teams.live.com','teams.cloud.microsoft'])for(const permission of ['media','speaker-selection'])assert.equal(teamsMediaAllowed('teams',permission,'https://'+host+'/v2/'),true);
 for(const origin of ['https://teams.microsoft.com.evil.test','http://teams.microsoft.com','https://login.microsoftonline.com','about:blank'])assert.equal(teamsMediaAllowed('teams','media',origin),false);
 assert.equal(teamsMediaAllowed('discord','media','https://teams.microsoft.com'),false);
 assert.equal(teamsMediaAllowed('teams','display-capture','https://teams.microsoft.com'),true);
});
test('Widevine is allowed only for Spotify on spotify.com over HTTPS',()=>{
 const {protectedMediaAllowed}=require('./media-policy');
 assert.equal(protectedMediaAllowed('spotify','mediaKeySystem','https://open.spotify.com/'),true);
 assert.equal(protectedMediaAllowed('spotify','mediaKeySystem','http://open.spotify.com/'),false);
 assert.equal(protectedMediaAllowed('spotify','mediaKeySystem','https://spotify.com.evil.test/'),false);
 assert.equal(protectedMediaAllowed('discord','mediaKeySystem','https://open.spotify.com/'),false);
 assert.equal(protectedMediaAllowed('spotify','media','https://open.spotify.com/'),false);
});
