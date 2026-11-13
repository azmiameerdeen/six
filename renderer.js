const $=s=>document.querySelector(s);
$('#brand').onclick=()=>window.six.action('home');
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>window.six.action(b.dataset.action));
let lastControlsKey='';
const serviceControls=new Map();
function controlsFor(s){
 if(serviceControls.has(s.id))return serviceControls.get(s.id);
 const item=document.createElement('button');item.setAttribute('aria-label',s.name);item.className='item';item.innerHTML='<span class="glyph"><img alt="" draggable="false"></span><span class="name"></span><span class="status"></span>';
 item.querySelector('img').src=s.icon;item.querySelector('.glyph').style.color=s.color;item.querySelector('.name').textContent=s.name;item.onclick=()=>window.six.action('select',s.id);$('#nav').append(item);
 const card=document.createElement('article');card.className='card';card.innerHTML='<div class="card-top"><span class="glyph"><img alt="" draggable="false"></span><button class="pin"></button></div><button class="launch"><h2></h2><small></small></button>';
 card.querySelector('img').src=s.icon;card.querySelector('.glyph').style.color=s.color;card.querySelector('h2').textContent=s.name;
 const pin=card.querySelector('.pin');pin.title='Keeps this service in memory for notifications. Uses more resources.';pin.onclick=()=>window.six.action('pin',s.id);card.querySelector('.launch').onclick=()=>window.six.action('select',s.id);$('#cards').append(card);
 const controls={item,card,pin,status:item.querySelector('.status'),description:card.querySelector('small')};serviceControls.set(s.id,controls);return controls;
}
window.six.onState(state=>{
 $('#heading').textContent=state.active?state.services.find(s=>s.id===state.active).name:'Your daily orbit';
 $('#memory').textContent=state.memory+' MB · app processes';
 $('#loaded').textContent=state.services.filter(s=>s.loaded&&!s.sleeping).length+' awake';
 // Memory samples and unread titles must not rebuild buttons or invalidate their layout.
 const controlsKey=JSON.stringify([state.active,state.quiet,state.muteAll,state.services.map(({title,...service})=>service)]);
 if(controlsKey===lastControlsKey)return;
 lastControlsKey=controlsKey;
 const selected=state.services.find(s=>s.id===state.active);
 $('#latest').hidden=state.active!=='telegram';
 $('#notify').hidden=!selected;$('#sound').hidden=!selected;
 if(selected){$('#notify').textContent=selected.notifications?'Alerts on':'Alerts off';$('#notify').title=state.quiet?'Notifications paused globally in tray':selected.notifications?'Disable desktop notifications':'Enable desktop notifications';$('#sound').textContent=selected.muted?'Muted':'Sound on';$('#sound').title=state.muteAll?'All audio muted in tray':selected.muted?'Unmute this service':'Mute all audio from this service, including calls'}
 for(const s of state.services){
  const c=controlsFor(s),isActive=s.id===state.active;
  c.item.classList.toggle('active',isActive);c.item.setAttribute('aria-pressed',String(isActive));
  const statusKey=JSON.stringify([s.loaded,s.sleeping,s.keepAlive,s.alwaysAwake]);
  if(c.statusKey===statusKey)continue;
  c.statusKey=statusKey;c.item.title=s.name+(s.sleeping?' · sleeping':'');
  c.status.textContent=s.loaded&&!s.sleeping?'●':'◌';c.status.classList.toggle('awake',s.loaded&&!s.sleeping);
  c.description.textContent=s.sleeping?'Sleeping · resume ↗':s.loaded?'Ready to continue ↗':'Open your space ↗';
  c.pin.textContent=s.alwaysAwake?'Always awake':s.keepAlive?'Keep awake ✓':'Keep awake';c.pin.disabled=s.alwaysAwake;c.pin.classList.toggle('on',s.keepAlive);
 }
});
