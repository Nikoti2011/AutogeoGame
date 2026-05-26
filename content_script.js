console.log('[autoplay] content script loaded');

const defaults = {
  settingsVersion: 2,
  enabled: true,
  zoom: false,
  naturalZoom: false,
  highlightOnly: false,
  autoskip: true,
  speed: 800,
  wrongLimit: 0,
  zoomLevel: 1.2
};
let latestSettings = { ...defaults };

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max, fallback) {
  const n = toNumber(value, fallback);
  return Math.min(max, Math.max(min, n));
}

function normalizeSettings(raw) {
  const src = raw || {};
  const migrated = { ...src };

  if (typeof migrated.autoplayEnabled === 'boolean' && typeof migrated.enabled !== 'boolean') {
    migrated.enabled = migrated.autoplayEnabled;
  }
  if (typeof migrated.autoSkip === 'boolean' && typeof migrated.autoskip !== 'boolean') {
    migrated.autoskip = migrated.autoSkip;
  }

  return {
    settingsVersion: defaults.settingsVersion,
    enabled: typeof migrated.enabled === 'boolean' ? migrated.enabled : defaults.enabled,
    zoom: typeof migrated.zoom === 'boolean' ? migrated.zoom : defaults.zoom,
    naturalZoom: typeof migrated.naturalZoom === 'boolean' ? migrated.naturalZoom : defaults.naturalZoom,
    highlightOnly: typeof migrated.highlightOnly === 'boolean' ? migrated.highlightOnly : defaults.highlightOnly,
    autoskip: typeof migrated.autoskip === 'boolean' ? migrated.autoskip : defaults.autoskip,
    speed: clamp(migrated.speed, 100, 2000, defaults.speed),
    wrongLimit: clamp(migrated.wrongLimit, 0, 10, defaults.wrongLimit),
    zoomLevel: clamp(migrated.zoomLevel, 0.1, 2.5, defaults.zoomLevel)
  };
}

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
document.documentElement.appendChild(script);
script.remove();

function applySettingsToPage(settings) {
  latestSettings = normalizeSettings({ ...latestSettings, ...(settings || {}) });
  window.dispatchEvent(new CustomEvent('autoplay-settings', { detail: latestSettings }));
}

// Push persisted settings on page load so inject.js does not rely on defaults.
chrome.storage.local.get(null, (stored) => {
  applySettingsToPage(stored);
  chrome.storage.local.set(latestSettings);
});

// Keep injected page logic synchronized if storage changes elsewhere.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const merged = { ...latestSettings };
  Object.keys(changes).forEach((key) => {
    merged[key] = changes[key].newValue;
  });
  applySettingsToPage(merged);
});

// Forward immediate popup updates to inject.js via custom event.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'settings') {
    applySettingsToPage(msg.settings);
  }
});

// inject.js runs in page context and may initialize slightly after first dispatch.
window.addEventListener('autoplay-inject-ready', () => {
  applySettingsToPage(latestSettings);
});
