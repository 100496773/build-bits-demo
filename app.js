// === DOM ELEMENTS ===
const els = {
  modeTabs:        document.querySelectorAll('.mode-tab'),
  buildSpace:      document.getElementById('build-space'),
  trayContent:     document.getElementById('tray-content'),
  refPanel:        document.getElementById('reference-panel'),
  refGrid:         document.querySelector('.reference-grid'),
  robotMessage:    document.getElementById('robot-message'),
  robotEyeLeft:    document.querySelector('.left-eye'),
  robotEyeRight:   document.querySelector('.right-eye'),
  robotMouth:      document.querySelector('.mouth'),
  progressText:    document.getElementById('progress-text'),
  progressBar:     document.getElementById('game-progress'),
  btnHint:         document.getElementById('btn-hint'),
  btnRestart:      document.getElementById('btn-restart'),
  rewardOverlay:   document.getElementById('reward-overlay'),
  btnNextLevel:    document.getElementById('btn-next-level'),
  challengeStats:  document.getElementById('challenge-stats'),
  timerText:       document.getElementById('timer-text'),
  scoreText:       document.getElementById('score-text'),
  hudLevelText:    document.getElementById('hud-level-text'),
  hudXpBar:        document.getElementById('hud-xp-bar'),
  modeLevelText:   document.getElementById('mode-level-text'),
  rewardStars:     document.getElementById('reward-stars'),
  rewardTitle:     document.getElementById('reward-title'),
  rewardPoints:    document.getElementById('reward-points'),
  rewardXp:        document.getElementById('reward-xp'),
  rewardProgressBar: document.getElementById('reward-progress-bar'),
  rewardLevelText: document.getElementById('reward-level-text')
};

// === STATE ===
const playerState = {
  globalLevel: 1,
  globalXP: 0,
  xpToNext: 500,
  skillLevel: 1.0,
  modeLevels: { guided: 1, creative: 1, memory: 1, challenge: 1 }
};

const sessionState = {
  mode: 'guided',
  puzzle: null,
  startTime: null,
  sessionStartTime: null,
  lastInteractionTime: null,
  currentDifficulty: 1,
  sessionFrustrationScore: 0,
  roundMistakes: 0,
  hintsUsed: 0,
  hintLevel: 0,
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  isHyperfocus: false,
  failureLoopHandled: false,
  fatigueFired: false,
  hardStepDone: false,
  guidedToEnd: false,
  roundHistory: [],
  idleStage: 0,
  rageTapWindow: [],
  dragBlocked: false,
  spamDropCount: 0,
  lastSpamTime: 0,
  timer: 0,
  timerInterval: null,
  monitorInterval: null,
  step: 0,
  builtSlots: {},
  score: 0,
  memoryPhase: 'idle'
};

// === PUZZLE GENERATOR ===
function generatePuzzle() {
  const d = sessionState.currentDifficulty;
  let numPieces = Math.min(9, Math.max(2, Math.floor(d * 0.85) + 1));
  if (sessionState.mode === 'challenge') numPieces = Math.min(9, numPieces + 1);

  const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
  const shuffledPos = [0,1,2,3,4,5,6,7,8].sort(() => Math.random() - 0.5).slice(0, numPieces);
  const target = {};
  const steps = [];
  const piecesNeeded = [];

  shuffledPos.forEach((pos, i) => {
    const c = colors[Math.floor(Math.random() * colors.length)];
    target[pos] = c;
    piecesNeeded.push({ id: `p${pos}-${i}`, color: c, type: 'block' });
    steps.push({ slot: pos, color: c, hint: `Place the ${c} block in the glowing space.` });
  });

  return { target, steps, piecesNeeded };
}

// === DIFFICULTY HELPERS ===
function getParTime() {
  const n = Object.keys(sessionState.puzzle ? sessionState.puzzle.target : {}).length || 4;
  const factors = { guided: 12, creative: 12, memory: 8, challenge: 10 };
  return n * (factors[sessionState.mode] || 12);
}

