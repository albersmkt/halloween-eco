// Only arm the idle timeout after the visitor leaves the welcome page.
const INACTIVITY_MS = 40_000;
let inactivityTimer;
let experienceStarted = false;
function renewInactivityTimer() {
  if (!experienceStarted) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    window.dispatchEvent(new Event('kiosk:reset'));
    window.location.reload();
  }, INACTIVITY_MS);
}
function beginInactivityTimer() {
  experienceStarted = true;
  renewInactivityTimer();
}
for (const type of ['pointerdown', 'click', 'keydown', 'selfie:result']) {
  window.addEventListener(type, renewInactivityTimer, {passive:true});
}
for (const type of ['kiosk:advance', 'selfie:enter']) {
  window.addEventListener(type, beginInactivityTimer);
}
window.addEventListener('pagehide', () => clearTimeout(inactivityTimer));
