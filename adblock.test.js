const {test}=require('node:test'),assert=require('node:assert/strict');const {hostBlocked,requestBlocked,loadHosts}=require('./adblock');
test('blocks listed ad hosts and their subdomains only',()=>{
 const list=new Set(['doubleclick.net','ads.twitter.com']);
 assert.equal(hostBlocked('doubleclick.net',list),true);
 assert.equal(hostBlocked('stats.g.doubleclick.net',list),true);
 assert.equal(hostBlocked('notdoubleclick.net',list),false);
 assert.equal(hostBlocked('twitter.com',list),false);
});
test('never blocks pages the user navigates to',()=>{
 const list=new Set(['doubleclick.net']);
 assert.equal(requestBlocked({resourceType:'mainFrame',url:'https://doubleclick.net/'},list),false);
 assert.equal(requestBlocked({resourceType:'script',url:'https://doubleclick.net/x.js'},list),true);
});
test('bundled list loads and leaves the services themselves alone',()=>{
 const list=loadHosts();assert.ok(list.size>1000);
 for(const h of ['web.whatsapp.com','web.telegram.org','discord.com','www.threads.com','teams.microsoft.com','login.microsoftonline.com','music.youtube.com','accounts.google.com','rr1---sn-abc.googlevideo.com','t.co','www.gstatic.com'])assert.equal(hostBlocked(h,list),false,h);
 assert.equal(hostBlocked('pagead2.googlesyndication.com',list),true);
});