function updateSkillLevel(success, hintUsed, timeTaken) {
  const par = getParTime();
  let speedFactor = 1.0;
  if (timeTaken < par * 0.6) speedFactor = 1.3;
  if (timeTaken > par * 1.5) speedFactor = 0.7;
  const outcome = success ? 1.0 : (hintUsed ? 0.5 : 0.0);
  const weight = 0.25;
  playerState.skillLevel = Math.min(10.0, Math.max(1.0,
    playerState.skillLevel * (1 - weight) + (outcome * speedFactor * 10) * weight
  ));
}

function getNextDifficulty(succeeded, fastCompletion) {
  const target = Math.min(10, playerState.skillLevel + 0.5);
  const step = (sessionState.isHyperfocus && fastCompletion) ? 2 : 1;
  const diff = target - sessionState.currentDifficulty;
  if (diff > 0.8 && succeeded)  return Math.min(10, sessionState.currentDifficulty + step);
  if (diff < -0.8)              return Math.max(1,  sessionState.currentDifficulty - 1);
  return sessionState.currentDifficulty;
}

// === ROBOT EXPRESSIONS ===
const expressions = {
  happy:      { left: 4, right: 4, mouth: 'M 35 48 C 45 60, 55 60, 65 48' },
  neutral:    { left: 4, right: 4, mouth: 'M 40 50 Q 50 50 60 50' },
  concerned:  { left: 4, right: 4, mouth: 'M 40 55 Q 50 45 60 55' },
  excited:    { left: 5, right: 5, mouth: 'M 30 45 C 45 65, 55 65, 70 45' },
  thoughtful: { left: 3, right: 5, mouth: 'M 45 52 Q 50 50 55 52' }
};

let _lastRobotMsg = '';

function speak(text, expression = 'neutral') {
  if (text === _lastRobotMsg) return;
  _lastRobotMsg = text;
  els.robotMessage.innerText = text;
  const exp = expressions[expression] || expressions.neutral;
  els.robotEyeLeft.setAttribute('r', exp.left);
  els.robotEyeRight.setAttribute('r', exp.right);
  els.robotMouth.setAttribute('d', exp.mouth);
}

// === PROGRESSIVE HINT SYSTEM ===
function triggerHint(level) {
  if (level <= sessionState.hintLevel) return;
  sessionState.hintLevel = level;
  sessionState.lastInteractionTime = Date.now();

  const missing = Object.keys(sessionState.puzzle.target).find(k => !sessionState.builtSlots[k]);
  if (!missing) return;

  if (level === 1) {
    const color = sessionState.puzzle.target[missing];
    speak(`Look for something ${color}!`, 'thoughtful');
    document.querySelectorAll(`.block[data-color="${color}"]`).forEach(b => {
      b.classList.remove('anim-snap');
      void b.offsetWidth;
      b.classList.add('anim-snap');
      setTimeout(() => b.classList.remove('anim-snap'), 600);
    });
  }

  if (level === 2) {
    speak('This spot is waiting!', 'thoughtful');
    const slot = document.querySelector(`.build-space .slot[data-index="${missing}"]`);
    if (slot) slot.classList.add('adaptive-glow');
  }

  if (level === 3) {
    const color = sessionState.puzzle.target[missing];
    speak('This one! Grab it!', 'excited');
    const slot = document.querySelector(`.build-space .slot[data-index="${missing}"]`);
    const piece = document.querySelector(`.block[data-color="${color}"]`);
    if (slot) slot.classList.add('glow');
    if (piece) { piece.classList.remove('anim-snap'); void piece.offsetWidth; piece.classList.add('anim-snap'); }
    sessionState.guidedToEnd = true;
  }

  if (sessionState.hintsUsed > 0) {
    sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 5);
  }
  sessionState.hintsUsed++;
}

// === ADAPTIVE FLOW MONITOR ===
function triggerSoftPause() {
  speak("Taking a break? Tap when you're ready!", 'neutral');
  els.buildSpace.style.opacity = '0.5';
}

