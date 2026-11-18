// Silent Electron updates for the user install (~/.local/share/six). Downloads a build, checks its
// SHA-256 against the one GitHub publishes, unpacks and smoke-tests it, then stages it by writing
// electron/pending. six-launcher.sh switches to it at the next start and rolls back if it fails.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{Readable}=require('node:stream');
const {execFile}=require('node:child_process');
const {DOWNLOAD}=require('./electron-update');
const VERSION=/^\d+\.\d+\.\d+$/;

const run=(file,args,env)=>new Promise((resolve,reject)=>execFile(file,args,{env:env||process.env,timeout:120000},(err,out,errOut)=>err?reject(new Error(String(errOut||err.message).slice(-300))):resolve(out)));
const defaultUnzip=(zip,dest)=>run('unzip',['-q',zip,'-d',dest]);
// The new binary must at least start and run a line of JavaScript (as plain Node, so no window opens).
const defaultSmoke=electron=>run(electron,['-e','process.exit(0)'],{...process.env,ELECTRON_RUN_AS_NODE:'1'});

function readBad(electronDir){
 try{return fs.readFileSync(path.join(electronDir,'bad'),'utf8').split('\n').map(s=>s.trim()).filter(v=>VERSION.test(v))}catch{return []}
}

// Returns true when a new build was staged, false when it was already staged.
async function stageUpdate({electronDir,update,fetchImpl=fetch,unzip=defaultUnzip,smoke=defaultSmoke}){
 if(!update||!VERSION.test(update.version))throw new Error('bad version');
 if(!DOWNLOAD.test(update.url||''))throw new Error('unexpected download address');
 if(!/^[0-9a-f]{64}$/.test(update.sha256||''))throw new Error('bad checksum');
 const target=path.join(electronDir,update.version);
 const pending=path.join(electronDir,'pending');
 const markPending=()=>{fs.writeFileSync(pending+'.tmp',update.version+'\n');fs.renameSync(pending+'.tmp',pending)};
 if(fs.existsSync(path.join(target,'electron'))){
  if(fs.existsSync(pending)&&fs.readFileSync(pending,'utf8').trim()===update.version)return false;
  markPending();return true;
 }
 const work=path.join(electronDir,'.staging-'+update.version);
 fs.rmSync(work,{recursive:true,force:true});fs.mkdirSync(work,{recursive:true});
 try{
  const zipPath=path.join(work,'electron.zip');
  const res=await fetchImpl(update.url,{signal:AbortSignal.timeout(20*60*1000)});
  if(!res.ok||!res.body)throw new Error('download failed ('+res.status+')');
  const hash=crypto.createHash('sha256');
  await pipeline(Readable.fromWeb(res.body),async function*(source){for await(const chunk of source){hash.update(chunk);yield chunk}},fs.createWriteStream(zipPath));
  if(hash.digest('hex')!==update.sha256)throw new Error('checksum does not match');
  const out=path.join(work,'new');fs.mkdirSync(out);
  await unzip(zipPath,out);
  if(fs.readFileSync(path.join(out,'version'),'utf8').trim()!==update.version+'+wvcus')throw new Error('downloaded build reports a different version');
  fs.accessSync(path.join(out,'electron'),fs.constants.X_OK);
  await smoke(path.join(out,'electron'));
  fs.rmSync(zipPath);
  fs.renameSync(out,target);
 }finally{fs.rmSync(work,{recursive:true,force:true})}
 markPending();
 return true;
}

// Keep the build in use, the previous one and any staged one; remove the rest.
function pruneOldVersions(electronDir){
 const keep=new Set();
 for(const f of ['previous','pending','trial'])try{keep.add(fs.readFileSync(path.join(electronDir,f),'utf8').trim())}catch{}
 try{keep.add(fs.readlinkSync(path.join(electronDir,'current')))}catch{}
 for(const name of fs.readdirSync(electronDir)){
  if(VERSION.test(name)&&!keep.has(name))fs.rmSync(path.join(electronDir,name),{recursive:true,force:true});
 }
}

module.exports={stageUpdate,pruneOldVersions,readBad};
