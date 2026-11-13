function teamsMediaAllowed(service,permission,origin){
 if(service!=='teams'||!['media','speaker-selection','display-capture'].includes(permission))return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&['teams.microsoft.com','teams.live.com','teams.cloud.microsoft'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host))}catch{return false}
}
// Spotify's web player needs Widevine (protected media) to play music.
function protectedMediaAllowed(service,permission,origin){
 if(service!=='spotify'||permission!=='mediaKeySystem')return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='spotify.com'||u.hostname.endsWith('.spotify.com'))}catch{return false}
}
module.exports={teamsMediaAllowed,protectedMediaAllowed};
