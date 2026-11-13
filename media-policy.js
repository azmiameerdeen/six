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
module.exports={teamsMediaAllowed,protectedMediaAllowed};
