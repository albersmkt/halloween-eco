import QRCode from 'qrcode';
const $ = selector => document.querySelector(selector);
const camera = $('#camera');
const photo = $('#photo');
const frame = $('#selfie-frame');
const message = $('#selfie-status');
const activate = $('#activate-camera');
const capture = $('#capture');
const retake = $('#retake');
const retry = $('#retry-upload');
let stream;
let imageBlob;
let counting = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function stopCamera() {
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  camera.srcObject = null;
}
async function activateCamera() {
  activate.disabled = true;
  retake.disabled = true;
  message.textContent = 'Preparando a câmera…';
  try {
    // Never capture without the supplied frame being ready.
    await frame.decode();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode:'user', width:{ideal:1920}, height:{ideal:1080}}, audio:false});
    camera.srcObject = stream;
    await camera.play();
    camera.hidden = false;
    frame.hidden = false;
    photo.hidden = true;
    $('#qr-panel').hidden = true;
    retry.hidden = true;
    retake.hidden = true;
    activate.hidden = true;
    capture.hidden = false;
    message.textContent = 'Posicione-se na moldura. A foto será tirada após 5 segundos.';
  } catch (error) {
    stopCamera();
    message.textContent = !frame.complete || !frame.naturalWidth
      ? 'A moldura da selfie ainda não está disponível.'
      : error.name === 'NotAllowedError'
      ? 'Permita o acesso à câmera no navegador e tente novamente.'
      : error.name === 'NotFoundError'
      ? 'Conecte a webcam ao totem e tente novamente.'
      : 'Não foi possível iniciar a câmera. Confira a webcam e utilize HTTPS.';
  } finally {
    activate.disabled = false;
    retake.disabled = false;
  }
}
async function upload() {
  retry.hidden = true;
  retake.disabled = true;
  message.textContent = 'Preparando o QR code…';
  try {
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
    const response = await fetch('/api/selfie', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({image})});
    if (!response.ok) throw new Error('upload');
    const {downloadPath} = await response.json();
    const url = new URL(downloadPath, location.origin);
    if (url.origin !== location.origin || url.pathname !== '/api/download') throw new Error('url');
    await QRCode.toCanvas($('#qr'), url.href, {width:256, margin:4, errorCorrectionLevel:'M'});
    $('#qr-panel').hidden = false;
    message.textContent = 'Sua selfie está pronta! O link funciona por 24 horas.';
  } catch {
    message.textContent = 'Não foi possível gerar o link. Sua foto continua nesta tela; tente novamente.';
    retry.hidden = false;
  } finally {
    retake.disabled = false;
  }
}
activate.addEventListener('click', activateCamera);
retake.addEventListener('click', activateCamera);
retry.addEventListener('click', upload);
capture.addEventListener('click', async () => {
  if (counting || !stream || camera.readyState < 2) return;
  counting = true;
  capture.disabled = true;
  $('#restart').disabled = true;
  message.textContent = 'Olhe para a câmera!';
  try {
    for (let seconds=5; seconds>0; seconds--) {
      $('#countdown').textContent = seconds;
      await wait(1000);
    }
    $('#countdown').textContent = '';
    if (!stream?.active || camera.readyState < 2) throw new Error('camera');
    const context = photo.getContext('2d');
    const {width,height} = photo;
    const scale = Math.max(width / camera.videoWidth, height / camera.videoHeight);
    const w = camera.videoWidth * scale, h = camera.videoHeight * scale;
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(camera, (width-w)/2, (height-h)/2, w, h);
    context.restore();
    context.drawImage(frame, 0, 0, width, height);
    imageBlob = await new Promise(resolve => photo.toBlob(resolve, 'image/jpeg', .9));
    if (!imageBlob) throw new Error('capture');
    photo.hidden = false;
    camera.hidden = true;
    frame.hidden = true;
    capture.hidden = true;
    retake.hidden = false;
    stopCamera();
    await upload();
  } catch {
    message.textContent = 'A câmera foi interrompida. Ative-a novamente para tentar outra foto.';
    stopCamera();
    activate.hidden = false;
    capture.hidden = true;
  } finally {
    $('#countdown').textContent = '';
    counting = false;
    capture.disabled = false;
    $('#restart').disabled = false;
  }
});
$('#restart').addEventListener('click', () => {stopCamera(); location.reload();});
window.addEventListener('pagehide', stopCamera);
