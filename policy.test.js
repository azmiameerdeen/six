const {test}=require('node:test'),assert=require('node:assert/strict');const {sleepCandidates,safeURL,services}=require('./policy');
test('light startup opens only WhatsApp and Telegram while all six services remain available',()=>{
 const {startupServices}=require('./policy');
 assert.deepEqual(startupServices.map(s=>s.id),['whatsapp','telegram']);
 assert.deepEqual(services.map(s=>s.id),['whatsapp','telegram','teams','threads','discord','ytmusic']);
});
test('only idle, unpinned, silent background services sleep',()=>{const entries=[{id:'active',lastActive:0},{id:'idle',lastActive:0},{id:'pinned',lastActive:0,keepAlive:true},{id:'call',lastActive:0,audible:true},{id:'recent',lastActive:950}];assert.deepEqual(sleepCandidates(entries,'active',1000,500),['idle'])});
test('reject unsafe external protocols',()=>{for(const u of ['javascript:alert(1)','file:///etc/passwd','not a url'])assert.equal(safeURL(u),false);assert.equal(safeURL('https://discord.com'),true)});
test('six unique service session identifiers',()=>assert.equal(new Set(services.map(s=>s.id)).size,6));
test('hibernate at five minutes, preserve WhatsApp and Telegram regardless of pin setting',()=>{
 const {hibernateAfter}=require('./policy');
 const entries=['discord','whatsapp','telegram','threads','teams','ytmusic'].map(id=>({id,lastActive:0,keepAlive:false}));
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter-1),[]);
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter),['discord','threads','ytmusic']);
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter*10),['discord','threads','ytmusic']);
});
test('frozen services close after 5 more idle minutes, never always-awake, pinned, audible or active ones',()=>{
 const {discardCandidates,discardAfter}=require('./policy');
 const base={sleeping:true,sleptAt:0,keepAlive:false,callActive:false,audible:false};
 const entries=[{id:'threads',...base},{id:'whatsapp',...base},{id:'discord',...base,keepAlive:true},{id:'ytmusic',...base,audible:true},{id:'teams',...base,callActive:true},{id:'x',...base,sleeping:false},{id:'active',...base}];
 assert.deepEqual(discardCandidates(entries,'active',discardAfter-1),[]);
 assert.deepEqual(discardCandidates(entries,'active',discardAfter),['threads']);
});
