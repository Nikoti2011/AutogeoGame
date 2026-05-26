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

chrome.storage.local.get(null, (stored) => {
  const s = normalizeSettings(stored);
  chrome.storage.local.set(s);
  document.getElementById('enabled').checked = s.enabled;
  document.getElementById('zoom').checked = s.zoom;
  document.getElementById('naturalZoom').checked = s.naturalZoom;
  document.getElementById('highlightOnly').checked = s.highlightOnly;
  document.getElementById('autoskip').checked = s.autoskip;
  document.getElementById('speed').value = s.speed;
  document.getElementById('speedVal').textContent = s.speed + 'ms';
  document.getElementById('wrongLimit').value = s.wrongLimit;
  document.getElementById('wrongVal').textContent = s.wrongLimit === 0 ? 'off' : s.wrongLimit;
  document.getElementById('zoomLevel').value = s.zoomLevel;
  document.getElementById('zoomVal').textContent = Number(s.zoomLevel).toFixed(1) + 'x';
  document.getElementById('status').textContent = s.enabled ? 'autoplay active' : 'autoplay paused';
});

function save() {
  const s = normalizeSettings({
    enabled: document.getElementById('enabled').checked,
    zoom: document.getElementById('zoom').checked,
    naturalZoom: document.getElementById('naturalZoom').checked,
    highlightOnly: document.getElementById('highlightOnly').checked,
    autoskip: document.getElementById('autoskip').checked,
    speed: parseInt(document.getElementById('speed').value, 10),
    wrongLimit: parseInt(document.getElementById('wrongLimit').value, 10),
    zoomLevel: parseFloat(document.getElementById('zoomLevel').value)
  });
  chrome.storage.local.set(s);
  document.getElementById('status').textContent = s.enabled ? 'autoplay active' : 'autoplay paused';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'settings', settings: s }, () => {
        // Ignore the expected case where popup is opened on a non-game tab
        // and no content script receiver exists.
        void chrome.runtime.lastError;
      });
    }
  });
}

document.getElementById('enabled').addEventListener('change', save);
document.getElementById('zoom').addEventListener('change', save);
document.getElementById('naturalZoom').addEventListener('change', save);
document.getElementById('highlightOnly').addEventListener('change', save);
document.getElementById('autoskip').addEventListener('change', save);

document.getElementById('speed').addEventListener('input', () => {
  document.getElementById('speedVal').textContent = document.getElementById('speed').value + 'ms';
  save();
});
document.getElementById('wrongLimit').addEventListener('input', () => {
  const v = parseInt(document.getElementById('wrongLimit').value);
  document.getElementById('wrongVal').textContent = v === 0 ? 'off' : v;
  save();
});
document.getElementById('zoomLevel').addEventListener('input', () => {
  document.getElementById('zoomVal').textContent = parseFloat(document.getElementById('zoomLevel').value).toFixed(1) + 'x';
  save();
});
