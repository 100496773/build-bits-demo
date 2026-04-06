// === DOM ELEMENTS ===
const els = {
  modeTabs: document.querySelectorAll('.mode-tab'),
  buildSpace: document.getElementById('build-space'),
  trayContent: document.getElementById('tray-content'),
  refPanel: document.getElementById('reference-panel'),
  refGrid: document.querySelector('.reference-grid'),
  robotMessage: document.getElementById('robot-message'),
  robotEyeLeft: document.querySelector('.left-eye'),
  robotEyeRight: document.querySelector('.right-eye'),
  robotMouth: document.querySelector('.mouth'),
  progressText: document.getElementById('progress-text'),
  progressBar: document.getElementById('game-progress'),
  btnHint: document.getElementById('btn-hint'),
  btnRestart: document.getElementById('btn-restart'),
  rewardOverlay: document.getElementById('reward-overlay'),
  btnNextLevel: document.getElementById('btn-next-level'),
  challengeStats: document.getElementById('challenge-stats'),
  timerText: document.getElementById('timer-text'),
  scoreText: document.getElementById('score-text'),
  
  // HUD Elements
  hudLevelText: document.getElementById('hud-level-text'),
  hudXpBar: document.getElementById('hud-xp-bar'),
  modeLevelText: document.getElementById('mode-level-text'),
  
  // Reward Elements
  rewardStars: document.getElementById('reward-stars'),
  rewardTitle: document.getElementById('reward-title'),
  rewardPoints: document.getElementById('reward-points'),
  rewardXp: document.getElementById('reward-xp'),
  rewardProgressBar: document.getElementById('reward-progress-bar'),
  rewardLevelText: document.getElementById('reward-level-text')
};

// === STATE MANAGEMENT ===
// Persistent across sessions
const playerState = {
  globalLevel: 1,
  globalXP: 0,
  xpToNext: 1000,
  modeLevels: { guided: 1, creative: 1, memory: 1, challenge: 1 }
};

// Per-level tracking
const sessionState = {
  mode: 'guided',
  puzzle: null,
  startTime: null,
  lastInteractionTime: null,
  mistakes: 0,
  hintsUsed: 0,
  frustrationLevel: 0, // Reduces complexity, triggers auto-helps
  timer: 0,
  timerInterval: null,
  monitorInterval: null,
  step: 0,
  builtSlots: {},
  score: 0,
  memoryPhase: 'idle'
};

// === PROCEDURAL GENERATOR ===
function generatePuzzle() {
  const level = playerState.modeLevels[sessionState.mode];
  const frustration = sessionState.frustrationLevel;
  
  // difficulty logic: level increases pieces, frustration decreases pieces safely
  let numPieces = Math.min(9, Math.max(2, level + 2 - frustration));
  
  if (sessionState.mode === 'challenge') numPieces = Math.min(9, numPieces + 2); // challenge is harder
  
  const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
  const gridPositions = [0,1,2,3,4,5,6,7,8];
  const shuffledPos = gridPositions.sort(() => Math.random() - 0.5).slice(0, numPieces);
  
  let target = {};
  let steps = [];
  let piecesNeeded = [];
  
  shuffledPos.forEach((pos, i) => {
    const c = colors[Math.floor(Math.random() * colors.length)];
    target[pos] = c;
    piecesNeeded.push({ id: `p${pos}-${i}`, color: c, type: 'block' });
    steps.push({
      slot: pos,
      color: c,
      hint: `Place the ${c} block in the glowing space.`
    });
  });
  
  return { target, steps, piecesNeeded };
}

// === ROBOT EXPRESSIONS ===
const expressions = {
  happy: { left: 4, right: 4, mouth: 'M 35 48 C 45 60, 55 60, 65 48' },
  neutral: { left: 4, right: 4, mouth: 'M 40 50 Q 50 50 60 50' },
  concerned: { left: 4, right: 4, mouth: 'M 40 55 Q 50 45 60 55' },
  excited: { left: 5, right: 5, mouth: 'M 30 45 C 45 65, 55 65, 70 45' },
  thoughtful: { left: 3, right: 5, mouth: 'M 45 52 Q 50 50 55 52' }
};

function speak(text, expression = 'neutral') {
  els.robotMessage.innerText = text;
  const exp = expressions[expression] || expressions.neutral;
  els.robotEyeLeft.setAttribute('r', exp.left);
  els.robotEyeRight.setAttribute('r', exp.right);
  els.robotMouth.setAttribute('d', exp.mouth);
}

