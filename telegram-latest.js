// Runs only on an explicit click; inspects controls and dimensions, never message text.
async function jumpTelegramLatest(){
 if(location.hostname!=='web.telegram.org')return false;
 const root=document.querySelector('#MiddleColumn');
 if(!root)return false;
 const route=location.hash;
 const nativeButton=root.querySelector('button:has(.icon-arrow-down)');
 if(nativeButton&&!nativeButton.disabled)nativeButton.click();
 let found=!!nativeButton,stable=0,lastHeight=-1;
 for(let attempt=0;attempt<8;attempt++){
  if(!root.isConnected||location.hash!==route)return found;
  const list=[...root.querySelectorAll('.MessageList')].find(e=>e.clientHeight>0);
  if(!list)return found;
  found=true;
  list.scrollTo({top:list.scrollHeight,behavior:'instant'});
  if(list.scrollHeight===lastHeight)stable++;else stable=0;
  lastHeight=list.scrollHeight;
  if(stable>=3)break;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 return found;
}
module.exports={jumpTelegramLatest};
