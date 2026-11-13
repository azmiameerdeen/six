function notificationsAllowed(settings,id){return !settings._quiet&&settings._notifications?.[id]!==false}
function audioMuted(settings,id){return !!settings._muteAll||!!settings._muted?.[id]}
function browserUserAgent(ua){return ua.replace(/\s(?:Six|six-messenger|Electron)\/\S+/gi,'')}
function popupAllowed(url,openerURL){
 try{
  const opener=new URL(openerURL);
  const trusted=/(^|\.)(microsoftonline\.com|microsoft\.com|live\.com|msauth\.net|msftauth\.net|discord\.com|telegram\.org|whatsapp\.com|facebook\.com|instagram\.com|threads\.com|x\.com|twitter\.com|youtube\.com|google\.com)$/.test(opener.hostname);
  if(!trusted||opener.protocol!=='https:')return false;
  if(url==='about:blank'||url==='')return true;
  return new URL(url).protocol==='https:';
 }catch{return false}
}
module.exports={notificationsAllowed,audioMuted,browserUserAgent,popupAllowed};
