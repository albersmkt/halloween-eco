const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHmac} = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const response = () => ({code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},end(){return this},json(body){this.body=body;return this}});
test('storage unavailable, cross-origin uploads, invalid JPEG and expired links are rejected', async () => {
  const old = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const upload=require('../api/selfie');
    let res=response();await upload({method:'POST'},res);assert.equal(res.code,503);
    process.env.BLOB_READ_WRITE_TOKEN='test-only';
    res=response();await upload({method:'POST',headers:{origin:'https://other.example',host:'museum.example'}},res);assert.equal(res.code,403);
    res=response();await upload({method:'POST',headers:{origin:'https://museum.example',host:'museum.example','content-type':'application/json'},body:{image:Buffer.from('not a photo').toString('base64')}},res);assert.equal(res.code,415);
    const id='12345678-1234-1234-1234-123456789abc',expires=String(Date.now()-1000);
    const signature=createHmac('sha256','test-only').update(`${id}:${expires}`).digest('hex');
    res=response();await require('../api/download')({method:'GET',query:{id,expires,signature}},res);assert.equal(res.code,410);
    res=response();await require('../api/download')({method:'GET',query:{id,expires,signature:'0'.repeat(64)}},res);assert.equal(res.code,403);
  } finally {if(old===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=old;}
});
test('six video sections advance instantly to selfie only after completion', async () => {
  const scenes=Array.from({length:6},()=>{
    const handlers={},clicks={},button={disabled:false,addEventListener:(n,f)=>clicks[n]=f,focus(){}},video={currentTime:0,addEventListener:(n,f)=>handlers[n]=f,play:async()=>{video.played=true}};
    return {handlers,clicks,button,video,querySelector:s=>s==='video'?video:button,classList:{add(){},remove(){}},scrollIntoView(options){this.options=options}};
  });
  const selfie={scrollIntoView(options){this.options=options}},activate={focus(){this.focused=true}};
  vm.runInNewContext(fs.readFileSync('app.js','utf8'),{document:{querySelectorAll:()=>[...scenes,{querySelector:()=>null}],querySelector:s=>s==='#selfie'?selfie:s==='#activate-camera'?activate:{}},window:{addEventListener(){},scrollTo(){}},history:{}});
  for(let i=0;i<6;i++){
    await scenes[i].clicks.click();assert(scenes[i].video.played);
    if(i<5)assert(!scenes[i+1].options);else assert(!selfie.options);
    scenes[i].handlers.ended();
    assert.equal((i<5?scenes[i+1]:selfie).options.behavior,'instant');
  }
  assert.equal(selfie.inert,false);assert(activate.focused);
});
for (const uploadStatus of [201,503,502]) test(`capture composites frame; upload HTTP ${uploadStatus} has correct UI`, async () => {
  const elements={},draws=[],delays=[];
  const element=id=>elements[id]??=( {hidden:false,disabled:false,textContent:'',listeners:{},addEventListener(n,f){this.listeners[n]=f}} );
  const camera=element('#camera');Object.assign(camera,{readyState:2,videoWidth:1920,videoHeight:1080,play:async()=>{}});
  const photo=element('#photo');Object.assign(photo,{width:1080,height:1920,getContext:()=>({save(){},restore(){},translate(){},scale(x){assert.equal(x,-1)},drawImage(image){draws.push(image)}}),toBlob:fn=>fn(new Blob(['photo']))});
  const frame=element('#selfie-frame');Object.assign(frame,{decode:async()=>{},complete:true,naturalWidth:941});
  let stopped=false;
  const source=fs.readFileSync('selfie.js','utf8').replace("import QRCode from 'qrcode';",'');
  vm.runInNewContext(source,{document:{querySelector:element},navigator:{mediaDevices:{getUserMedia:async()=>({active:true,getTracks:()=>[{stop(){stopped=true}}]})}},window:{addEventListener(){}},location:{origin:'https://museum.example',reload(){}},setTimeout(fn,ms){delays.push(ms);fn()},Blob,FileReader:class{readAsDataURL(){this.result='data:image/jpeg;base64,Zm9v';this.onload()}},fetch:async()=>({ok:uploadStatus===201,status:uploadStatus,json:async()=>({downloadPath:'/api/download?id=test'})}),URL,QRCode:{toCanvas:async()=>{}}});
  await element('#activate-camera').listeners.click();
  await element('#capture').listeners.click();
  assert.deepEqual(delays,[1000,1000,1000,1000,1000]);
  assert.deepEqual(draws,[camera,frame]);assert(stopped);assert.equal(element('#qr-panel').hidden,uploadStatus!==201);
  if(uploadStatus===503)assert.match(element('#selfie-status').textContent,/não está configurado/);
  if(uploadStatus===502)assert.match(element('#selfie-status').textContent,/armazenamento recusou/);
  if(uploadStatus!==201)assert.equal(element('#retry-upload').hidden,false);
});

test('missing frame does not block webcam; permission error is not masked by artwork failure', async () => {
  for (const denied of [false,true]) {
    const elements={};
    const element=id=>elements[id]??={hidden:true,disabled:false,listeners:{},addEventListener(n,f){this.listeners[n]=f}};
    element('#selfie-frame').decode=async()=>{throw new Error('missing frame')};
    element('#camera').play=async()=>{};
    let requested=false;
    const source=fs.readFileSync('selfie.js','utf8').replace("import QRCode from 'qrcode';",'');
    vm.runInNewContext(source,{document:{querySelector:element},navigator:{mediaDevices:{getUserMedia:async()=>{requested=true;if(denied)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});return{getTracks:()=>[{stop(){}}]}}}},window:{isSecureContext:true,addEventListener(){}},setTimeout});
    await element('#activate-camera').listeners.click();
    assert(requested);
    if(denied){assert.match(element('#selfie-status').textContent,/Acesso à câmera bloqueado/);assert.equal(element('#activate-camera').hidden,false)}
    else {assert.equal(element('#camera').hidden,false);assert.equal(element('#capture').hidden,false);assert.match(element('#selfie-status').textContent,/sem a moldura/)}
  }
});

test('selecting PNG saves exact file in IndexedDB and restores frame on reload', async () => {
  let saved;
  const db={close(){},objectStoreNames:{},createObjectStore(){},transaction(){
    const tx={objectStore:()=>({get(){const op={result:saved};queueMicrotask(()=>tx.oncomplete());return op},put(value){saved=value;const op={};queueMicrotask(()=>tx.oncomplete());return op}})};return tx;
  }};
  const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request}};
  const source=fs.readFileSync('selfie.js','utf8').replace("import QRCode from 'qrcode';",'');
  function page(){
    const elements={};const element=id=>elements[id]??={hidden:true,listeners:{},addEventListener(n,f){this.listeners[n]=f}};
    element('#selfie-frame').decode=async()=>{if(!element('#selfie-frame').src?.startsWith('blob:'))throw Error('not found')};
    vm.runInNewContext(source,{document:{querySelector:element},indexedDB,window:{addEventListener(){}},URL,setTimeout});return element;
  }
  const first=page();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(first('#choose-frame').hidden,false);
  const original=new Blob(['original artwork'],{type:'image/png'});
  await first('#frame-file').listeners.change({target:{files:[original]}});
  assert.equal(saved,original);assert.match(first('#selfie-frame').src,/^blob:/);assert.equal(first('#selfie-frame').hidden,false);
  const second=page();await new Promise(resolve=>setImmediate(resolve));
  assert.match(second('#selfie-frame').src,/^blob:/);assert.equal(second('#selfie-frame').hidden,false);assert.equal(second('#choose-frame').hidden,true);
});
