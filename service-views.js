// Keep native pages attached between selections; hide them to stop background painting.
function layoutServiceView(win,entry){
 const [width,height]=win.getContentSize();
 const bounds={x:0,y:48,width,height:Math.max(0,height-48)};
 const previous=entry.view.getBounds();
 if(Object.keys(bounds).some(key=>bounds[key]!==previous[key]))entry.view.setBounds(bounds);
}
function mountServiceView(win,entry){
 layoutServiceView(win,entry);
 if(entry.attached)return;
 entry.view.setVisible(false);
 win.contentView.addChildView(entry.view);
 entry.attached=true;entry.visible=false;
}
function hideServiceView(entry){
 if(!entry?.visible)return;
 const wc=entry.view.webContents;
 // Restore throttling before hiding so Chromium receives the hidden transition.
 if(!entry.callActive&&!wc.getBackgroundThrottling())wc.setBackgroundThrottling(true);
 entry.view.setVisible(false);entry.visible=false;
}
function showServiceView(win,entry){
 mountServiceView(win,entry);
 if(!entry.visible){entry.view.setVisible(true);entry.visible=true}
}
module.exports={layoutServiceView,mountServiceView,hideServiceView,showServiceView};
