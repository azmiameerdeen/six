// Finds newer castlabs Electron (Widevine) builds. Only stable releases in the same major version
// as the running one are offered, and only ones that ship a Linux build with a published SHA-256.
// Nothing is downloaded here: staging is done by self-update.js (user install) or update-electron.sh (/opt install).
const DOWNLOAD=/^https:\/\/github\.com\/castlabs\/electron-releases\/releases\/download\//;
const RELEASES='https://api.github.com/repos/castlabs/electron-releases/releases?per_page=30';

function parseVersion(value){
 const m=/^(\d+)\.(\d+)\.(\d+)(?!\d)/.exec(String(value));
 return m?[Number(m[1]),Number(m[2]),Number(m[3])]:null;
}
function compare(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}

function pickUpdate(releases,current,skip=[]){
 const cur=parseVersion(current);
 if(!cur||!Array.isArray(releases))return null;
 let best=null;
 for(const r of releases){
  if(!r||r.draft||r.prerelease)continue;
  const m=/^v(\d+\.\d+\.\d+)\+wvcus$/.exec(r.tag_name||'');
  if(!m)continue;
  const v=parseVersion(m[1]);
  if(v[0]!==cur[0]||compare(v,cur)<=0)continue;
  const zip='electron-v'+m[1]+'+wvcus-linux-x64.zip';
  if(skip.includes(m[1]))continue;
  const asset=(r.assets||[]).find(a=>a&&a.name===zip&&/^sha256:[0-9a-f]{64}$/.test(a.digest||'')&&DOWNLOAD.test(a.browser_download_url||''));
  if(!asset)continue;
  if(!best||compare(v,best.parts)>0)best={version:m[1],parts:v,url:asset.browser_download_url,sha256:asset.digest.slice(7)};
 }
 return best?{version:best.version,url:best.url,sha256:best.sha256}:null;
}

async function checkForUpdate(current,fetchImpl=fetch,skip=[]){
 const res=await fetchImpl(RELEASES,{headers:{Accept:'application/vnd.github+json','User-Agent':'six-messenger-update-check'},signal:AbortSignal.timeout(15000)});
 if(!res.ok)return null;
 return pickUpdate(await res.json(),current,skip);
}

module.exports={parseVersion,pickUpdate,checkForUpdate,DOWNLOAD};