function startFlowMonitor() {
  if (sessionState.monitorInterval) clearInterval(sessionState.monitorInterval);
  sessionState.lastInteractionTime = Date.now();
  sessionState.idleStage = 0;

  sessionState.monitorInterval = setInterval(() => {
    if (sessionState.mode === 'memory' && sessionState.memoryPhase === 'memorize') return;

    const now = Date.now();
    const idleSeconds = (now - sessionState.lastInteractionTime) / 1000;
    const sessionMinutes = (now - sessionState.sessionStartTime) / 60000;

    // Idle stages — each fires once
    if (sessionState.idleStage === 0 && idleSeconds >= 20) {
      speak('Still there?', 'neutral');
      sessionState.idleStage = 1;
      sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 5);
    } else if (sessionState.idleStage === 1 && idleSeconds >= 40) {
      speak('Psst... I see where the next piece goes...', 'thoughtful');
      triggerHint(Math.max(1, sessionState.hintLevel + 1));
      sessionState.idleStage = 2;
      sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 5);
    } else if (sessionState.idleStage === 2 && idleSeconds >= 60) {
      speak('Want to try a different mode? I have an idea!', 'thoughtful');
      sessionState.idleStage = 3;
    } else if (sessionState.idleStage === 3 && idleSeconds >= 90) {
      triggerSoftPause();
      sessionState.idleStage = 4;
    }

    // Proactive hint escalation based on frustration
    const roundFrustration = sessionState.roundMistakes * 8 + sessionState.hintsUsed * 5;
    if (roundFrustration >= 35 && sessionState.hintLevel < 2) triggerHint(2);
    if (roundFrustration >= 55 && sessionState.hintLevel < 3) triggerHint(3);

    // Fatigue after 8 minutes
    if (sessionMinutes > 8 && !sessionState.fatigueFired && detectFatigue()) {
      handleFatigue();
    }

    // Hard step-down on extreme frustration
    if (sessionState.sessionFrustrationScore >= 70 && !sessionState.hardStepDone) {
      sessionState.hardStepDone = true;
      sessionState.currentDifficulty = Math.max(1, sessionState.currentDifficulty - 2);
      speak('Want to try something different? I have an idea!', 'thoughtful');
    }

  }, 3000);
}

// === FATIGUE DETECTION ===
function detectFatigue() {
  const last3 = sessionState.roundHistory.slice(-3);
  if (last3.length < 3) return false;
  const timeTrend    = last3[2].time     > last3[0].time     * 1.3;
  const mistakeTrend = last3[2].mistakes >= last3[0].mistakes + 2;
  return timeTrend && mistakeTrend;
}

function handleFatigue() {
  sessionState.fatigueFired = true;
  sessionState.currentDifficulty = Math.max(1, sessionState.currentDifficulty - 1);
  speak("You've been building so long! Want a quick break?", 'concerned');
}

// === RAGE-TAP DETECTION ===
function checkRageTap() {
  const now = Date.now();
  sessionState.rageTapWindow = sessionState.rageTapWindow.filter(t => now - t < 2000);
  sessionState.rageTapWindow.push(now);
  if (sessionState.rageTapWindow.length >= 5) {
    sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 20);
    speak('Hey, take a breath!', 'concerned');
    sessionState.rageTapWindow = [];
    sessionState.dragBlocked = true;
    setTimeout(() => { sessionState.dragBlocked = false; }, 1500);
    return true;
  }
  return false;
}

// === SPAM DROP DETECTION ===
function checkSpamDrop(wasSuccess) {
  if (wasSuccess) { sessionState.spamDropCount = 0; return; }
  const now = Date.now();
  sessionState.spamDropCount = (now - sessionState.lastSpamTime < 5000) ? sessionState.spamDropCount + 1 : 1;
  sessionState.lastSpamTime = now;
  if (sessionState.spamDropCount >= 3) {
    speak('Take a peek at the goal first!', 'thoughtful');
    els.refPanel.style.outline = '3px solid var(--color-primary)';
    setTimeout(() => { els.refPanel.style.outline = ''; }, 2000);
    sessionState.spamDropCount = 0;
  }
}

// === DRAG AND DROP ===
let draggedBlock = null, dragStartX = 0, dragStartY = 0, initialLeft = 0, initialTop = 0;

function setupDrag(blockEl) {
  blockEl.addEventListener('mousedown', startDrag);
  blockEl.addEventListener('touchstart', startDrag, { passive: false });
}

