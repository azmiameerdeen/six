// Memory figures for Six. Electron's own numbers are working sets, which count memory that processes share
// once per process, so adding them up overstates what Six needs. On Linux the kernel also reports PSS
// (shared memory split fairly between the processes using it), which adds up to the real footprint.
const fs=require('node:fs');

async function readPssKB(pid,readFile=fs.promises.readFile){
 const text=await readFile('/proc/'+pid+'/smaps_rollup','utf8');
 const m=/^Pss:\s+(\d+) kB/m.exec(text);
 return m?Number(m[1]):null;
}

// metrics: app.getAppMetrics(); views: Map of service id -> {view:{webContents}}.
async function measureMemory(metrics,views,readPss=readPssKB){
 const kb=new Map();
 await Promise.all(metrics.map(async p=>{
  let value=null;
  try{value=await readPss(p.pid)}catch{}
  kb.set(p.pid,value??p.memory.workingSetSize);
 }));
 let total=0;for(const v of kb.values())total+=v;
 const services={};
 for(const [id,e] of views){
  try{const pid=e.view.webContents.getOSProcessId();if(kb.has(pid))services[id]=Math.round(kb.get(pid)/1024)}catch{}
 }
 return {total:Math.round(total/1024),services};
}

function describeMemory(m){
 const parts=Object.entries(m.services).sort((a,b)=>b[1]-a[1]).map(([id,mb])=>id+' '+mb);
 return 'memory '+m.total+' MB in total; page by service: '+(parts.join(', ')||'none open');
}

module.exports={readPssKB,measureMemory,describeMemory};
