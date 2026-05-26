console.log('[autoplay] injected into page context');

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
let settings = { ...defaults };

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

let loopInterval = null;
let lastHighlighted = null;
let waitingForClick = false;
let wrongAttemptsUsed = 0;
let questionsSeen = 0;
let pendingWrongQuestions = new Set();
let lastQuestionKey = '';

window.addEventListener('autoplay-settings', (e) => {
  settings = normalizeSettings({ ...settings, ...(e.detail || {}) });
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    if (settings.enabled && window._autoplayGameplay && window._autoplayUi) {
      startAutoPlay(window._autoplayGameplay, window._autoplayUi);
    }
  }
});
window.dispatchEvent(new CustomEvent('autoplay-inject-ready'));

setTimeout(() => waitForGame(), 3000);

function waitForGame() {
  console.log('[autoplay] polling for game...');
  const interval = setInterval(() => {
    if (!window.ui) return;
    const ui = window.ui;
    const gameplay = ui.scene.get('gameplay');
    if (!gameplay || !gameplay.countriesArray) return;

    clearInterval(interval);
    window._autoplayGameplay = gameplay;
    window._autoplayUi = ui;
    wrongAttemptsUsed = 0;
    questionsSeen = 0;
    pendingWrongQuestions = new Set();
    lastQuestionKey = '';
    console.log('[autoplay] game found');

    if (settings.autoskip) {
      autoClick(gameplay, 0);
      autoClick(gameplay, 1500);
      autoClick(gameplay, 3000);
      autoClick(gameplay, 4500);
      setTimeout(() => startAutoPlay(gameplay, ui), 6000);
    } else {
      const waitStart = setInterval(() => {
        if (gameplay.gameStarted) {
          clearInterval(waitStart);
          startAutoPlay(gameplay, ui);
        }
      }, 500);
    }
  }, 500);
}

function autoClick(gameplay, delay) {
  setTimeout(() => {
    gameplay.input.emit('pointerup', gameplay.input.activePointer);
  }, delay);
}

function getContainerForCountry(gameplay, country) {
  if (gameplay.africaArray.includes(country)) return gameplay.africaContainer;
  if (gameplay.asiaArray.includes(country)) return gameplay.asiaContainer;
  if (gameplay.europeArray.includes(country)) return gameplay.europeContainer;
  if (gameplay.oceaniaArray.includes(country)) return gameplay.oceaniaContainer;
  if (gameplay.americaArray.includes(country)) return gameplay.americaContainer;
  return null;
}

function zoomToCountry(gameplay, country) {
  const cam = gameplay.cameras.main;
  let wx = null;
  let wy = null;

  if (typeof country.getBounds === 'function') {
    const b = country.getBounds();
    wx = b.centerX;
    wy = b.centerY;
  } else {
    const container = getContainerForCountry(gameplay, country);
    if (!container) return;
    wx = container.x + country.x;
    wy = container.y + country.y;
  }

  const targetScrollX = wx - cam.width / 2;
  const targetScrollY = wy - cam.height / 2;

  // Prevent overlapping camera tweens from causing sudden jumps.
  gameplay.tweens.killTweensOf(cam);

  if (settings.naturalZoom) {
    const dx = targetScrollX - cam.scrollX;
    const dy = targetScrollY - cam.scrollY;
    const distance = Math.hypot(dx, dy);
    const travelRatio = Math.min(1, distance / 1400);
    const midScrollX = cam.scrollX + dx * 0.35;
    const midScrollY = cam.scrollY + dy * 0.35;
    const zoomOutTarget = Math.max(0.65, cam.zoom * (1 - 0.28 * travelRatio));
    const stage1Duration = 220 + Math.round(180 * travelRatio);
    const stage2Duration = 520 + Math.round(680 * travelRatio);

    gameplay.tweens.add({
      targets: cam,
      scrollX: midScrollX,
      scrollY: midScrollY,
      zoom: zoomOutTarget,
      duration: stage1Duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        gameplay.tweens.add({
          targets: cam,
          scrollX: targetScrollX,
          scrollY: targetScrollY,
          zoom: settings.zoomLevel,
          duration: stage2Duration,
          ease: 'Cubic.easeOut'
        });
      }
    });
  } else {
    gameplay.tweens.add({
      targets: cam,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      zoom: settings.zoomLevel,
      duration: 600,
      ease: 'Power2'
    });
  }
}

