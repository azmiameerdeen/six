function notificationsAllowed(settings,id){return !settings._quiet&&settings._notifications?.[id]!==false}
function audioMuted(settings,id){return !!settings._muteAll||!!settings._muted?.[id]}
function browserUserAgent(ua){return ua.replace(/\s(?:Six|six-messenger|Electron)\/\S+/gi,'')}
const authUserAgent='Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
function isGoogleAuth(url){
 try{
  const h=new URL(url).hostname;
  return /(^|\.)accounts\.(google|youtube)\.com$/.test(h);
 }catch{return false}
}
function sanitizeAuthHeaders(url,headers){
 if(!isGoogleAuth(url))return headers;
 const h={...headers,'User-Agent':authUserAgent};
 for(const k of Object.keys(h)){
  if(/^sec-ch-ua/i.test(k))delete h[k];
 }
 return h;
}
function popupAllowed(url,openerURL){
 try{
  const opener=new URL(openerURL);
  const trusted=/(^|\.)(microsoftonline\.com|microsoft\.com|live\.com|msauth\.net|msftauth\.net|discord\.com|telegram\.org|whatsapp\.com|facebook\.com|instagram\.com|threads\.com|x\.com|twitter\.com|youtube\.com|google\.com)$/.test(opener.hostname);
  if(!trusted||opener.protocol!=='https:')return false;
  if(url==='about:blank'||url==='')return true;
  return new URL(url).protocol==='https:';
 }catch{return false}
}
module.exports={notificationsAllowed,audioMuted,browserUserAgent,popupAllowed,authUserAgent,isGoogleAuth,sanitizeAuthHeaders};