function startDrag(e) {
  if (sessionState.mode === 'memory' && sessionState.memoryPhase === 'memorize') return;
  if (sessionState.dragBlocked) return;
  if (checkRageTap()) return;

  draggedBlock = e.target.closest('.block');
  if (!draggedBlock) return;
  e.preventDefault();

  els.buildSpace.style.opacity = '';
  sessionState.lastInteractionTime = Date.now();
  sessionState.idleStage = 0;

  const rect = draggedBlock.getBoundingClientRect();
  if (draggedBlock.parentElement !== document.body) {
    draggedBlock.style.position = 'absolute';
    draggedBlock.style.left = `${rect.left}px`;
    draggedBlock.style.top  = `${rect.top}px`;
    document.body.appendChild(draggedBlock);
  }

  draggedBlock.classList.add('dragging');
  draggedBlock.classList.remove('anim-snap', 'anim-shake');

  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
  dragStartX  = clientX;
  dragStartY  = clientY;
  initialLeft = parseFloat(draggedBlock.style.left) || rect.left;
  initialTop  = parseFloat(draggedBlock.style.top)  || rect.top;

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup',   endDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend',  endDrag);
}

function onDrag(e) {
  if (!draggedBlock) return;
  e.preventDefault();
  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
  draggedBlock.style.left = `${initialLeft + (clientX - dragStartX)}px`;
  draggedBlock.style.top  = `${initialTop  + (clientY - dragStartY)}px`;
}

function endDrag(e) {
  if (!draggedBlock) return;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup',   endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend',  endDrag);

  draggedBlock.classList.remove('dragging');
  const blockRect = draggedBlock.getBoundingClientRect();
  const slots = document.querySelectorAll('.build-space .slot');
  let droppedSlot = null;

  for (const slot of slots) {
    const slotRect = slot.getBoundingClientRect();
    const ow = Math.max(0, Math.min(blockRect.right,  slotRect.right)  - Math.max(blockRect.left, slotRect.left));
    const oh = Math.max(0, Math.min(blockRect.bottom, slotRect.bottom) - Math.max(blockRect.top,  slotRect.top));
    if (ow * oh > blockRect.width * blockRect.height * 0.3) { droppedSlot = slot; break; }
  }

  if (droppedSlot) handleDrop(draggedBlock, droppedSlot);
  else             returnToTray(draggedBlock);
  draggedBlock = null;
}

function returnToTray(block) {
  block.style.position = 'relative';
  block.style.left = '0';
  block.style.top  = '0';
  els.trayContent.appendChild(block);
  block.classList.add('anim-shake');
}

// === GAME LOGIC ===
function handleDrop(block, slot) {
  const slotIndex = parseInt(slot.dataset.index);
  const color     = block.dataset.color;
  let success     = false;

  if (sessionState.guidedToEnd) {
    const missing = Object.keys(sessionState.puzzle.target).find(k => !sessionState.builtSlots[k]);
    if (missing && parseInt(missing) !== slotIndex) {
      sessionState.guidedToEnd = false;
      returnToTray(block);
      speak('Almost there!', 'thoughtful');
      return;
    }
    success = true;
  } else if (sessionState.mode === 'guided') {
    const currentDef = sessionState.puzzle.steps[sessionState.step];
    if (currentDef && currentDef.slot === slotIndex && currentDef.color === color) success = true;
  } else {
    if (sessionState.puzzle.target[slotIndex] === color) success = true;
  }

  if (success) {
    block.style.position = 'relative'; block.style.left = '0'; block.style.top = '0';
    block.classList.add('anim-snap');
    slot.appendChild(block);
    sessionState.builtSlots[slotIndex] = color;
    sessionState.lastInteractionTime   = Date.now();
    sessionState.idleStage = 0;
    checkSpamDrop(true);
    slot.classList.remove('glow', 'adaptive-glow');

    if (sessionState.mode === 'challenge') {
      sessionState.score += 150;
      updateChallengeUI();
      speak(['Nice!', 'Yes!', 'Got it!'][Math.floor(Math.random() * 3)], 'excited');
    } else {
      speak(['Great job!', 'Perfect snap!', 'You got it!', 'Nice one!'][Math.floor(Math.random() * 4)], 'happy');
    }

    checkProgress();

  } else {
    returnToTray(block);
    sessionState.roundMistakes++;
    sessionState.lastInteractionTime = Date.now();
    checkSpamDrop(false);

    if (sessionState.roundMistakes === 1) {
      speak('Oops! Try another spot', 'neutral');
      return;
    }

    sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 8);

    if (sessionState.roundMistakes >= 5) {
      sessionState.currentDifficulty = Math.max(1, sessionState.currentDifficulty - 1);
    }

    if (sessionState.consecutiveFailures >= 3 && !sessionState.failureLoopHandled) {
      sessionState.failureLoopHandled = true;
      speak('Want to try something different? I have an idea!', 'thoughtful');
    }

    if (sessionState.roundMistakes === 2) {
      speak(["Hmm, this one's tricky. Want a hint?", "Let's figure this out together!"][Math.floor(Math.random() * 2)], 'concerned');
    } else if (sessionState.roundMistakes === 3) {
      triggerHint(1);
    } else if (sessionState.roundMistakes >= 5) {
      triggerHint(Math.min(3, sessionState.hintLevel + 1));
    } else {
      speak("Almost! Let's try another place.", 'concerned');
    }

    if (sessionState.mode === 'challenge') {
      sessionState.score = Math.max(0, sessionState.score - 20);
      updateChallengeUI();
    }
  }
}

