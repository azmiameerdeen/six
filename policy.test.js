const {test}=require('node:test'),assert=require('node:assert/strict');const {sleepCandidates,safeURL,services}=require('./policy');
test('light startup opens only WhatsApp and Telegram while all services remain available',()=>{
 const {startupServices}=require('./policy');
 assert.deepEqual(startupServices.map(s=>s.id),['whatsapp','telegram']);
 assert.deepEqual(services.map(s=>s.id),['whatsapp','telegram','teams','threads','instagram','discord','ytmusic','duckai']);
});
test('only idle, unpinned, silent background services sleep',()=>{const entries=[{id:'active',lastActive:0},{id:'idle',lastActive:0},{id:'pinned',lastActive:0,keepAlive:true},{id:'call',lastActive:0,audible:true},{id:'recent',lastActive:950}];assert.deepEqual(sleepCandidates(entries,'active',1000,500),['idle'])});
test('reject unsafe external protocols',()=>{for(const u of ['javascript:alert(1)','file:///etc/passwd','not a url'])assert.equal(safeURL(u),false);assert.equal(safeURL('https://discord.com'),true)});
test('unique service session identifiers',()=>assert.equal(new Set(services.map(s=>s.id)).size,8));
test('hibernate at five minutes, preserve WhatsApp and Telegram regardless of pin setting',()=>{
 const {hibernateAfter}=require('./policy');
 const entries=['discord','whatsapp','telegram','threads','teams','ytmusic','instagram','duckai'].map(id=>({id,lastActive:0,keepAlive:false}));
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter-1),[]);
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter),['discord','threads','ytmusic','instagram','duckai']);
 assert.deepEqual(sleepCandidates(entries,'teams',hibernateAfter*10),['discord','threads','ytmusic','instagram','duckai']);
});
test('frozen services close after 5 more idle minutes, never always-awake, pinned, audible or active ones',()=>{
 const {discardCandidates,discardAfter}=require('./policy');
 const base={sleeping:true,sleptAt:0,keepAlive:false,callActive:false,audible:false};
 const entries=[{id:'threads',...base},{id:'whatsapp',...base},{id:'discord',...base,keepAlive:true},{id:'ytmusic',...base,audible:true},{id:'teams',...base,callActive:true},{id:'x',...base,sleeping:false},{id:'active',...base}];
 assert.deepEqual(discardCandidates(entries,'active',discardAfter-1),[]);
 assert.deepEqual(discardCandidates(entries,'active',discardAfter),['threads']);
});
test('a service that was audible a moment ago is not idle, so silent gaps between songs do not pause it',()=>{
 const {recentlyAudible,audibleGrace,discardCandidates}=require('./policy');
 const now=10*audibleGrace,base={id:'ytmusic',lastActive:0,keepAlive:false,audible:false};
 assert.equal(recentlyAudible({...base,audibleAt:now-audibleGrace+1},now),true);assert.equal(recentlyAudible({...base,audibleAt:now-audibleGrace},now),false);
 assert.equal(recentlyAudible({...base,audible:true},now),true);assert.equal(recentlyAudible(base,now),false);
 assert.deepEqual(sleepCandidates([{...base,audibleAt:now-1000}],'teams',now),[]);
 assert.deepEqual(sleepCandidates([{...base,audibleAt:now-audibleGrace-1}],'teams',now),['ytmusic']);
 assert.deepEqual(discardCandidates([{...base,sleeping:true,sleptAt:0,audibleAt:now-1000}],'teams',now),[]);
});
test('low-memory mode starts below 2 GB, ends above 2.5 GB, and keeps its state when memory is unknown',()=>{
 const {nextLowMemory}=require('./policy');
 assert.equal(nextLowMemory(false,5000),false);assert.equal(nextLowMemory(false,2047),true);assert.equal(nextLowMemory(false,2048),false);
 assert.equal(nextLowMemory(true,2300),true);   // between the two limits: stays as it was, so it does not flap
 assert.equal(nextLowMemory(true,2559),true);assert.equal(nextLowMemory(true,2560),false);
 assert.equal(nextLowMemory(true,null),true);assert.equal(nextLowMemory(false,undefined),false);assert.equal(nextLowMemory(false,0),false);
});
test('under low memory idle services pause after 2 minutes and close a minute later, with the usual protections',()=>{
 const {idleDelays,sleepCandidates,discardCandidates,hibernateAfter,discardAfter}=require('./policy');
 const normal=idleDelays(false),low=idleDelays(true);
 assert.deepEqual(normal,{sleep:hibernateAfter,discard:discardAfter});assert.equal(low.sleep+low.discard,3*60*1000);
 const now=10*60*1000,e=id=>({id,lastActive:now-2.5*60*1000,keepAlive:false});
 const entries=[e('threads'),e('whatsapp'),e('teams'),{...e('discord'),keepAlive:true},{...e('instagram'),audible:true},{...e('ytmusic'),audibleAt:now-1000}];
 assert.deepEqual(sleepCandidates(entries,'duckai',now,normal.sleep),[]);                          // 2.5 min idle is fine when memory is fine
 assert.deepEqual(sleepCandidates(entries,'teams',now,low.sleep),['threads']);                    // teams is the one in use; pinned, audible and recent-sound services stay
 assert.deepEqual(sleepCandidates([{...e('teams'),callActive:true}],'x',now,low.sleep),[]);        // a call is never idle
 const frozen={...e('threads'),sleeping:true,sleptAt:now-90*1000};
 assert.deepEqual(discardCandidates([frozen],'x',now,low.discard),['threads']);assert.deepEqual(discardCandidates([frozen],'x',now,normal.discard),[]);
});
