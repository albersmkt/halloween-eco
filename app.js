const scenes = [...document.querySelectorAll('.scene')];
const status = document.querySelector('#status');
let active = 0;
let busy = false;
scenes.forEach((scene, index) => {
  const video = scene.querySelector('video');
  const button = scene.querySelector('.advance');
  button.addEventListener('click', async () => {
    if (busy || index !== active) return;
    busy = true;
    status.textContent = '';
    button.disabled = true;
    video.currentTime = 0;
    try {
      await video.play();
      scene.classList.add('playing');
    } catch {
      busy = false;
      button.disabled = false;
      status.textContent = 'Não foi possível reproduzir. Clique para tentar novamente.';
    }
  });
  video.addEventListener('error', () => {
    busy = false;
    button.disabled = false;
    scene.classList.remove('playing');
    status.textContent = 'Não foi possível carregar o vídeo. Confira sua conexão e tente novamente.';
  });
  video.addEventListener('ended', () => {
    busy = false;
    if (scenes[index + 1]) {
      scene.inert = true;
      active = index + 1;
      const next = scenes[active];
      next.inert = false;
      next.scrollIntoView({behavior: 'instant', block: 'start'});
      next.querySelector('button').focus({preventScroll:true});
    } else {
      scene.classList.remove('playing');
      button.disabled = false;
      button.setAttribute('aria-label', 'Rever');
      status.textContent = 'Você chegou ao fim dos seis capítulos.';
    }
  });
});
// Navigation is driven by the buttons, so a scroll cannot skip a video.
window.addEventListener('wheel', event => event.preventDefault(), {passive:false});
window.addEventListener('touchmove', event => event.preventDefault(), {passive:false});
window.addEventListener('keydown', event => {
  if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key) && !event.target.closest('button,a')) event.preventDefault();
});
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