function checkProgress() {
  const targetKeys = Object.keys(sessionState.puzzle.target);
  let complete = true;

  if (sessionState.mode === 'guided') {
    sessionState.step++;
    els.progressText.innerText  = `Step ${sessionState.step} of ${sessionState.puzzle.steps.length}`;
    els.progressBar.style.width = `${(sessionState.step / sessionState.puzzle.steps.length) * 100}%`;
    document.querySelectorAll('.build-space .slot').forEach(s => s.classList.remove('glow'));

    if (sessionState.step < sessionState.puzzle.steps.length) {
      const nextStep = sessionState.puzzle.steps[sessionState.step];
      document.querySelector(`.build-space .slot[data-index="${nextStep.slot}"]`).classList.add('glow');
      speak(nextStep.hint, 'happy');
      complete = false;
    }
  } else {
    let matched = 0;
    targetKeys.forEach(k => { if (sessionState.builtSlots[k] === sessionState.puzzle.target[k]) matched++; });
    els.progressText.innerText  = `Pieces: ${matched} / ${targetKeys.length}`;
    els.progressBar.style.width = `${(matched / targetKeys.length) * 100}%`;
    complete = (matched === targetKeys.length);
  }

  if (complete) onWin();
}

function updateHUD() {
  els.hudLevelText.innerText = playerState.globalLevel;
  els.hudXpBar.style.width   = `${Math.min(100, (playerState.globalXP / playerState.xpToNext) * 100)}%`;
  const modeName = sessionState.mode.charAt(0).toUpperCase() + sessionState.mode.slice(1);
  els.modeLevelText.innerText = `${modeName} Mode — Lvl ${playerState.modeLevels[sessionState.mode]}`;
}

