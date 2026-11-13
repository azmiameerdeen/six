// Hide scrollbars (scrolling still works). Reset site-defined drag regions without creating a native rectangle for every
// message element. Only the two page roots exclude dragging over the content.
const contentStyle='*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}*{-webkit-app-region:initial!important;app-region:initial!important}html,body{-webkit-app-region:no-drag!important;app-region:no-drag!important}';
module.exports={contentStyle};
