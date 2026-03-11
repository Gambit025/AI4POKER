(function () {
  'use strict';

  var ctx = null;
  var enabled = true;
  var masterGain = null;
  var MASTER_VOLUME = 0.35;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = MASTER_VOLUME;
      masterGain.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function resumeCtx() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function noise(duration) {
    var c = ensureCtx();
    if (!c) return null;
    var len = Math.ceil(c.sampleRate * duration);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ──── Chip Bet / Raise ────
  function playChipBet() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.06);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 6200; bp.Q.value = 1.8;
    var env = c.createGain();
    env.gain.setValueAtTime(0.7, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noiseNode.connect(bp); bp.connect(env); env.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.06);

    var osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 3800;
    var oscEnv = c.createGain();
    oscEnv.gain.setValueAtTime(0.3, now);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(oscEnv); oscEnv.connect(masterGain);
    osc.start(now); osc.stop(now + 0.05);

    var osc2 = c.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = 5400;
    var osc2Env = c.createGain();
    osc2Env.gain.setValueAtTime(0.15, now + 0.008);
    osc2Env.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc2.connect(osc2Env); osc2Env.connect(masterGain);
    osc2.start(now + 0.008); osc2.stop(now + 0.04);
  }

  // ──── Chip Call (softer) ────
  function playChipCall() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.05);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5000; bp.Q.value = 1.5;
    var env = c.createGain();
    env.gain.setValueAtTime(0.45, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noiseNode.connect(bp); bp.connect(env); env.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.05);

    var osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 3200;
    var oscEnv = c.createGain();
    oscEnv.gain.setValueAtTime(0.2, now);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(oscEnv); oscEnv.connect(masterGain);
    osc.start(now); osc.stop(now + 0.045);
  }

  // ──── Check (table knock) ────
  function playCheck() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 420;
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
    var env = c.createGain();
    env.gain.setValueAtTime(0.4, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(env); env.connect(masterGain);
    osc.start(now); osc.stop(now + 0.09);

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.025);
    var hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2000;
    var nEnv = c.createGain();
    nEnv.gain.setValueAtTime(0.15, now);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    noiseNode.connect(hp); hp.connect(nEnv); nEnv.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.03);
  }

  // ──── Fold (card swoosh) ────
  function playFold() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.22);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2800;
    bp.frequency.exponentialRampToValueAtTime(800, now + 0.22);
    bp.Q.value = 0.8;
    var env = c.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noiseNode.connect(bp); bp.connect(env); env.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.22);
  }

  // ──── Deal Card ────
  function playDealCard() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.04);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4500; bp.Q.value = 0.6;
    var env = c.createGain();
    env.gain.setValueAtTime(0.35, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noiseNode.connect(bp); bp.connect(env); env.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.045);

    var snap = c.createOscillator();
    snap.type = 'triangle'; snap.frequency.value = 2200;
    snap.frequency.exponentialRampToValueAtTime(800, now + 0.02);
    var snapEnv = c.createGain();
    snapEnv.gain.setValueAtTime(0.15, now);
    snapEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    snap.connect(snapEnv); snapEnv.connect(masterGain);
    snap.start(now); snap.stop(now + 0.03);
  }

  // ──── Community Card Flip ────
  function playCardFlip() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var noiseNode = c.createBufferSource();
    noiseNode.buffer = noise(0.06);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 0.7;
    var env = c.createGain();
    env.gain.setValueAtTime(0.4, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    noiseNode.connect(bp); bp.connect(env); env.connect(masterGain);
    noiseNode.start(now); noiseNode.stop(now + 0.06);

    var thump = c.createOscillator();
    thump.type = 'sine'; thump.frequency.value = 300;
    thump.frequency.exponentialRampToValueAtTime(120, now + 0.05);
    var thumpEnv = c.createGain();
    thumpEnv.gain.setValueAtTime(0.2, now + 0.01);
    thumpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    thump.connect(thumpEnv); thumpEnv.connect(masterGain);
    thump.start(now + 0.01); thump.stop(now + 0.065);
  }

  // ──── Win Chime ────
  function playWin() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      var t = now + i * 0.1;
      var osc = c.createOscillator();
      osc.type = 'sine'; osc.frequency.value = notes[i];
      var env = c.createGain();
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.25, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(env); env.connect(masterGain);
      osc.start(t); osc.stop(t + 0.36);

      var osc2 = c.createOscillator();
      osc2.type = 'sine'; osc2.frequency.value = notes[i] * 2;
      var env2 = c.createGain();
      env2.gain.setValueAtTime(0.001, t);
      env2.gain.linearRampToValueAtTime(0.08, t + 0.02);
      env2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc2.connect(env2); env2.connect(masterGain);
      osc2.start(t); osc2.stop(t + 0.26);
    }

    for (var j = 0; j < 6; j++) {
      var ct = now + 0.05 + j * 0.06;
      var cn = c.createBufferSource();
      cn.buffer = noise(0.03);
      var cbp = c.createBiquadFilter();
      cbp.type = 'bandpass'; cbp.frequency.value = 5500 + Math.random() * 2000; cbp.Q.value = 2;
      var cenv = c.createGain();
      cenv.gain.setValueAtTime(0.12, ct);
      cenv.gain.exponentialRampToValueAtTime(0.001, ct + 0.03);
      cn.connect(cbp); cbp.connect(cenv); cenv.connect(masterGain);
      cn.start(ct); cn.stop(ct + 0.035);
    }
  }

  // ──── All-In (chip cascade) ────
  function playAllIn() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    for (var i = 0; i < 8; i++) {
      var t = now + i * 0.04 + Math.random() * 0.02;
      var n = c.createBufferSource();
      n.buffer = noise(0.05);
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 4000 + Math.random() * 4000;
      bp.Q.value = 1.5 + Math.random();
      var env = c.createGain();
      var vol = 0.25 + Math.random() * 0.25;
      env.gain.setValueAtTime(vol, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(bp); bp.connect(env); env.connect(masterGain);
      n.start(t); n.stop(t + 0.055);

      var o = c.createOscillator();
      o.type = 'sine'; o.frequency.value = 3000 + Math.random() * 3000;
      var oEnv = c.createGain();
      oEnv.gain.setValueAtTime(0.1, t);
      oEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      o.connect(oEnv); oEnv.connect(masterGain);
      o.start(t); o.stop(t + 0.04);
    }

    var sweep = c.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(200, now);
    sweep.frequency.exponentialRampToValueAtTime(800, now + 0.35);
    var sEnv = c.createGain();
    sEnv.gain.setValueAtTime(0.1, now);
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sweep.connect(sEnv); sEnv.connect(masterGain);
    sweep.start(now); sweep.stop(now + 0.36);
  }

  // ──── Your Turn notification ────
  function playYourTurn() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 880;
    var env = c.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.18, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(env); env.connect(masterGain);
    osc.start(now); osc.stop(now + 0.21);

    var osc2 = c.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = 1320;
    var env2 = c.createGain();
    env2.gain.setValueAtTime(0.001, now + 0.08);
    env2.gain.linearRampToValueAtTime(0.12, now + 0.095);
    env2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(env2); env2.connect(masterGain);
    osc2.start(now + 0.08); osc2.stop(now + 0.29);
  }

  // ──── UI Button Click ────
  function playUIClick() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    var osc = c.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 1800;
    var env = c.createGain();
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(env); env.connect(masterGain);
    osc.start(now); osc.stop(now + 0.035);
  }

  // ──── New Hand Shuffle ────
  function playShuffle() {
    var c = ensureCtx(); if (!c || !enabled) return; resumeCtx();
    var now = c.currentTime;

    for (var i = 0; i < 5; i++) {
      var t = now + i * 0.06;
      var n = c.createBufferSource();
      n.buffer = noise(0.07);
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000 + i * 600;
      bp.Q.value = 0.5;
      var env = c.createGain();
      env.gain.setValueAtTime(0.2, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      n.connect(bp); bp.connect(env); env.connect(masterGain);
      n.start(t); n.stop(t + 0.07);
    }
  }

  window.PokerSounds = {
    init: function () { ensureCtx(); },
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
    chipBet: playChipBet,
    chipCall: playChipCall,
    check: playCheck,
    fold: playFold,
    dealCard: playDealCard,
    cardFlip: playCardFlip,
    win: playWin,
    allIn: playAllIn,
    yourTurn: playYourTurn,
    uiClick: playUIClick,
    shuffle: playShuffle
  };
})();
