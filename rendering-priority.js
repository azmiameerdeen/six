// Only the visible service and live calls bypass background rendering limits.
function updateRenderingPriority(views,active,win){
 if(!win||win.isDestroyed())return;
 const visible=win.isVisible()&&!win.isMinimized();
 for(const [id,e] of views){
  const wc=e.view.webContents;if(wc.isDestroyed())continue;
  const throttle=!(e.callActive||(id===active&&e.visible&&visible));
  if(wc.getBackgroundThrottling()!==throttle)wc.setBackgroundThrottling(throttle);
 }
}
module.exports={updateRenderingPriority};
