// Start counting after a visitor interacts; the welcome screen can remain idle.
const INACTIVITY_MS = 45_000;
let inactivityTimer;
function renewInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    window.dispatchEvent(new Event('kiosk:reset'));
    window.location.reload();
  }, INACTIVITY_MS);
}
for (const type of ['pointerdown', 'click', 'keydown', 'selfie:enter', 'selfie:result']) {
  window.addEventListener(type, renewInactivityTimer, {passive:true});
}
window.addEventListener('pagehide', () => clearTimeout(inactivityTimer));
