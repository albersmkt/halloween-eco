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
let frameReady = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let frameObjectURL;
function frameStore(mode, value) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return resolve(undefined);
    const request = indexedDB.open('ecos-selfie-config', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('settings', mode);
      const store = tx.objectStore('settings');
      const operation = mode === 'readonly' ? store.get('frame') : store.put(value, 'frame');
      tx.oncomplete = () => { db.close(); resolve(operation.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
async function useFrame(blob) {
  const source = URL.createObjectURL(blob);
  const previous = frame.src;
  frame.src = source;
  try {
    await frame.decode();
    if (frameObjectURL) URL.revokeObjectURL(frameObjectURL);
    frameObjectURL = source;
    frameReady = true;
    frame.hidden = !photo.hidden;
  } catch (error) {
    frame.src = previous;
    URL.revokeObjectURL(source);
    throw error;
  }
}
async function initializeFrame() {
  try {
    const saved = await frameStore('readonly');
    if (saved) await useFrame(saved);
    else { await frame.decode(); frameReady = true; frame.hidden = false; }
  } catch { frameReady = false; }
  $('#choose-frame').hidden = frameReady;
}
$('#choose-frame').addEventListener('click', () => $('#frame-file').click());
$('#frame-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== 'image/png' || file.size > 12 * 1024 * 1024) {
    message.textContent = 'Selecione a moldura em PNG de até 12 MB.';
    return;
  }
  try {
    await useFrame(file);
    // Apply a newly selected frame to the next capture, not over an old photo.
    let persisted = false;
    if (globalThis.indexedDB) {
      try { await frameStore('readwrite', file); persisted = true; } catch {}
    }
    message.textContent = persisted
      ? 'Moldura aplicada e salva neste navegador. Ative a câmera ou tire outra selfie.'
      : 'Moldura aplicada nesta sessão. Ative a câmera ou tire outra selfie.';
    $('#choose-frame').hidden = true;
  } catch {
    message.textContent = 'Não foi possível ler a moldura. Selecione o PNG original.';
  }
  event.target.value = '';
});
const frameInitialization = initializeFrame();

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
    if (window.isSecureContext === false) throw new Error('insecure');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({video: {facingMode:'user', width:{ideal:1920}, height:{ideal:1080}}, audio:false});
    } catch (error) {
      if (error.name !== 'OverconstrainedError') throw error;
      stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
    }
    camera.srcObject = stream;
    camera.hidden = false;
    await camera.play();
    await frameInitialization;
    frame.hidden = !frameReady;
    photo.hidden = true;
    $('#qr-panel').hidden = true;
    $('#photo-download').hidden = true;
    retry.hidden = true;
    retake.hidden = true;
    activate.hidden = true;
    capture.hidden = false;
    message.textContent = frameReady
      ? 'Posicione-se na moldura. A foto será tirada após 5 segundos.'
      : 'Câmera pronta. A foto será tirada após 5 segundos, ainda sem a moldura.';
  } catch (error) {
    stopCamera();
    camera.hidden = true;
    activate.hidden = false;
    capture.hidden = true;
    const errors = {
      NotAllowedError: 'Acesso à câmera bloqueado. Nas permissões deste site, permita a câmera e tente novamente.',
      NotFoundError: 'Nenhuma câmera foi encontrada. Conecte a webcam ao totem e tente novamente.',
      NotReadableError: 'A câmera está ocupada ou indisponível. Feche outros aplicativos que usam a webcam e tente novamente.',
      SecurityError: 'O navegador bloqueou a câmera. Confira as permissões deste site.',
      insecure: 'Abra o site pelo endereço HTTPS para ativar a câmera.',
      unsupported: 'Este navegador não disponibiliza acesso à câmera. Abra o site diretamente no Chrome ou Edge atualizado.'
    };
    message.textContent = errors[error.name] || errors[error.message] || 'Não foi possível iniciar a câmera. Confira a conexão da webcam e tente novamente.';
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
    if (!response.ok) {
      const messages = {
        503: 'O armazenamento de fotos não está configurado. Conecte um Vercel Blob privado ao projeto e refaça o deploy.',
        502: 'O armazenamento recusou o envio. Confira o token e se o Vercel Blob conectado é privado.',
        413: 'A foto excedeu o limite de envio. Tente tirar outra selfie.',
        403: 'O servidor bloqueou o envio. Abra o site pelo endereço principal da Vercel.',
        404: 'O servidor de fotos não está disponível nesta publicação. Confira o deploy na Vercel.'
      };
      throw new Error(messages[response.status] || `Falha ao enviar a foto (HTTP ${response.status}). Tente novamente.`);
    }
    const {downloadPath} = await response.json();
    const url = new URL(downloadPath, location.origin);
    if (url.origin !== location.origin || url.pathname !== '/api/download') throw new Error('url');
    $('#photo-download').href = url.href;
    $('#photo-download').hidden = false;
    try {
      await QRCode.toCanvas($('#qr'), url.href, {width:320, margin:4, errorCorrectionLevel:'M'});
    } catch {
      throw new Error('A foto foi enviada, mas o QR code não pôde ser desenhado. Use o botão Baixar selfie.');
    }
    $('#qr-panel').hidden = false;
    message.textContent = 'Sua selfie está pronta! O link funciona por 24 horas.';
  } catch (error) {
    message.textContent = (error.message === 'Failed to fetch' ? 'Falha de conexão com o servidor de fotos.' : error.message) + ' Sua foto continua nesta tela.';
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
    if (frameReady) context.drawImage(frame, 0, 0, width, height);
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
