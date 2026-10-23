import test from 'node:test';
import assert from 'node:assert/strict';

test('URL projections redact credentials, query values and opaque fragments without changing plain URLs',async()=>{
 const {safeUrl,redactUrls}=await import('../src/privacy.js');
 assert.equal(safeUrl('https://app.test/dashboard'),'https://app.test/dashboard');
 for(const value of ['https://user:SECRET@app.test/review?token=SECRET&state=SECRET','https://app.test/#/review?ticket=SECRET','https://app.test/#SECRET']){
  assert.equal(safeUrl(value).includes('SECRET'),false);assert.equal(safeUrl(value).includes('user:'),false);
 }
 assert.match(safeUrl('https://app.test/#/review?ticket=SECRET'),/#\/review/);
 const figma=safeUrl('https://www.figma.com/design/abc/Design?node-id=1-2&token=SECRET');assert.match(figma,/node-id=1-2/);assert.equal(figma.includes('SECRET'),false);
 const original={url:'https://app.test/?token=SECRET',error:'Request failed at https://app.test/?token=SECRET',nested:[{image:'https://cdn.test/img?signature=SECRET'}]};
 assert.equal(JSON.stringify(redactUrls(original)).includes('SECRET'),false);assert.equal(original.url.includes('SECRET'),true);
 assert.equal(redactUrls('Request failed at HTTPS://user:SECRET@app.test/review?token=SECRET#SECRET').includes('SECRET'),false);
 assert.equal(safeUrl('https://figma.com/design/abc?node-id=1-2&node-id=SECRET').includes('SECRET'),false);
});
