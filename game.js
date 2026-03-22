(function () {
  "use strict";

  const CHARSET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  const SEQUENCE_LEN = 8;
  const SHOW_MS = 2000;
  const GAP_MS = 500;
  const TRIALS_TOTAL = 4;
  const PRACTICE_ROUNDS = 2;

  const STRICT_EXPLAIN =
    "<strong>Strict mode.</strong> If you type a wrong letter, you will hear a buzzer. " +
    "When you type the correct letter, there is no sound—only mistakes are signaled by audio.";

  const POSITIVE_EXPLAIN =
    "<strong>Positive mode.</strong> Each time you type the correct letter, you will hear a short ding. " +
    "If you type a wrong letter, there is no buzzer—only correct keys are reinforced with sound.";

  const welcome = document.getElementById("welcome");
  const practiceIntro = document.getElementById("practiceIntro");
  const practiceMid = document.getElementById("practiceMid");
  const practiceResult = document.getElementById("practiceResult");
  const practiceIntroTitle = document.getElementById("practiceIntroTitle");
  const practiceIntroExplain = document.getElementById("practiceIntroExplain");
  const practiceMidMsg = document.getElementById("practiceMidMsg");
  const practiceResultsList = document.getElementById("practiceResultsList");
  const setup = document.getElementById("setup");
  const play = document.getElementById("play");
  const finalResult = document.getElementById("finalResult");
  const btnBeginPractice = document.getElementById("btnBeginPractice");
  const btnStartPracticeRound = document.getElementById("btnStartPracticeRound");
  const btnContinuePractice2 = document.getElementById("btnContinuePractice2");
  const btnToRealSetup = document.getElementById("btnToRealSetup");
  const btnStart = document.getElementById("btnStart");
  const btnAgain = document.getElementById("btnAgain");
  const btnDownloadAgain = document.getElementById("btnDownloadAgain");
  const btnNextTrial = document.getElementById("btnNextTrial");
  const sequenceChar = document.getElementById("sequenceChar");
  const inputPanel = document.getElementById("inputPanel");
  const typedDisplay = document.getElementById("typedDisplay");
  const positionLabel = document.getElementById("positionLabel");
  const trialBadge = document.getElementById("trialBadge");
  const trialAdvance = document.getElementById("trialAdvance");
  const trialAdvanceMsg = document.getElementById("trialAdvanceMsg");
  const resultsList = document.getElementById("resultsList");
  const realSummary = document.getElementById("realSummary");
  const trialTimer = document.getElementById("trialTimer");
  const downloadNote = document.getElementById("downloadNote");

  let audioCtx = null;
  /** @type {number|null} */
  let inputPhaseStartMs = null;
  /** @type {ReturnType<typeof setInterval>|null} */
  let timerIntervalId = null;
  let mode = "strict";
  let target = "";
  let userInput = "";
  let acceptingInput = false;

  /** @type {'idle'|'practice'|'real'} */
  let playContext = "idle";
  let practiceRound = 0;
  /** @type {string[]} */
  let practiceModeOrder = ["strict", "positive"];

  /** @type {{ firstMode: string, secondMode: string, trialIndex: number, results: Array<{trialNumber:number,mode:string,target:string,userInput:string,correct:boolean}> }} */
  let session = {
    firstMode: "strict",
    secondMode: "positive",
    trialIndex: 1,
    results: [],
  };

  /** @type {{ id: string, startedAt: string, practiceModeOrder: string[], practice: Array<{round:number,mode:string,target:string,userInput:string,correct:boolean,timeSeconds:number,accuracyPercent:number}>, realFirstMode: string, realSecondMode: string, real: Array<{trialNumber:number,mode:string,target:string,userInput:string,correct:boolean,timeSeconds:number,accuracyPercent:number}> }} */
  let sessionLog = {
    id: "",
    startedAt: "",
    practiceModeOrder: [],
    practice: [],
    realFirstMode: "",
    realSecondMode: "",
    real: [],
  };

  function newSessionId() {
    return (
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function assignSessionModes() {
    session.firstMode = Math.random() < 0.5 ? "strict" : "positive";
    session.secondMode = session.firstMode === "strict" ? "positive" : "strict";
  }

  function assignPracticeOrder() {
    if (Math.random() < 0.5) {
      practiceModeOrder = ["strict", "positive"];
    } else {
      practiceModeOrder = ["positive", "strict"];
    }
  }

  function modeLabel(m) {
    return m === "strict" ? "Strict" : "Positive";
  }

  function getModeForTrial(trialNumber) {
    return trialNumber <= 2 ? session.firstMode : session.secondMode;
  }

  function updateTrialBadge() {
    if (playContext === "practice") {
      trialBadge.textContent =
        "Practice · " +
        modeLabel(mode) +
        " · Round " +
        (practiceRound + 1) +
        " of " +
        PRACTICE_ROUNDS;
    } else {
      trialBadge.textContent =
        modeLabel(mode) +
        " · Trial " +
        session.trialIndex +
        " of " +
        TRIALS_TOTAL;
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBuzzer() {
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.25);
    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  function playDing() {
    const ctx = getAudioContext();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08);
    gain.gain.setValueAtTime(0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  function generateSequence() {
    let s = "";
    for (let i = 0; i < SEQUENCE_LEN; i++) s += randomChar();
    return s;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function updatePositionLabel() {
    positionLabel.textContent =
      "Position: " + userInput.length + " / " + SEQUENCE_LEN;
  }

  function computeAccuracy(targetStr, userStr) {
    let matches = 0;
    for (let i = 0; i < SEQUENCE_LEN; i++) {
      if (userStr[i] === targetStr[i]) matches++;
    }
    return (matches / SEQUENCE_LEN) * 100;
  }

  function stopRecallTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    inputPhaseStartMs = null;
    trialTimer.classList.add("hidden");
  }

  function startRecallTimer() {
    stopRecallTimer();
    inputPhaseStartMs = performance.now();
    trialTimer.classList.remove("hidden");
    trialTimer.textContent = "0.0 s";
    timerIntervalId = setInterval(function () {
      if (inputPhaseStartMs === null) return;
      const elapsed = (performance.now() - inputPhaseStartMs) / 1000;
      trialTimer.textContent = elapsed.toFixed(1) + " s";
    }, 100);
  }

  function measureRecallSeconds() {
    if (inputPhaseStartMs === null) return 0;
    return (performance.now() - inputPhaseStartMs) / 1000;
  }

  function finalizeTrialMetrics(targetStr, userStr) {
    const timeSeconds = measureRecallSeconds();
    const accuracyPercent = computeAccuracy(targetStr, userStr);
    return {
      timeSeconds: Math.round(timeSeconds * 100) / 100,
      accuracyPercent: Math.round(accuracyPercent * 10) / 10,
    };
  }

  function hideAllMainPanels() {
    welcome.classList.add("hidden");
    practiceIntro.classList.add("hidden");
    practiceMid.classList.add("hidden");
    practiceResult.classList.add("hidden");
    setup.classList.add("hidden");
    play.classList.add("hidden");
    finalResult.classList.add("hidden");
    trialBadge.classList.add("hidden");
    trialAdvance.classList.add("hidden");
    stopRecallTimer();
  }

  function showWelcomeView() {
    hideAllMainPanels();
    welcome.classList.remove("hidden");
    sequenceChar.textContent = "";
    inputPanel.classList.add("hidden");
    acceptingInput = false;
    userInput = "";
    target = "";
    playContext = "idle";
  }

  function fillPracticeIntro(roundIndex) {
    mode = practiceModeOrder[roundIndex];
    practiceIntroTitle.textContent =
      "Practice round " + (roundIndex + 1) + " of 2: " + modeLabel(mode);
    practiceIntroExplain.innerHTML =
      mode === "strict" ? STRICT_EXPLAIN : POSITIVE_EXPLAIN;
  }

  function showPracticeIntro(roundIndex) {
    hideAllMainPanels();
    practiceRound = roundIndex;
    fillPracticeIntro(roundIndex);
    practiceIntro.classList.remove("hidden");
  }

  function showPracticeMidScreen() {
    hideAllMainPanels();
    const nextMode = practiceModeOrder[1];
    practiceMidMsg.textContent =
      "Practice round 1 complete. Next: " +
      modeLabel(nextMode) +
      " mode. Press Continue to read how it works.";
    practiceMid.classList.remove("hidden");
  }

  function renderPracticeResults() {
    practiceResultsList.innerHTML = "";
    for (let i = 0; i < sessionLog.practice.length; i++) {
      const r = sessionLog.practice[i];
      const block = document.createElement("div");
      block.className = "result-block";
      const head = document.createElement("p");
      head.className = "result-block-head";
      head.textContent =
        "Practice " + r.round + " · " + modeLabel(r.mode);
      block.appendChild(head);
      block.appendChild(makeResultLines(r));
      practiceResultsList.appendChild(block);
    }
  }

  function makeResultLines(r) {
    const frag = document.createDocumentFragment();
    const correctLine = document.createElement("p");
    correctLine.className = "result-line";
    correctLine.innerHTML =
      '<span class="result-label">Correct:</span> <span class="result-seq">' +
      escapeHtml(r.target) +
      "</span>";
    const yoursLine = document.createElement("p");
    yoursLine.className = "result-line";
    yoursLine.innerHTML =
      '<span class="result-label">Yours:</span> <span class="result-seq">' +
      escapeHtml(r.userInput) +
      "</span>";
    const status = document.createElement("p");
    status.className =
      "result-status " + (r.correct ? "result-status-ok" : "result-status-bad");
    status.textContent = r.correct ? "Full match" : "Did not match";
    const meta = document.createElement("p");
    meta.className = "result-meta";
    meta.textContent =
      "Time: " +
      r.timeSeconds.toFixed(2) +
      " s · Accuracy: " +
      r.accuracyPercent.toFixed(1) +
      "%";
    frag.appendChild(correctLine);
    frag.appendChild(yoursLine);
    frag.appendChild(status);
    frag.appendChild(meta);
    return frag;
  }

  function showPracticeResultsView() {
    hideAllMainPanels();
    renderPracticeResults();
    practiceResult.classList.remove("hidden");
  }

  function showRealSetupView() {
    hideAllMainPanels();
    assignSessionModes();
    sessionLog.realFirstMode = session.firstMode;
    sessionLog.realSecondMode = session.secondMode;
    setup.classList.remove("hidden");
  }

  function beginSession() {
    session.trialIndex = 1;
    session.results = [];
    sessionLog.real = [];
    mode = getModeForTrial(1);
    target = generateSequence();
    playContext = "real";
    hideAllMainPanels();
    play.classList.remove("hidden");
    trialBadge.classList.remove("hidden");
    trialAdvance.classList.add("hidden");
    sequenceChar.classList.remove("hidden");
    updateTrialBadge();
    runSequence();
  }

  function showFinalResults() {
    stopRecallTimer();
    play.classList.add("hidden");
    trialBadge.classList.add("hidden");
    finalResult.classList.remove("hidden");
    resultsList.innerHTML = "";
    for (let i = 0; i < session.results.length; i++) {
      const r = session.results[i];
      const block = document.createElement("div");
      block.className = "result-block";
      const head = document.createElement("p");
      head.className = "result-block-head";
      head.textContent =
        "Trial " + r.trialNumber + " · " + modeLabel(r.mode);
      block.appendChild(head);
      block.appendChild(makeResultLines(r));
      resultsList.appendChild(block);
    }
    fillRealSummary();
    downloadSessionLog();
  }

  function fillRealSummary() {
    const rows = session.results;
    if (rows.length === 0) {
      realSummary.innerHTML = "";
      return;
    }
    let sumAcc = 0;
    let sumTime = 0;
    for (let i = 0; i < rows.length; i++) {
      sumAcc += rows[i].accuracyPercent;
      sumTime += rows[i].timeSeconds;
    }
    const n = rows.length;
    const meanAcc = sumAcc / n;
    const meanTime = sumTime / n;
    const title = document.createElement("p");
    title.className = "summary-box-title";
    title.textContent = "Summary (all real trials)";
    const pAcc = document.createElement("p");
    pAcc.innerHTML =
      "<strong>Mean accuracy:</strong> " + meanAcc.toFixed(1) + "%";
    const pMean = document.createElement("p");
    pMean.innerHTML =
      "<strong>Mean recall time:</strong> " + meanTime.toFixed(2) + " s";
    const pTot = document.createElement("p");
    pTot.innerHTML =
      "<strong>Total recall time:</strong> " + sumTime.toFixed(2) + " s";
    realSummary.innerHTML = "";
    realSummary.appendChild(title);
    realSummary.appendChild(pAcc);
    realSummary.appendChild(pMean);
    realSummary.appendChild(pTot);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function buildLogText() {
    const lines = [];
    lines.push("SESSION LOG — Memory Sequence");
    lines.push("session_id=" + sessionLog.id);
    lines.push("started_at=" + sessionLog.startedAt);
    lines.push("");
    lines.push("=== PRACTICE ===");
    lines.push(
      "practice_mode_order=" + sessionLog.practiceModeOrder.join(" then ")
    );
    for (let i = 0; i < sessionLog.practice.length; i++) {
      const r = sessionLog.practice[i];
      lines.push("");
      lines.push(
        "[practice round " + r.round + " | mode=" + r.mode + "]"
      );
      lines.push("correct_sequence=" + r.target);
      lines.push("user_sequence=" + r.userInput);
      lines.push("full_match=" + r.correct);
      lines.push("time_seconds_recall=" + r.timeSeconds);
      lines.push("accuracy_percent=" + r.accuracyPercent);
      if (!r.correct) {
        lines.push(
          "WRONG_PAIR: correct=" +
            JSON.stringify(r.target) +
            " | user=" +
            JSON.stringify(r.userInput)
        );
      }
    }
    lines.push("");
    lines.push("=== REAL TRIALS ===");
    lines.push(
      "block1_mode=" +
        sessionLog.realFirstMode +
        " (trials 1-2) | block2_mode=" +
        sessionLog.realSecondMode +
        " (trials 3-4)"
    );
    for (let i = 0; i < sessionLog.real.length; i++) {
      const r = sessionLog.real[i];
      lines.push("");
      lines.push(
        "[real trial " + r.trialNumber + " | mode=" + r.mode + "]"
      );
      lines.push("correct_sequence=" + r.target);
      lines.push("user_sequence=" + r.userInput);
      lines.push("full_match=" + r.correct);
      lines.push("time_seconds_recall=" + r.timeSeconds);
      lines.push("accuracy_percent=" + r.accuracyPercent);
      if (!r.correct) {
        lines.push(
          "WRONG_PAIR: correct=" +
            JSON.stringify(r.target) +
            " | user=" +
            JSON.stringify(r.userInput)
        );
      }
    }
    lines.push("");
    lines.push("=== REAL TRIALS SUMMARY ===");
    if (sessionLog.real.length > 0) {
      let sumAcc = 0;
      let sumTime = 0;
      for (let j = 0; j < sessionLog.real.length; j++) {
        sumAcc += sessionLog.real[j].accuracyPercent;
        sumTime += sessionLog.real[j].timeSeconds;
      }
      const nr = sessionLog.real.length;
      lines.push("mean_accuracy_percent=" + (sumAcc / nr).toFixed(2));
      lines.push("mean_time_seconds_recall=" + (sumTime / nr).toFixed(2));
      lines.push("total_time_seconds_recall=" + sumTime.toFixed(2));
    }
    lines.push("");
    lines.push("=== END ===");
    return lines.join("\n");
  }

  function downloadSessionLog() {
    const text = buildLogText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "memory-sequence-" + sessionLog.id + ".txt";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showTrialAdvanceScreen() {
    stopRecallTimer();
    sequenceChar.textContent = "";
    sequenceChar.classList.add("hidden");
    inputPanel.classList.add("hidden");
    trialAdvance.classList.remove("hidden");
    trialAdvanceMsg.textContent =
      "Trial " + session.trialIndex + " of " + TRIALS_TOTAL + " complete.";
  }

  function continueToNextTrial() {
    session.trialIndex += 1;
    mode = getModeForTrial(session.trialIndex);
    target = generateSequence();
    trialAdvance.classList.add("hidden");
    sequenceChar.classList.remove("hidden");
    updateTrialBadge();
    runSequence();
  }

  async function runSequence() {
    stopRecallTimer();
    sequenceChar.textContent = "";
    inputPanel.classList.add("hidden");
    acceptingInput = false;

    for (let i = 0; i < target.length; i++) {
      sequenceChar.textContent = target[i];
      await sleep(SHOW_MS);
      sequenceChar.textContent = "";
      if (i < target.length - 1) await sleep(GAP_MS);
    }

    userInput = "";
    typedDisplay.textContent = "";
    updatePositionLabel();
    inputPanel.classList.remove("hidden");
    acceptingInput = true;
    startRecallTimer();
  }

  function onPracticeComplete() {
    acceptingInput = false;
    const metrics = finalizeTrialMetrics(target, userInput);
    stopRecallTimer();
    const fullMatch = userInput === target;
    const record = {
      round: practiceRound + 1,
      mode: mode,
      target: target,
      userInput: userInput,
      correct: fullMatch,
      timeSeconds: metrics.timeSeconds,
      accuracyPercent: metrics.accuracyPercent,
    };
    sessionLog.practice.push(record);

    if (practiceRound === 0) {
      showPracticeMidScreen();
    } else {
      showPracticeResultsView();
    }
  }

  function onTrialInputComplete() {
    acceptingInput = false;
    const metrics = finalizeTrialMetrics(target, userInput);
    stopRecallTimer();
    const fullMatch = userInput === target;
    const row = {
      trialNumber: session.trialIndex,
      mode: mode,
      target: target,
      userInput: userInput,
      correct: fullMatch,
      timeSeconds: metrics.timeSeconds,
      accuracyPercent: metrics.accuracyPercent,
    };
    session.results.push(row);
    sessionLog.real.push(row);

    if (session.trialIndex < TRIALS_TOTAL) {
      showTrialAdvanceScreen();
    } else {
      showFinalResults();
    }
  }

  function onKeyDown(e) {
    if (!acceptingInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Backspace" || e.key === "Escape") {
      e.preventDefault();
      return;
    }
    if (e.key.length !== 1) return;

    const ch = e.key;
    if (!CHARSET.includes(ch)) return;

    e.preventDefault();

    const idx = userInput.length;
    if (idx >= SEQUENCE_LEN) return;

    const expected = target[idx];
    const correct = ch === expected;

    if (mode === "strict") {
      if (!correct) playBuzzer();
    } else {
      if (correct) playDing();
    }

    userInput += ch;
    typedDisplay.textContent = userInput;
    updatePositionLabel();

    if (userInput.length === SEQUENCE_LEN) {
      if (playContext === "practice") {
        onPracticeComplete();
      } else {
        onTrialInputComplete();
      }
    }
  }

  btnBeginPractice.addEventListener("click", function () {
    getAudioContext();
    sessionLog.id = newSessionId();
    sessionLog.startedAt = new Date().toISOString();
    sessionLog.practice = [];
    sessionLog.real = [];
    assignPracticeOrder();
    sessionLog.practiceModeOrder = practiceModeOrder.slice();
    showPracticeIntro(0);
  });

  btnStartPracticeRound.addEventListener("click", function () {
    getAudioContext();
    mode = practiceModeOrder[practiceRound];
    target = generateSequence();
    playContext = "practice";
    hideAllMainPanels();
    play.classList.remove("hidden");
    trialBadge.classList.remove("hidden");
    trialAdvance.classList.add("hidden");
    sequenceChar.classList.remove("hidden");
    updateTrialBadge();
    runSequence();
  });

  btnContinuePractice2.addEventListener("click", function () {
    showPracticeIntro(1);
  });

  btnToRealSetup.addEventListener("click", function () {
    showRealSetupView();
  });

  btnStart.addEventListener("click", function () {
    getAudioContext();
    beginSession();
  });

  btnNextTrial.addEventListener("click", function () {
    continueToNextTrial();
  });

  btnAgain.addEventListener("click", function () {
    showWelcomeView();
  });

  btnDownloadAgain.addEventListener("click", function () {
    downloadSessionLog();
  });

  window.addEventListener("keydown", onKeyDown);
})();
