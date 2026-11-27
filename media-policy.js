function teamsMediaAllowed(service,permission,origin){
 if(service!=='teams'||!['media','speaker-selection','display-capture'].includes(permission))return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&['teams.microsoft.com','teams.live.com','teams.cloud.microsoft'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host))}catch{return false}
}
// YouTube Music uses Widevine (protected media) for some tracks and for Premium downloads/offline content.
const musicHosts=['music.youtube.com','youtube.com','www.youtube.com'];
function protectedMediaAllowed(service,permission,origin){
 if(service!=='ytmusic'||permission!=='mediaKeySystem')return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&musicHosts.includes(u.hostname)}catch{return false}
}
// "Copy" buttons use the async clipboard API, which needs this permission (Chromium only lets a page use it
// while the user is interacting with it). Writing is allowed on any HTTPS page; reading the clipboard
// ('clipboard-read') stays denied.
function clipboardWriteAllowed(permission,origin){
 if(permission!=='clipboard-sanitized-write')return false;
 try{return new URL(origin).protocol==='https:'}catch{return false}
}
module.exports={teamsMediaAllowed,protectedMediaAllowed,clipboardWriteAllowed};