function updateChallengeUI() {
  els.scoreText.innerText = `Score: ${sessionState.score}`;
  const mins = Math.floor(sessionState.timer / 60);
  const secs = sessionState.timer % 60;
  els.timerText.innerText = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

// === REWARD / LEVEL UP ===
function onWin() {
  clearInterval(sessionState.timerInterval);
  clearInterval(sessionState.monitorInterval);

  const timeTaken      = (Date.now() - sessionState.startTime) / 1000;
  const par            = getParTime();
  const fastCompletion = timeTaken < par * 0.6;

  let stars = 1;
  if (sessionState.hintsUsed === 0)    stars++;
  if (sessionState.roundMistakes <= 1) stars++;

  const basePoints = sessionState.mode === 'challenge' ? sessionState.score : 0;
  const speedBonus = fastCompletion ? 50 : 0;
  const points     = basePoints + (stars * 100) + speedBonus;
  const xp         = points * 2;
  playerState.globalXP += xp;

  updateSkillLevel(true, sessionState.hintsUsed > 0, timeTaken);

  sessionState.consecutiveSuccesses++;
  sessionState.consecutiveFailures  = 0;
  sessionState.failureLoopHandled   = false;
  if (sessionState.consecutiveSuccesses >= 5) sessionState.isHyperfocus = true;

  const decay = sessionState.consecutiveSuccesses >= 3 ? 20 : 10;
  sessionState.sessionFrustrationScore = Math.max(0, sessionState.sessionFrustrationScore - decay);

  sessionState.roundHistory.push({ time: timeTaken, mistakes: sessionState.roundMistakes, hints: sessionState.hintsUsed });
  if (sessionState.roundHistory.length > 5) sessionState.roundHistory.shift();

  sessionState.currentDifficulty = getNextDifficulty(true, fastCompletion);
  playerState.modeLevels[sessionState.mode] = Math.max(1, Math.round(sessionState.currentDifficulty));

  while (playerState.globalXP >= playerState.xpToNext) {
    playerState.globalLevel++;
    playerState.globalXP  -= playerState.xpToNext;
    playerState.xpToNext   = Math.floor(playerState.xpToNext * 1.3);
  }

  let robotMsg;
  if (sessionState.consecutiveSuccesses >= 3 && sessionState.consecutiveSuccesses % 2 === 1) {
    robotMsg = "I can't keep up with you!";
  } else if (sessionState.consecutiveSuccesses >= 3) {
    robotMsg = "You're on fire!";
  } else {
    robotMsg = ["You did it! Amazing!", "Look what you made!", "You're a builder!"][Math.floor(Math.random() * 3)];
  }
  _lastRobotMsg = '';
  speak(robotMsg, 'excited');

  const titles = { 3: 'Flawless! You rock!', 2: 'Great build!', 1: "You didn't give up! Awesome!" };
  els.rewardStars.innerText     = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  els.rewardTitle.innerText     = titles[stars];
  els.rewardPoints.innerText    = points;
  els.rewardXp.innerText        = xp;
  els.rewardLevelText.innerText = `Player Lvl ${playerState.globalLevel}`;
  setTimeout(() => { els.rewardProgressBar.style.width = `${(playerState.globalXP / playerState.xpToNext) * 100}%`; }, 100);

  updateHUD();
  setTimeout(() => els.rewardOverlay.classList.remove('hidden'), 800);
}

// === INITIALIZATION & SETUP ===
function initLevel() {
  if (sessionState.timerInterval)   clearInterval(sessionState.timerInterval);
  if (sessionState.monitorInterval) clearInterval(sessionState.monitorInterval);
  els.rewardOverlay.classList.add('hidden');
  els.buildSpace.style.opacity = '';

  sessionState.startTime = Date.now();
  if (!sessionState.sessionStartTime) sessionState.sessionStartTime = Date.now();
  sessionState.roundMistakes    = 0;
  sessionState.hintsUsed        = 0;
  sessionState.hintLevel        = 0;
  sessionState.guidedToEnd      = false;
  sessionState.step             = 0;
  sessionState.builtSlots       = {};
  sessionState.hardStepDone     = false;
  sessionState.spamDropCount    = 0;
  sessionState.puzzle           = generatePuzzle();

  updateHUD();
  els.buildSpace.innerHTML  = '';
  els.refGrid.innerHTML     = '';
  els.trayContent.innerHTML = '';

  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = i;
    els.buildSpace.appendChild(slot);

    const rSlot = document.createElement('div');
    rSlot.className = 'slot';
    els.refGrid.appendChild(rSlot);
  }

  let pieces = [...sessionState.puzzle.piecesNeeded];
  if (sessionState.mode === 'challenge' || sessionState.mode === 'creative' || sessionState.currentDifficulty > 2) {
    const decoyColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
    pieces.push({ id: 'dec1', color: decoyColors[Math.floor(Math.random() * decoyColors.length)], type: 'block' });
  }

  pieces.sort(() => Math.random() - 0.5).forEach(p => {
    const b = document.createElement('div');
    b.className     = `block bg-${p.color}`;
    b.dataset.color = p.color;
    b.dataset.id    = p.id;
    els.trayContent.appendChild(b);
    setupDrag(b);
  });

  Object.entries(sessionState.puzzle.target).forEach(([idx, color]) => {
    const refSlot = els.refGrid.children[idx];
    const statB   = document.createElement('div');
    statB.className = `block-static bg-${color}`;
    refSlot.appendChild(statB);
  });

  setupMode();
  startFlowMonitor();
}

