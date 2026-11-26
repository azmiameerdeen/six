const {test}=require('node:test'),assert=require('node:assert/strict');
const {readPssKB,measureMemory,describeMemory}=require('./memory');
const views=pids=>new Map(Object.entries(pids).map(([id,pid])=>[id,{view:{webContents:{getOSProcessId:()=>{if(pid===null)throw new Error('gone');return pid}}}}]));
test('PSS is read from the kernel report, and bad reports give nothing',async()=>{
 assert.equal(await readPssKB(7,async f=>{assert.equal(f,'/proc/7/smaps_rollup');return 'Rss:   900 kB\nPss:   612 kB\nPss_Anon: 5 kB\n'}),612);
 assert.equal(await readPssKB(7,async()=>'nothing here'),null);
});
test('the total counts shared memory once (PSS); a process that cannot be read falls back to its working set',async()=>{
 const metrics=[{pid:1,memory:{workingSetSize:900*1024}},{pid:2,memory:{workingSetSize:500*1024}},{pid:3,memory:{workingSetSize:300*1024}}];
 const pss={1:600*1024,2:null};  // 3 throws
 const m=await measureMemory(metrics,views({whatsapp:1,telegram:2,threads:3}),async pid=>{if(pid===3)throw new Error('denied');return pss[pid]});
 assert.equal(m.total,Math.round((600+500+300)));            // 600 PSS + 500 working set + 300 working set
 assert.deepEqual(m.services,{whatsapp:600,telegram:500,threads:300});
});
test('services that are closed or whose page process is gone are left out',async()=>{
 const metrics=[{pid:1,memory:{workingSetSize:100*1024}}];
 const m=await measureMemory(metrics,views({whatsapp:1,teams:null,discord:99}),async()=>100*1024);
 assert.deepEqual(m.services,{whatsapp:100});
});
test('the log line lists services from largest to smallest',()=>{
 assert.equal(describeMemory({total:2300,services:{telegram:400,whatsapp:790}}),'memory 2300 MB in total; page by service: whatsapp 790, telegram 400');
 assert.match(describeMemory({total:900,services:{}}),/none open/);
});
test('available memory is read from /proc/meminfo, and unreadable input gives null',()=>{
 const {parseAvailableMB,availableMB}=require('./memory');
 const text='MemTotal:       15019788 kB\nMemFree:         1700000 kB\nMemAvailable:    7654321 kB\nBuffers: 1 kB\n';
 assert.equal(parseAvailableMB(text),Math.round(7654321/1024));
 assert.equal(parseAvailableMB('nothing'),null);assert.equal(parseAvailableMB(undefined),null);
 assert.equal(availableMB(()=>text),Math.round(7654321/1024));assert.equal(availableMB(()=>{throw new Error('no /proc')}),null);
});
