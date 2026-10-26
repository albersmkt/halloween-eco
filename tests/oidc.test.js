const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {Writable} = require('node:stream');
const {once} = require('node:events');
function handler(file,sdk) {
  const module={exports:{}};
  const source=fs.readFileSync(file,'utf8').replace("await import('@vercel/blob')",'await mockBlob');
  vm.runInNewContext(source,{module,require,Buffer,ReadableStream,process:{env:{BLOB_STORE_ID:'store_test'}},mockBlob:sdk});
  return module.exports;
}
function response(){
  const bytes=[];
  const res=new Writable({write(chunk,encoding,callback){bytes.push(chunk);callback()}});
  res.headers={};res.statusCode=200;
  res.setHeader=(key,value)=>res.headers[key]=value;
  res.status=code=>{res.statusCode=code;return res};
  res.json=body=>{res.body=body;res.end();return res};
  res.bytes=()=>Buffer.concat(bytes);
  return res;
}
test('OIDC store without read-write token uploads and downloads private photo; expiry cannot be extended',async()=>{
  const objects=new Map();
  const sdk={put:async(path,data,options)=>{assert.equal(options.access,'private');objects.set(path,Buffer.from(data));},get:async(path,options)=>{assert.equal(options.access,'private');const data=objects.get(path);return data?{statusCode:200,stream:new ReadableStream({start(controller){controller.enqueue(data);controller.close()}})}:null;}};
  const upload=handler('api/selfie.js',sdk),download=handler('api/download.js',sdk);
  const jpeg=Buffer.from([0xff,0xd8,0,0,0xff,0xd9]);
  const uploaded=response();
  await upload({method:'POST',headers:{origin:'https://museum.example',host:'museum.example','content-type':'application/json'},body:{image:jpeg.toString('base64')}},uploaded);
  assert.equal(uploaded.statusCode,201);
  const url=new URL(uploaded.body.downloadPath,'https://museum.example');
  const query=Object.fromEntries(url.searchParams);
  assert(objects.has(`selfies/${query.expires}/${query.id}.jpg`));
  assert.equal(url.searchParams.has('signature'),false);
  const received=response(),done=once(received,'finish');
  await download({method:'GET',query},received);await done;
  assert.equal(received.statusCode,200);assert.deepEqual(received.bytes(),jpeg);
  assert.equal(received.headers['Content-Type'],'image/jpeg');
  const changed=response();await download({method:'GET',query:{...query,expires:String(Number(query.expires)+60000)}},changed);
  assert.equal(changed.statusCode,404);
  const expired=response();await download({method:'GET',query:{...query,expires:String(Date.now()-1000)}},expired);
  assert.equal(expired.statusCode,410);
});
