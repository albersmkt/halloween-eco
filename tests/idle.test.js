const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('kiosk resets after 45 seconds without input, with a full 45 seconds for QR scan',()=>{
  const handlers={},timers=new Map();let now=0,id=0,reloads=0,cameraStopped=false;
  const window={addEventListener(type,fn){handlers[type]=fn},dispatchEvent(event){if(event.type==='kiosk:reset')cameraStopped=true;handlers[event.type]?.()},location:{reload(){reloads++}}};
  vm.runInNewContext(fs.readFileSync('idle.js','utf8'),{window,Event,setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key},clearTimeout(key){timers.delete(key)}});
  function tick(ms){now+=ms;for(const [key,timer] of [...timers])if(timer.at<=now){timers.delete(key);timer.fn()}}
  tick(60000);assert.equal(reloads,0);
  handlers.pointerdown();tick(44999);assert.equal(reloads,0);
  handlers.click();tick(44999);assert.equal(reloads,0);
  handlers['selfie:result']();tick(44999);assert.equal(reloads,0);
  tick(1);assert.equal(reloads,1);assert(cameraStopped);
  handlers['selfie:enter']();handlers.pagehide();tick(45000);assert.equal(reloads,1);
});
test('selfie is offered only through QR code, with no local download link',()=>{
  const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('selfie.js','utf8');
  assert(!html.includes('photo-download'));assert(!source.includes('photo-download'));
  assert(!html.includes('Baixar selfie'));assert(html.includes('id="qr"'));
});
