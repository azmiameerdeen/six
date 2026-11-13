// Network-level ad and tracker blocking from a bundled host list. Only subresources are
// blocked; pages the user navigates to (main frames) always load.
const fs=require('node:fs'),path=require('node:path');
let hosts=null;
function loadHosts(file=path.join(__dirname,'adblock-hosts.txt')){
 if(hosts)return hosts;
 hosts=new Set();
 try{for(const line of fs.readFileSync(file,'utf8').split('\n')){const h=line.trim();if(h&&!h.startsWith('#'))hosts.add(h)}}catch{}
 return hosts;
}
function hostBlocked(hostname,list=loadHosts()){
 let h=hostname.toLowerCase();
 while(h){if(list.has(h))return true;const dot=h.indexOf('.');if(dot<0)return false;h=h.slice(dot+1)}
 return false;
}
function requestBlocked(details,list){
 if(details.resourceType==='mainFrame')return false;
 try{const u=new URL(details.url);return (u.protocol==='https:'||u.protocol==='http:')&&hostBlocked(u.hostname,list)}catch{return false}
}
const filter={urls:['http://*/*','https://*/*']};
// Attach or detach the listener; with blocking off no request is routed through Six at all.
function applyAdblock(ses,enabled,onBlocked){
 if(enabled)ses.webRequest.onBeforeRequest(filter,(details,callback)=>{const cancel=requestBlocked(details);if(cancel&&onBlocked)onBlocked(details.url);callback({cancel})});
 else ses.webRequest.onBeforeRequest(null);
}
module.exports={loadHosts,hostBlocked,requestBlocked,applyAdblock};