// === ADAPTIVE FLOW ENGINE ===
function startFlowMonitor() {
  if (sessionState.monitorInterval) clearInterval(sessionState.monitorInterval);
  sessionState.lastInteractionTime = Date.now();
  
  sessionState.monitorInterval = setInterval(() => {
    if (sessionState.mode === 'memory' && sessionState.memoryPhase === 'memorize') return;
    
    const idleTime = Date.now() - sessionState.lastInteractionTime;
    
    // Inactivity Detection
    if (idleTime > 15000) { // 15s idle
      triggerAdaptiveHelp("Take your time! Want a clue?");
      sessionState.lastInteractionTime = Date.now(); 
    }
  }, 5000);
}

function triggerAdaptiveHelp(msg) {
  speak(msg, "thoughtful");
  sessionState.frustrationLevel++;
  // Silent assistance: briefly glow next target without calling it a 'mistake'
  const targetKeys = Object.keys(sessionState.puzzle.target);
  const missing = targetKeys.find(k => !sessionState.builtSlots[k]);
  if (missing) {
    const slot = document.querySelector(`.build-space .slot[data-index="${missing}"]`);
    if(slot) {
      slot.classList.add('adaptive-glow');
      setTimeout(() => slot.classList.remove('adaptive-glow'), 2000);
    }
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
  
  draggedBlock = e.target.closest('.block');
  if (!draggedBlock) return;
  e.preventDefault();
  
  sessionState.lastInteractionTime = Date.now(); // update telemetry
  
  const rect = draggedBlock.getBoundingClientRect();
  if (draggedBlock.parentElement !== document.body) {
    draggedBlock.style.position = 'absolute';
    draggedBlock.style.left = `${rect.left}px`;
    draggedBlock.style.top = `${rect.top}px`;
    document.body.appendChild(draggedBlock);
  }

  draggedBlock.classList.add('dragging');
  draggedBlock.classList.remove('anim-snap', 'anim-shake');

  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

  dragStartX = clientX; dragStartY = clientY;
  initialLeft = parseFloat(draggedBlock.style.left) || rect.left;
  initialTop = parseFloat(draggedBlock.style.top) || rect.top;

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
}

function onDrag(e) {
  if (!draggedBlock) return;
  e.preventDefault();
  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
  
  draggedBlock.style.left = `${initialLeft + (clientX - dragStartX)}px`;
  draggedBlock.style.top = `${initialTop + (clientY - dragStartY)}px`;
}

function endDrag(e) {
  if (!draggedBlock) return;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  
  draggedBlock.classList.remove('dragging');
  const blockRect = draggedBlock.getBoundingClientRect();
  const slots = document.querySelectorAll('.build-space .slot');
  let droppedSlot = null;

  for (let slot of slots) {
    const slotRect = slot.getBoundingClientRect();
    const overlapArea = Math.max(0, Math.min(blockRect.right, slotRect.right) - Math.max(blockRect.left, slotRect.left)) *
                        Math.max(0, Math.min(blockRect.bottom, slotRect.bottom) - Math.max(blockRect.top, slotRect.top));
    if (overlapArea > (blockRect.width * blockRect.height * 0.3)) {
      droppedSlot = slot; break;
    }
  }

  if (droppedSlot) handleDrop(draggedBlock, droppedSlot);
  else returnToTray(draggedBlock);
  draggedBlock = null;
}

function returnToTray(block) {
  block.style.position = 'relative'; block.style.left = '0'; block.style.top = '0';
  els.trayContent.appendChild(block);
  block.classList.add('anim-shake');
}

// === GAME LOGIC ===
function handleDrop(block, slot) {
  const slotIndex = parseInt(slot.dataset.index);
  const color = block.dataset.color;
  
  let success = false;
  if (sessionState.mode === 'guided') {
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
    
    if (sessionState.mode === 'challenge') {
      sessionState.score += 150;
      updateChallengeUI();
      speak("Nice!", "excited");
    } else {
      speak(["Great job!", "Perfect snap!", "You got it!"][Math.floor(Math.random()*3)], "happy");
    }
    
    slot.classList.remove('glow', 'adaptive-glow');
    checkProgress();
  } else {
    returnToTray(block);
    sessionState.mistakes++;
    
    // Frustration threshold trigger
    if (sessionState.mistakes >= 3 && sessionState.mistakes % 2 === 1) {
      triggerAdaptiveHelp("Oops! Let's try finding the right spot together.");
    } else {
      speak("Almost! Let's try another place.", "concerned");
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
    els.progressText.innerText = `Step ${sessionState.step} of ${sessionState.puzzle.steps.length}`;
    els.progressBar.style.width = `${(sessionState.step / sessionState.puzzle.steps.length) * 100}%`;
    
    document.querySelectorAll('.build-space .slot').forEach(s => s.classList.remove('glow'));
    
    if (sessionState.step < sessionState.puzzle.steps.length) {
       const nextStep = sessionState.puzzle.steps[sessionState.step];
       document.querySelector(`.build-space .slot[data-index="${nextStep.slot}"]`).classList.add('glow');
       speak(nextStep.hint, "happy");
       complete = false;
    }
  } else {
    let matched = 0;
    targetKeys.forEach(k => { if (sessionState.builtSlots[k] === sessionState.puzzle.target[k]) matched++; });
    
    els.progressText.innerText = `Pieces: ${matched} / ${targetKeys.length}`;
    els.progressBar.style.width = `${(matched / targetKeys.length) * 100}%`;
    complete = (matched === targetKeys.length);
  }

  if (complete) onWin();
}

function updateHUD() {
  els.hudLevelText.innerText = playerState.globalLevel;
  els.hudXpBar.style.width = `${Math.min(100, (playerState.globalXP / playerState.xpToNext) * 100)}%`;
  
  // Format mode names gracefully
  const modeName = sessionState.mode.charAt(0).toUpperCase() + sessionState.mode.slice(1);
  els.modeLevelText.innerText = `${modeName} Mode — Lvl ${playerState.modeLevels[sessionState.mode]}`;
}

// === REWARD / LEVEL UP ===
function onWin() {
  clearInterval(sessionState.timerInterval);
  clearInterval(sessionState.monitorInterval);
  
  const timeTaken = (Date.now() - sessionState.startTime) / 1000; 
  
  let stars = 3;
  if (sessionState.mistakes > 1) stars--;
  if (sessionState.mistakes > 4) stars--;
  if (sessionState.hintsUsed > 0) stars--;
  if (stars < 1) stars = 1; // Always positive reinforcement!
  
  const msgs = { 3: "Flawless focus! Incredible!", 2: "Great improvement! Well done!", 1: "You didn't give up! Awesome!" };
  
  // Scoring
  const basePoints = sessionState.mode === 'challenge' ? sessionState.score : 0;
  const points = basePoints + (stars * 100) + Math.max(0, 100 - Math.floor(timeTaken));
  const xp = points * 2;
  playerState.globalXP += xp;
  
  // Leve Up Logic
  while(playerState.globalXP >= playerState.xpToNext) {
     playerState.globalLevel++;
     playerState.globalXP -= playerState.xpToNext;
     playerState.xpToNext = Math.floor(playerState.xpToNext * 1.3);
  }
  
  // Adaptive Difficulty Progression
  if (stars >= 2) {
     playerState.modeLevels[sessionState.mode]++;
     sessionState.frustrationLevel = Math.max(0, sessionState.frustrationLevel - 1);
  } else {
     // User struggled - silently adapt for NEXT run
     sessionState.frustrationLevel++;
  }
  
  // Reveal Card
  els.rewardStars.innerText = "⭐".repeat(stars) + "☆".repeat(3 - stars);
  els.rewardTitle.innerText = msgs[stars];
  els.rewardPoints.innerText = points;
  els.rewardXp.innerText = xp;
  els.rewardLevelText.innerText = `Player Lvl ${playerState.globalLevel}`;
  setTimeout(() => els.rewardProgressBar.style.width = `${(playerState.globalXP / playerState.xpToNext) * 100}%`, 100);
  
  speak("You did it! Check out your rewards!", "excited");
  updateHUD();
  setTimeout(() => els.rewardOverlay.classList.remove('hidden'), 1000);
}

// === INITIALIZATION & SETUP ===
function initLevel() {
  if (sessionState.timerInterval) clearInterval(sessionState.timerInterval);
  els.rewardOverlay.classList.add('hidden');
  
  sessionState.startTime = Date.now();
  sessionState.mistakes = 0;
  sessionState.hintsUsed = 0;
  sessionState.step = 0;
  sessionState.builtSlots = {};
  sessionState.puzzle = generatePuzzle();
  
  updateHUD();
  els.buildSpace.innerHTML = '';
  els.refGrid.innerHTML = '';
  els.trayContent.innerHTML = '';
  
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.index = i;
    els.buildSpace.appendChild(slot);
    const rSlot = document.createElement('div'); rSlot.className = 'slot';
    els.refGrid.appendChild(rSlot);
  }

  let pieces = [...sessionState.puzzle.piecesNeeded];
  // Decoys for creative/challenge or high levels
  if (sessionState.mode === 'challenge' || sessionState.mode === 'creative' || playerState.modeLevels[sessionState.mode] > 2) {
    pieces.push({ id: 'dec1', color: 'purple', type: 'block' });
  }
  
  pieces.sort(() => Math.random() - 0.5).forEach(p => {
    const b = document.createElement('div');
    b.className = `block bg-${p.color}`; b.dataset.color = p.color; b.dataset.id = p.id;
    els.trayContent.appendChild(b);
    setupDrag(b);
  });

  Object.entries(sessionState.puzzle.target).forEach(([idx, color]) => {
     const refSlot = els.refGrid.children[idx];
     const statB = document.createElement('div'); statB.className = `block-static bg-${color}`;
     refSlot.appendChild(statB);
  });

  setupMode();
  startFlowMonitor();
}

function setupMode() {
  els.refPanel.classList.add('hidden'); els.challengeStats.classList.add('hidden'); els.btnHint.classList.remove('hidden');

  switch (sessionState.mode) {
    case 'guided':
      els.progressText.innerText = `Step 0 of ${sessionState.puzzle.steps.length}`;
      els.progressBar.style.width = `0%`;
      const firstS = sessionState.puzzle.steps[0];
      document.querySelector(`.build-space .slot[data-index="${firstS.slot}"]`).classList.add('glow');
      speak(firstS.hint, "neutral");
      break;
      
    case 'creative':
      els.refPanel.classList.remove('hidden');
      els.progressText.innerText = `Pieces: 0 / ${Object.keys(sessionState.puzzle.target).length}`;
      els.progressBar.style.width = `0%`;
      speak("Creative mode! Try to build what you see in the Goal.", "happy");
      break;

    case 'memory':
      els.refPanel.classList.remove('hidden');
      sessionState.memoryPhase = 'memorize';
      
      // Memory timer gets shorter at higher levels
      let sec = Math.max(2, 6 - Math.floor(playerState.modeLevels.memory / 2));
      els.progressText.innerText = `Memorize! ${sec}s`;
      speak("Memorize the steps! You can do it.", "thoughtful");
      
      sessionState.timerInterval = setInterval(() => {
        sec--; els.progressText.innerText = `Memorize! ${sec}s`;
        if (sec <= 0) {
          clearInterval(sessionState.timerInterval);
          els.refPanel.classList.add('hidden');
          sessionState.memoryPhase = 'build';
          els.progressText.innerText = `Build from memory!`;
          speak("Now it's your turn. Show me what you remember!", "happy");
        }
      }, 1000);
      break;

    case 'challenge':
      els.challengeStats.classList.remove('hidden'); els.refPanel.classList.remove('hidden');
      sessionState.score = 0;
      
      // Timer scales dynamically based on pieces (approx 6s per piece initially, less as level scales)
      sessionState.timer = Object.keys(sessionState.puzzle.target).length * Math.max(3, 8 - sessionState.frustrationLevel);
      updateChallengeUI();
      speak("Beat the timer! Ready, set, go!", "excited");
      
      sessionState.timerInterval = setInterval(() => {
        sessionState.timer--; updateChallengeUI();
        if (sessionState.timer <= 0) {
          clearInterval(sessionState.timerInterval);
          speak("Time's up! Let's try again, I'll give you more time.", "concerned");
          // Flow: silent adjustment
          sessionState.frustrationLevel++;
          initLevel(); 
        }
      }, 1000);
      break;
  }
}

function updateChallengeUI() {
  els.scoreText.innerText = `Score: ${sessionState.score}`;
  els.timerText.innerText = `00:${sessionState.timer.toString().padStart(2, '0')}`;
}

// === EVENT LISTENERS ===
els.modeTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    els.modeTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    sessionState.mode = e.target.dataset.mode;
    initLevel();
  });
});

