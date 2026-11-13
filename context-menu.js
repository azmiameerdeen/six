// Right-click menu for service pages: spelling, links, images, and cut/copy/paste.
// Returns plain item descriptions so it can be tested without Electron.
function contextMenuItems(p){
 const items=[],sep=()=>{if(items.length&&items[items.length-1].type!=='separator')items.push({type:'separator'})};
 const f=p.editFlags||{};
 if(p.isEditable&&p.misspelledWord){
  for(const word of (p.dictionarySuggestions||[]).slice(0,5))items.push({label:word,act:'replace',word});
  if(!p.dictionarySuggestions?.length)items.push({label:'No suggestions',enabled:false});
  sep();
 }
 if(p.linkURL&&/^https?:/i.test(p.linkURL)){items.push({label:'Open link in browser',act:'openLink'},{label:'Copy link address',act:'copyLink'});sep()}
 if(p.mediaType==='image'&&p.hasImageContents!==false){items.push({label:'Copy image',act:'copyImage'});if(/^https?:/i.test(p.srcURL||''))items.push({label:'Copy image address',act:'copyImageURL'});sep()}
 if(p.isEditable){
  items.push({label:'Undo',act:'undo',enabled:!!f.canUndo},{label:'Redo',act:'redo',enabled:!!f.canRedo});sep();
  items.push({label:'Cut',act:'cut',enabled:!!f.canCut},{label:'Copy',act:'copy',enabled:!!f.canCopy},{label:'Paste',act:'paste',enabled:!!f.canPaste},{label:'Paste as plain text',act:'pastePlain',enabled:!!f.canPaste});sep();
  items.push({label:'Select all',act:'selectAll',enabled:f.canSelectAll!==false});
 }else if(p.selectionText&&p.selectionText.trim()){
  items.push({label:'Copy',act:'copy'});
 }else if(!items.length){
  items.push({label:'Select all',act:'selectAll'});
 }
 if(items[items.length-1]?.type==='separator')items.pop();
 return items;
}
module.exports={contextMenuItems};