// === MODE SETUP — uses if/else instead of switch to avoid const-in-case issues ===
function setupMode() {
  els.refPanel.classList.add('hidden');
  els.challengeStats.classList.add('hidden');
  els.btnHint.classList.remove('hidden');

  if (sessionState.mode === 'guided') {
    els.progressText.innerText  = `Step 0 of ${sessionState.puzzle.steps.length}`;
    els.progressBar.style.width = '0%';
    const firstS = sessionState.puzzle.steps[0];
    document.querySelector(`.build-space .slot[data-index="${firstS.slot}"]`).classList.add('glow');
    speak(firstS.hint, 'neutral');

  } else if (sessionState.mode === 'creative') {
    els.refPanel.classList.remove('hidden');
    els.progressText.innerText  = `Pieces: 0 / ${Object.keys(sessionState.puzzle.target).length}`;
    els.progressBar.style.width = '0%';
    speak('Creative mode! Try to build what you see in the Goal.', 'happy');

  } else if (sessionState.mode === 'memory') {
    els.refPanel.classList.remove('hidden');
    sessionState.memoryPhase = 'memorize';
    let sec = Math.max(2, 7 - Math.floor(sessionState.currentDifficulty / 2));
    els.progressText.innerText = `Memorize! ${sec}s`;
    speak('Watch carefully, then build what you remember!', 'thoughtful');

    sessionState.timerInterval = setInterval(() => {
      sec--;
      els.progressText.innerText = `Memorize! ${sec}s`;
      if (sec <= 0) {
        clearInterval(sessionState.timerInterval);
        els.refPanel.classList.add('hidden');
        sessionState.memoryPhase   = 'build';
        els.progressText.innerText = 'Build from memory!';
        speak("Now it's your turn. Show me what you remember!", 'happy');
      }
    }, 1000);

  } else if (sessionState.mode === 'challenge') {
    els.challengeStats.classList.remove('hidden');
    els.refPanel.classList.remove('hidden');
    sessionState.score = 0;
    const perPieceTime = Math.max(4, 10 - Math.floor(sessionState.currentDifficulty * 0.5));
    sessionState.timer = Object.keys(sessionState.puzzle.target).length * perPieceTime;
    updateChallengeUI();
    speak("Think you can build fast? Let's find out!", 'excited');

    sessionState.timerInterval = setInterval(() => {
      sessionState.timer--;
      updateChallengeUI();
      if (sessionState.timer <= 0) {
        clearInterval(sessionState.timerInterval);
        sessionState.consecutiveFailures++;
        sessionState.consecutiveSuccesses = 0;
        sessionState.isHyperfocus = false;
        sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 10);
        sessionState.currentDifficulty = Math.max(1, sessionState.currentDifficulty - 1);
        speak("Good try! I'll give you more time next round.", 'concerned');
        setTimeout(() => initLevel(), 1500);
      }
    }, 1000);
  }
}

// === EVENT LISTENERS ===
els.modeTabs.forEach(tab => {
  tab.addEventListener('click', e => {
    els.modeTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    sessionState.mode = e.target.dataset.mode;
    sessionState.consecutiveSuccesses = 0;
    sessionState.consecutiveFailures  = 0;
    sessionState.isHyperfocus         = false;
    initLevel();
  });
});

els.btnRestart.addEventListener('click', () => {
  sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 10);
  sessionState.consecutiveFailures++;
  sessionState.consecutiveSuccesses = 0;
  sessionState.isHyperfocus = false;
  _lastRobotMsg = '';
  speak("Let's restart! Fresh slate.", 'happy');
  initLevel();
});

els.btnNextLevel.addEventListener('click', () => initLevel());

els.btnHint.addEventListener('click', () => {
  sessionState.lastInteractionTime = Date.now();
  sessionState.idleStage = 0;

  if (sessionState.mode === 'memory' && sessionState.memoryPhase === 'build') {
    els.refPanel.classList.remove('hidden');
    sessionState.hintsUsed++;
    sessionState.sessionFrustrationScore = Math.min(100, sessionState.sessionFrustrationScore + 5);
    speak("Here's a quick peek!", 'thoughtful');
    setTimeout(() => els.refPanel.classList.add('hidden'), 2000);
    return;
  }

  triggerHint(sessionState.hintLevel + 1);
});

// === BOOT ===
if (window.lucide) window.lucide.createIcons();
initLevel();