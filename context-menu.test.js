const {test}=require('node:test'),assert=require('node:assert/strict');const {contextMenuItems}=require('./context-menu');
const acts=items=>items.filter(i=>i.act).map(i=>i.act);
test('text box offers cut, copy, paste and select all',()=>{
 const items=contextMenuItems({isEditable:true,editFlags:{canCut:true,canCopy:true,canPaste:true,canSelectAll:true}});
 for(const a of ['cut','copy','paste','pastePlain','selectAll'])assert.ok(acts(items).includes(a),a);
});
test('selected text offers copy; links and images get their own items',()=>{
 assert.deepEqual(acts(contextMenuItems({selectionText:'hello'})),['copy']);
 assert.deepEqual(acts(contextMenuItems({linkURL:'https://example.com'})),['openLink','copyLink']);
 assert.deepEqual(acts(contextMenuItems({mediaType:'image',hasImageContents:true,srcURL:'https://x/y.png'})),['copyImage','copyImageURL']);
 assert.deepEqual(acts(contextMenuItems({linkURL:'javascript:alert(1)'})),['selectAll']);
});
test('spelling suggestions come first',()=>{
 const items=contextMenuItems({isEditable:true,misspelledWord:'helo',dictionarySuggestions:['hello','help'],editFlags:{}});
 assert.deepEqual(items.slice(0,2).map(i=>i.word),['hello','help']);
});