function highlightCountry(gameplay, country) {
  if (lastHighlighted && lastHighlighted !== country) {
    clearHighlight(gameplay, lastHighlighted);
  }
  lastHighlighted = country;
  if (typeof country.setTint === 'function') {
    country.setTint(0xffff33);
  }
  country.alpha = 1;
  gameplay.tweens.add({
    targets: country,
    scaleX: (country.scaleX || 1) * 1.12,
    scaleY: (country.scaleY || 1) * 1.12,
    alpha: 0.9,
    duration: 260,
    ease: 'Sine.easeOut',
    yoyo: true,
    repeat: -1
  });
}

function clearHighlight(gameplay, country) {
  if (!country) return;
  gameplay.tweens.killTweensOf(country);
  if (typeof country.clearTint === 'function') {
    country.clearTint();
  }
  country.scaleX = 1;
  country.scaleY = 1;
  country.alpha = 1;
  if (country.isSpritesheet) country.setFrame(0);
}

// simulate N wrong clicks before answering correctly
function simulateWrongAttempts(gameplay, ui, target, wrongsLeft, callback) {
  if (wrongsLeft <= 0) {
    callback();
    return;
  }

  // find a wrong country that isn't the target
  const wrong = gameplay.countriesArray.find(
    c => c.name !== target.name && c.input?.enabled
  );

  if (!wrong) {
    callback();
    return;
  }

  gameplay.canTap = true;
  wrongAttemptsUsed += 1;
  wrong.emit('pointerdown');
  setTimeout(() => {
    wrong.emit('pointerup');
    setTimeout(() => {
      simulateWrongAttempts(gameplay, ui, target, wrongsLeft - 1, callback);
    }, 1000);
  }, 220);
}

function shouldUseWrongAttemptThisQuestion(questionKey) {
  if (settings.wrongLimit <= 0) return false;
  if (wrongAttemptsUsed >= settings.wrongLimit) return false;
  if (pendingWrongQuestions.has(questionKey)) return true;

  const remainingWrong = settings.wrongLimit - wrongAttemptsUsed;
  const remainingQuestionsEstimate = Math.max(remainingWrong, 10);
  const chance = remainingWrong / remainingQuestionsEstimate;
  if (Math.random() < chance) {
    pendingWrongQuestions.add(questionKey);
    return true;
  }
  return false;
}

function startAutoPlay(gameplay, ui) {
  console.log('[autoplay] starting loop');
  waitingForClick = false;

  loopInterval = setInterval(() => {
    if (!settings.enabled) return;
    if (waitingForClick) return;

    if (gameplay.gameCompleted) {
      clearInterval(loopInterval);
      loopInterval = null;
      return;
    }

    const question = ui.questionText?.text;
    if (!question || question === '') return;
    if (question !== lastQuestionKey) {
      lastQuestionKey = question;
      questionsSeen += 1;
    }

    const target = gameplay.countriesArray?.find(
      c => c.name === question && c.input?.enabled
    );

    if (!target) return;

    if (settings.zoom) zoomToCountry(gameplay, target);

    if (settings.highlightOnly) {
      // pause loop, highlight, wait for user to click correctly
      waitingForClick = true;
      highlightCountry(gameplay, target);

      const prevQuestion = question;
      const watchClick = setInterval(() => {
        if (ui.questionText?.text !== prevQuestion || gameplay.gameCompleted) {
          clearInterval(watchClick);
          clearHighlight(gameplay, target);
          lastHighlighted = null;
          waitingForClick = false;
        }
      }, 100);

    } else {
      // pause loop while we simulate wrongs then answer
      waitingForClick = true;
      const applyWrongNow = shouldUseWrongAttemptThisQuestion(question);
      const wrongsForThisQuestion = applyWrongNow ? 1 : 0;

      simulateWrongAttempts(gameplay, ui, target, wrongsForThisQuestion, () => {
        pendingWrongQuestions.delete(question);
        gameplay.canTap = true;
        target.emit('pointerdown');
        setTimeout(() => {
          target.emit('pointerup');
          waitingForClick = false;
        }, 100);
      });
    }

  }, settings.speed);
}
