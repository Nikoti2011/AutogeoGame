console.log('[autoplay] injected into page context');

setTimeout(() => waitForGame(), 3000);

function waitForGame() {
  console.log('[autoplay] polling for game...');
  const interval = setInterval(() => {
    if (!window.ui) return;
    const ui = window.ui;
    const gameplay = ui.scene.get('gameplay');
    if (!gameplay || !gameplay.countriesArray) return;

    clearInterval(interval);
    console.log('[autoplay] game found, clicking through screens...');

    autoClick(gameplay, 0);
    autoClick(gameplay, 1500);
    autoClick(gameplay, 3000);
    autoClick(gameplay, 4500);

    setTimeout(() => startAutoPlay(gameplay, ui), 6000);
  }, 500);
}

function autoClick(gameplay, delay) {
  setTimeout(() => {
    console.log('[autoplay] clicking screen...');
    gameplay.input.emit('pointerup', gameplay.input.activePointer);
  }, delay);
}

function startAutoPlay(gameplay, ui) {
  console.log('[autoplay] starting loop');
  const loop = setInterval(() => {
    if (gameplay.gameCompleted) {
      clearInterval(loop);
      console.log('[autoplay] done');
      return;
    }

    const question = ui.questionText?.text;
    if (!question || question === '') return;

    const target = gameplay.countriesArray?.find(
      c => c.name === question && c.input?.enabled
    );

    if (!target) {
      console.log('[autoplay] no target for:', question, '— skipping');
      if (gameplay.questionsArray?.length > 0) {
        gameplay.getQuestion();
      } else {
        gameplay.gameOver();
      }
      return;
    }

    console.log('[autoplay] answering:', question);
    gameplay.canTap = true;
    target.emit('pointerdown');
    setTimeout(() => target.emit('pointerup'), 100);

  }, 800);
}