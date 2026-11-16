const {test}=require('node:test'),assert=require('node:assert/strict');
const {contentStyle,authStyle}=require('./content-style'),{isGoogleAuth}=require('./notification-policy');
test('scrollbars are hidden everywhere, but sideways scrolling is only locked on Google sign-in pages',()=>{
 assert.match(contentStyle,/scrollbar-width:none/);
 assert.doesNotMatch(contentStyle,/overflow-x/);
 assert.match(authStyle,/overflow-x:hidden/);
 assert.equal(isGoogleAuth('https://accounts.google.com/v3/signin/identifier'),true);
 assert.equal(isGoogleAuth('https://www.google.com/search'),false);
 assert.equal(isGoogleAuth('https://web.whatsapp.com/'),false);
});