els.btnRestart.addEventListener('click', () => {
    sessionState.frustrationLevel++; // They restared, might be stuck
    speak("Let's restart! Fresh slate.", "happy");
    initLevel();
});

els.btnNextLevel.addEventListener('click', () => {
    initLevel();
});

els.btnHint.addEventListener('click', () => {
   sessionState.hintsUsed++;
   sessionState.lastInteractionTime = Date.now();
   
   if (sessionState.mode === 'guided') {
      speak("Try dragging a piece to the glowing box!", "happy");
   } else if (sessionState.mode === 'creative' || sessionState.mode === 'challenge') {
      const missing = Object.keys(sessionState.puzzle.target).find(k => !sessionState.builtSlots[k]);
      if (missing) {
         const slot = document.querySelector(`.build-space .slot[data-index="${missing}"]`);
         slot.classList.add('adaptive-glow');
         speak(`Try placing a ${sessionState.puzzle.target[missing]} block there.`, "excited");
         setTimeout(() => slot.classList.remove('adaptive-glow'), 2000);
      }
   } else if (sessionState.mode === 'memory') {
      els.refPanel.classList.remove('hidden');
      speak("Here's a quick peek!", "thoughtful");
      setTimeout(() => els.refPanel.classList.add('hidden'), 2000);
   }
});

// INITIALIZATION
if (window.lucide) window.lucide.createIcons();
initLevel();
