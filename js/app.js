(function () {
  var SUIT_SYM = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
  var SUIT_RED = { h: true, d: true };
  var RANK_STR = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  var SPEED_MS = { slow: 1200, medium: 700, fast: 300 };

  var AVATAR_COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  var STREET_NAMES = ['Pre', 'Flop', 'Turn', 'River'];

  function rankStr(r) {
    return RANK_STR[r] || String(r);
  }

  function renderCard(card, faceDown) {
    var div = document.createElement('div');
    div.className = 'card';
    if (faceDown) {
      div.classList.add('back');
      return div;
    }
    if (SUIT_RED[card.suit]) div.classList.add('red');
    var rank = document.createElement('span');
    rank.className = 'card-rank';
    rank.textContent = rankStr(card.rank);
    var suit = document.createElement('span');
    suit.className = 'card-suit';
    suit.textContent = SUIT_SYM[card.suit];
    var center = document.createElement('span');
    center.className = 'card-center-suit';
    center.textContent = SUIT_SYM[card.suit];
    div.appendChild(rank);
    div.appendChild(suit);
    div.appendChild(center);
    return div;
  }

  function renderCards(container, cards, faceDown) {
    if (!container) return;
    container.innerHTML = '';
    (cards || []).forEach(function (c) {
      container.appendChild(renderCard(c, faceDown));
    });
  }

  var mcWorker = null;
  var mcCallbacks = {};
  var mcIdCounter = 0;
  try { mcWorker = new Worker('js/mcWorker.js'); } catch (e) { mcWorker = null; }
  if (mcWorker) {
    mcWorker.onmessage = function (e) {
      var cb = mcCallbacks[e.data.id];
      if (cb) { delete mcCallbacks[e.data.id]; cb(e.data.result); }
    };
  }
  function mcCompute(type, hand, community, sims, callback) {
    if (!mcWorker) { callback(null); return; }
    var id = ++mcIdCounter;
    mcCallbacks[id] = callback;
    mcWorker.postMessage({ id: id, type: type, hand: hand, community: community, sims: sims });
  }

  var game = null;
  var PLAYER_COUNT = 2;
  var dealPhase = false;
  var prevCommunityLength = 0;
  var gameHasStarted = false;
  var sessionInitialChips = 0;
  var winSoundPlayed = false;
  var currentSettings = {
    playerCount: 2,
    speed: 'medium',
    sb: 5,
    bb: 10,
    aiAssist: true
  };

  function showScreen(screenId) {
    ['home-screen', 'settings-screen', 'game-screen'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === screenId) {
        el.classList.remove('hidden');
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
      } else {
        el.classList.add('hidden');
      }
    });
  }

  function getBetInputValue() {
    var el = document.getElementById('panel-bet-input');
    return el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
  }

  function setBetInputValue(v) {
    var el = document.getElementById('panel-bet-input');
    if (el) el.value = String(Math.max(0, Math.floor(v)));
  }

  function updateCallBetButton() {
    if (!game) return;
    var toCall = game.getToCall();
    var btn = document.getElementById('btn-call');
    if (!btn) return;
    var gs = game.getState();
    var minRaise = gs.minRaise || 10;
    if (toCall > 0) {
      var inputVal = getBetInputValue();
      if (inputVal > toCall) {
        btn.textContent = 'Raise $' + inputVal;
      } else {
        btn.textContent = 'Call $' + toCall;
      }
    } else {
      var inputVal2 = getBetInputValue();
      if (inputVal2 > 0 && inputVal2 < minRaise) inputVal2 = minRaise;
      btn.textContent = inputVal2 > 0 ? 'Bet $' + inputVal2 : 'Bet';
    }
  }

  function updateStreetIndicator(street) {
    var steps = document.querySelectorAll('#street-indicator .street-step');
    steps.forEach(function (step) {
      var s = parseInt(step.getAttribute('data-street'), 10);
      step.classList.remove('active', 'past');
      if (s === street) step.classList.add('active');
      else if (s < street) step.classList.add('past');
    });
  }

  function renderGameSeats() {
    var container = document.getElementById('game-seats');
    if (!container || !window.getVisibleSeatIndices) return;
    container.innerHTML = '';
    var visible = window.getVisibleSeatIndices(PLAYER_COUNT);
    var names = ['\u4F60', 'Robot A', 'Robot B', 'Robot C', 'Robot D', 'Robot E', 'Robot F', 'Robot G', 'Robot H', 'Robot I'];
    for (var i = 0; i < PLAYER_COUNT; i++) {
      var seatPos = visible[i];
      var pos = window.getPositionForSeatIndex(seatPos);
      var side = window.getSideForSeatIndex ? window.getSideForSeatIndex(seatPos) : 'bottom';
      var seat = document.createElement('div');
      seat.className = 'seat-item seat-' + side;
      seat.setAttribute('data-seat-index', seatPos);
      seat.setAttribute('data-player-index', i);
      seat.style.left = pos.left;
      seat.style.top = pos.top;
      var isHero = i === 0;
      var displayName = names[i] || ('Bot ' + i);
      var pillClass = isHero ? 'seat-pill-hero' : 'seat-pill-robot';
      var avatarClass = isHero ? 'avatar avatar-hero' : 'avatar avatar-robot';
      var colorIdx = isHero ? 0 : AVATAR_COLORS[(i % (AVATAR_COLORS.length - 1)) + 1];
      seat.innerHTML =
        '<div class="seat-bet-inside" id="player-' + i + '-bet-amount"></div>' +
        '<div class="seat-outside">' +
          '<div class="turn-indicator hidden" id="player-' + i + '-turn"></div>' +
          '<div class="seat-row seat-row-avatar">' +
            '<div class="' + avatarClass + '" data-color="' + colorIdx + '">' +
              '<span class="badge hidden" id="player-' + i + '-badge">SB</span>' +
            '</div>' +
          '</div>' +
          '<div class="seat-pill ' + pillClass + '">' + displayName + '</div>' +
          '<div class="seat-row seat-row-stack"><span class="seat-stack" id="player-' + i + '-stack">$0</span></div>' +
          '<div class="seat-hand-desc hidden" id="player-' + i + '-hand-desc"></div>' +
          '<div class="seat-row seat-row-cards" id="player-' + i + '-cards"></div>' +
        '</div>';
      if (isHero) seat.classList.add('seat-hero');
      else seat.classList.add('seat-robot');
      container.appendChild(seat);
    }
  }

  function renderDealerButton(dealerIdx) {
    var existing = document.querySelector('.dealer-btn');
    if (existing) existing.remove();
    var seatEl = document.querySelector('.seat-item[data-player-index="' + dealerIdx + '"]');
    if (!seatEl) return;
    var btn = document.createElement('div');
    btn.className = 'dealer-btn';
    btn.textContent = 'D';
    var avatarEl = seatEl.querySelector('.avatar');
    if (avatarEl) {
      avatarEl.parentNode.style.position = 'relative';
      btn.style.position = 'absolute';
      btn.style.bottom = '-4px';
      btn.style.right = '-4px';
      avatarEl.parentNode.appendChild(btn);
    }
  }

  function spawnConfetti(banner) {
    if (!banner) return;
    var rect = banner.getBoundingClientRect();
    var parent = banner.parentNode;
    var colors = ['#fbbf24', '#22c55e', '#ef4444', '#60a5fa', '#a78bfa', '#f97316'];
    for (var i = 0; i < 12; i++) {
      var dot = document.createElement('div');
      dot.className = 'win-confetti';
      dot.style.left = (rect.width / 2 + (Math.random() - 0.5) * rect.width) + 'px';
      dot.style.top = '0px';
      dot.style.background = colors[Math.floor(Math.random() * colors.length)];
      dot.style.animationDelay = (Math.random() * 0.4) + 's';
      dot.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
      var angle = -30 - Math.random() * 120;
      var dist = 30 + Math.random() * 50;
      var dx = Math.cos(angle * Math.PI / 180) * dist;
      var dy = Math.sin(angle * Math.PI / 180) * dist;
      dot.style.setProperty('--confetti-dx', dx + 'px');
      dot.style.setProperty('--confetti-dy', dy + 'px');
      banner.style.position = 'relative';
      banner.appendChild(dot);
      (function (d) {
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1500);
      })(dot);
    }
  }

  function render(showCardsForFoldAnimation) {
    if (!game) return;
    var s = game.getState();
    var players = s.players;

    var potEl = document.getElementById('table-pot-badge');
    if (potEl) potEl.textContent = '$' + s.pot;

    updateStreetIndicator(s.street >= 4 ? 3 : s.street);

    var heroPlayer = players[0];
    var heroEffective = heroPlayer
      ? (s.handOver ? heroPlayer.chips : heroPlayer.chips + (heroPlayer.totalBetThisHand || 0))
      : 0;
    var topStackEl = document.getElementById('top-chips-stack');
    var topPlEl = document.getElementById('top-chips-pl');
    if (topStackEl) topStackEl.textContent = heroEffective < 0 ? '-$' + Math.abs(heroEffective) : '$' + heroEffective;
    if (topPlEl) {
      var plVal = heroEffective - sessionInitialChips;
      topPlEl.textContent = plVal >= 0 ? '+$' + plVal : '-$' + Math.abs(plVal);
      topPlEl.className = 'top-chips-pl ' + (plVal > 0 ? 'pl-positive' : (plVal < 0 ? 'pl-negative' : 'pl-zero'));
    }

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var seatEl = document.querySelector('#game-seats .seat-item[data-player-index="' + i + '"]');
      if (seatEl) {
        seatEl.classList.toggle('seat-folded', p.isFolded);
        seatEl.classList.toggle('seat-active-turn', s.currentPlayerIndex === i && !s.handOver);
      }
      var stackEl = document.getElementById('player-' + i + '-stack');
      var betEl = document.getElementById('player-' + i + '-bet-amount');
      var cardsEl = document.getElementById('player-' + i + '-cards');
      var badgeEl = document.getElementById('player-' + i + '-badge');
      var descEl = document.getElementById('player-' + i + '-hand-desc');
      if (stackEl) {
        stackEl.textContent = p.chips < 0 ? '-$' + Math.abs(p.chips) : '$' + p.chips;
        stackEl.classList.toggle('stack-negative', p.chips < 0);
      }
      if (betEl) betEl.textContent = (!s.handOver && p.currentBet > 0) ? '$' + p.currentBet : '';
      var faceDown = !p.isHuman && !s.handOver;
      var showCards = !dealPhase && (!p.isFolded || showCardsForFoldAnimation === i);
      if (s.handOver && p.isFolded) showCards = false;
      if (cardsEl && !dealPhase) renderCards(cardsEl, showCards ? p.hand : [], faceDown);
      var isPreflop = s.street === 0;
      var sbPos = s.sbPosition != null ? s.sbPosition : 0;
      var bbPos = s.bbPosition != null ? s.bbPosition : 1;
      if (badgeEl) {
        if (i === sbPos && isPreflop) { badgeEl.textContent = 'SB'; badgeEl.classList.remove('hidden'); }
        else if (i === bbPos && isPreflop) { badgeEl.textContent = 'BB'; badgeEl.classList.remove('hidden'); }
        else badgeEl.classList.add('hidden');
      }
      if (descEl) descEl.classList.add('hidden');
    }

    if (s.dealerButtonIndex != null) renderDealerButton(s.dealerButtonIndex);

    var communityEl = document.getElementById('community-cards');
    if (communityEl) {
      renderCards(communityEl, s.communityCards, false);
      var len = (s.communityCards || []).length;
      for (var ci = prevCommunityLength; ci < len && ci < communityEl.children.length; ci++) {
        var cardEl = communityEl.children[ci];
        cardEl.classList.add('community-card-reveal');
        cardEl.style.animationDelay = ((ci - prevCommunityLength) * 120) + 'ms';
        if (window.PokerSounds) {
          (function (delay) { setTimeout(function () { PokerSounds.cardFlip(); }, delay); })((ci - prevCommunityLength) * 120);
        }
      }
      prevCommunityLength = len;
    }

    var winnerBanner = document.getElementById('winner-banner');
    if (s.handOver && (s.winnerIndex != null || (s.winnerIndices && s.winnerIndices.length))) {
      var indices = s.winnerIndices && s.winnerIndices.length ? s.winnerIndices : [s.winnerIndex];
      var winNames = indices.map(function (idx) {
        return s.players[idx].name === '\u4F60' ? '\u4F60' : s.players[idx].name;
      }).join('\u3001');
      if (winnerBanner) {
        winnerBanner.textContent = winNames + (indices.length > 1 ? ' \u5E73\u5206' : ' \u83B7\u80DC');
        winnerBanner.classList.remove('hidden');
        winnerBanner.style.animation = 'none';
        winnerBanner.offsetHeight;
        winnerBanner.style.animation = '';
        spawnConfetti(winnerBanner);
        if (window.PokerSounds && !winSoundPlayed) { PokerSounds.win(); winSoundPlayed = true; }
      }
      for (var j = 0; j < players.length; j++) {
        var desc = document.getElementById('player-' + j + '-hand-desc');
        if (desc && players[j].hand.length === 2 && !players[j].isFolded) {
          var eval_ = window.bestHand && window.bestHand(players[j].hand.concat(s.communityCards));
          var rankName = eval_ && window.HAND_RANK_ZH && window.HAND_RANK_ZH[eval_.rank] ? window.HAND_RANK_ZH[eval_.rank] : (eval_ && window.handRankDisplayName ? window.handRankDisplayName(eval_.rank) : '');
          desc.textContent = rankName;
          desc.classList.remove('hidden');
        } else if (desc && (players[j].isFolded || !players[j].hand.length)) {
          desc.classList.add('hidden');
        }
      }
    } else {
      if (winnerBanner) winnerBanner.classList.add('hidden');
      for (var k = 0; k < players.length; k++) {
        var d = document.getElementById('player-' + k + '-hand-desc');
        if (d) d.classList.add('hidden');
      }
    }

    var isHumanTurn = s.currentPlayerIndex === 0 && !s.handOver;
    var panel = document.getElementById('analysis-panel');
    var analysisInGame = document.getElementById('analysis-in-game');
    var analysisRecap = document.getElementById('analysis-recap');
    var recapContentEl = document.getElementById('analysis-recap-content');
    if (s.handOver) {
      if (panel) panel.classList.remove('hidden');
      if (panel) panel.classList.add('recap-active');
      if (analysisInGame) analysisInGame.classList.add('hidden');
      if (analysisRecap) analysisRecap.classList.remove('hidden');
      if (window.getHandRecap) {
        var recap = window.getHandRecap(s);
        var gradeBadge = document.getElementById('recap-grade-badge');
        var gradeSummary = document.getElementById('recap-grade-summary');
        var chipChangeEl = document.getElementById('recap-chip-change');
        var decisionsEl = document.getElementById('recap-decisions');
        
        var showdownEl = document.getElementById('recap-showdown');
        if (showdownEl) {
          if (recap.showdownSummary) {
            showdownEl.style.display = 'block';
            showdownEl.textContent = recap.showdownSummary;
          } else {
            showdownEl.style.display = 'none';
          }
        }
        if (gradeBadge) {
          gradeBadge.textContent = recap.grade;
          gradeBadge.className = 'recap-grade-badge recap-grade-' + recap.grade;
        }
        if (gradeSummary) gradeSummary.textContent = recap.summaryLine;
        if (chipChangeEl) {
          chipChangeEl.textContent = (recap.heroWon ? '赢得 ' : '本局 ') + recap.chipChange;
          chipChangeEl.className = 'recap-chip-change ' + (recap.chipDiff >= 0 ? 'recap-chip-win' : 'recap-chip-lose');
        }
        if (decisionsEl) {
          decisionsEl.innerHTML = '';
          (recap.decisions || []).forEach(function (d) {
            var card = document.createElement('div');
            card.className = 'recap-decision';
            var header = '<div class="recap-decision-header">'
              + '<span class="recap-decision-street">' + d.streetName + '</span>'
              + '<span class="recap-decision-action">' + d.actual + '</span>'
              + '<span class="recap-decision-rating rating-' + d.rating + '">' + d.ratingIcon + ' ' + d.ratingLabel + '</span>'
              + '</div>';
            var body = '<div class="recap-decision-analysis">' + d.analysis + '</div>';
            if (d.suggestion) {
              body += '<div class="recap-decision-suggestion">' + d.suggestion + '</div>';
            }
            card.innerHTML = header + body;
            decisionsEl.appendChild(card);
          });
        }
        
      }
    } else {
      if (panel) panel.classList.toggle('hidden', !(isHumanTurn && currentSettings.aiAssist));
      if (panel) panel.classList.remove('recap-active');
      if (analysisInGame) analysisInGame.classList.remove('hidden');
      if (analysisRecap) analysisRecap.classList.add('hidden');
      if (isHumanTurn && currentSettings.aiAssist) {
        var adv = game.getAdvice();
        if (adv) {
          var d = adv.details || {};

          var posEl = document.getElementById('advice-position');
          var streetEl = document.getElementById('advice-street');
          var handDescEl = document.getElementById('advice-hand-desc');
          if (posEl) posEl.textContent = d.positionDesc || d.position || '—';
          if (streetEl) streetEl.textContent = d.streetName || '—';
          if (handDescEl) handDescEl.textContent = d.handDesc || '—';

          var winEl = document.getElementById('advice-win');
          var progEl = document.getElementById('progress-win');
          var tierEl = document.getElementById('advice-tier');
          var wpPct = Math.round(adv.winProbability * 100);
          if (winEl) winEl.textContent = wpPct + '%';
          if (progEl) {
            progEl.style.width = wpPct + '%';
            progEl.style.backgroundPosition = (100 - wpPct) + '% 0';
          }
          if (tierEl) {
            var tierMap = { strong: '强牌', good: '中强', marginal: '边缘', weak: '弱牌' };
            tierEl.textContent = tierMap[adv.tier] || '';
            tierEl.className = 'analysis-tier tier-' + (adv.tier || 'weak');
          }

          var rowDraws = document.getElementById('row-draws');
          if (rowDraws) {
            if (d.drawInfo) {
              rowDraws.classList.remove('hidden');
              var drawsEl = document.getElementById('advice-draws');
              var drawIconEl = document.getElementById('draw-icon');
              if (drawsEl) drawsEl.textContent = d.drawInfo;
              if (drawIconEl) drawIconEl.textContent = d.drawIcon || '♠';
            } else {
              rowDraws.classList.add('hidden');
            }
          }

          var actEl = document.getElementById('advice-action');
          if (actEl) {
            var actionText = adv.action;
            if (adv.betAmount != null && (adv.action === '\u52A0\u6CE8' || adv.action === '\u4E0B\u6CE8')) {
              actionText = adv.action + ' $' + adv.betAmount;
            }
            actEl.textContent = actionText;
            actEl.className = 'advice-action';
            var actionMap = {
              '\u52A0\u6CE8': 'raise', '\u8DDF\u6CE8': 'call', '\u5F03\u724C': 'fold',
              '\u8FC7\u724C': 'check', '\u4E0B\u6CE8': 'bet'
            };
            var cls = actionMap[adv.action] || 'check';
            actEl.classList.add('advice-action-' + cls);
          }

          var coachEl = document.getElementById('advice-coach');
          if (coachEl) coachEl.textContent = adv.coach || '';

          if (mcWorker && s.players[0].hand.length === 2) {
            mcCompute('winProbability', s.players[0].hand, s.communityCards, 800, function (wp) {
              if (wp == null) return;
              var we = document.getElementById('advice-win');
              var pe = document.getElementById('progress-win');
              if (we) we.textContent = Math.round(wp * 100) + '%';
              if (pe) { pe.style.width = (wp * 100) + '%'; pe.style.backgroundPosition = (100 - wp * 100) + '% 0'; }
            });
          }
        }
      }
    }

    var toCallNow = game.getToCall();
    var inputNow = getBetInputValue();
    var gs = game.getState();
    var minRaiseAmt = gs.minRaise || currentSettings.bb;
    if (inputNow < toCallNow || inputNow === 0) {
      setBetInputValue(toCallNow || minRaiseAmt);
    }
    var inp = document.getElementById('panel-bet-input');
    if (inp) inp.min = String(Math.max(1, toCallNow > 0 ? toCallNow : minRaiseAmt));
    updateCallBetButton();

    var btnCheckEl = document.getElementById('btn-check');
    var btnFoldEl = document.getElementById('btn-fold');
    if (btnCheckEl) {
      btnCheckEl.disabled = toCallNow > 0;
      btnCheckEl.classList.toggle('btn-disabled', toCallNow > 0);
    }
    if (btnFoldEl) {
      btnFoldEl.disabled = toCallNow === 0;
      btnFoldEl.classList.toggle('btn-disabled', toCallNow === 0);
    }

    var startWrap = document.getElementById('table-start-wrap');
    var nextWrap = document.getElementById('table-next-wrap');
    var noHandYet = !gameHasStarted && s.players[0].hand.length === 0;
    if (startWrap) startWrap.classList.toggle('hidden', !noHandYet || s.handOver);
    if (nextWrap) nextWrap.classList.toggle('hidden', !s.handOver);
    var bottomPanel = document.querySelector('.game-screen .bottom-panel');
    if (bottomPanel) bottomPanel.style.visibility = (s.handOver || noHandYet || s.players[0].hand.length === 0) ? 'hidden' : 'visible';
  }

  function getAIDelay() {
    return SPEED_MS[currentSettings.speed] || 700;
  }

  function doAct(action, amount) {
    if (!game) return;
    game.act(action, amount);
    render();
    runAITurns();
  }

  function runAITurns() {
    var delay = getAIDelay();
    (function step() {
      var s = game.getState();
      if (s.handOver) return;
      if (s.players[s.currentPlayerIndex].isHuman) {
        if (window.PokerSounds) PokerSounds.yourTurn();
        return;
      }
      var whoActed = s.currentPlayerIndex;
      setTimeout(function () {
        game.runAI();
        var next = game.getState();
        var lastAct = next.players[whoActed].lastAction;
        var justFolded = lastAct && lastAct.type === 'fold';
        if (justFolded) {
          if (window.PokerSounds) PokerSounds.fold();
          render(whoActed);
          runFoldAnimation(whoActed, function () {
            step();
          });
        } else if (lastAct) {
          if (window.PokerSounds) {
            if (lastAct.type === 'check') PokerSounds.check();
            else if (lastAct.type === 'call') PokerSounds.chipCall();
            else if (lastAct.type === 'bet' || lastAct.type === 'raise') PokerSounds.chipBet();
          }
          render();
          var actionText = lastAct.type === 'check' ? 'Check' : (lastAct.type === 'call' ? 'Call' : (lastAct.type === 'bet' || lastAct.type === 'raise' ? 'Raise' : ''));
          if (actionText) {
            showActionIndicator(whoActed, actionText, function () {
              step();
            });
          } else {
            step();
          }
        } else {
          render();
          step();
        }
      }, delay);
    })();
  }

  function initSettingsUI() {
    var playersEl = document.getElementById('settings-players');
    if (playersEl) {
      playersEl.innerHTML = '';
      for (var n = 2; n <= 8; n++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'settings-choice' + (n === 2 ? ' active' : '');
        btn.setAttribute('data-players', n);
        btn.textContent = n + ' \u4EBA';
        playersEl.appendChild(btn);
      }
    }

    document.querySelectorAll('#settings-players .settings-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#settings-players .settings-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSettings.playerCount = parseInt(btn.getAttribute('data-players'), 10);
      });
    });

    document.querySelectorAll('#settings-speed .settings-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#settings-speed .settings-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSettings.speed = btn.getAttribute('data-speed');
      });
    });

    document.querySelectorAll('#settings-blinds .settings-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#settings-blinds .settings-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSettings.sb = parseInt(btn.getAttribute('data-sb'), 10);
        currentSettings.bb = parseInt(btn.getAttribute('data-bb'), 10);
      });
    });

    document.querySelectorAll('#settings-ai .settings-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#settings-ai .settings-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSettings.aiAssist = btn.getAttribute('data-ai') === 'on';
      });
    });

    document.querySelectorAll('#settings-sound .settings-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#settings-sound .settings-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var on = btn.getAttribute('data-sound') === 'on';
        if (window.PokerSounds) {
          PokerSounds.setEnabled(on);
          if (on) { PokerSounds.init(); PokerSounds.uiClick(); }
        }
      });
    });
  }

  function onEnterGame() {
    var sb = currentSettings.sb;
    var bb = currentSettings.bb;
    var initialChips = 100 * bb;
    var playerCount = currentSettings.playerCount;

    PLAYER_COUNT = playerCount;
    sessionInitialChips = initialChips;
    game = new window.PokerGame(sb, bb, initialChips, playerCount);

    var blindsLabel = document.getElementById('table-blinds-label');
    if (blindsLabel) blindsLabel.textContent = sb + '/' + bb;

    var chipsInfo = document.getElementById('top-chips-info');
    if (chipsInfo) chipsInfo.classList.remove('hidden');

    showScreen('game-screen');
    renderGameSeats();
    setBetInputValue(bb);
    dealPhase = false;
    prevCommunityLength = 0;
    gameHasStarted = false;
    render();
  }

  function runFoldAnimation(playerIndex, callback) {
    if (typeof playerIndex === 'function') { callback = playerIndex; playerIndex = 0; }
    var cardsEl = document.getElementById('player-' + playerIndex + '-cards');
    var tableEl = document.getElementById('table-oval');
    var layer = document.getElementById('fold-animation-layer');
    if (!cardsEl || !tableEl || !layer || !cardsEl.children.length) {
      if (callback) callback();
      return;
    }
    var tableRect = tableEl.getBoundingClientRect();
    var centerX = tableRect.left + tableRect.width / 2;
    var centerY = tableRect.top + tableRect.height / 2;
    var cards = [].slice.call(cardsEl.children, 0, 2);
    layer.innerHTML = '';
    cards.forEach(function (card, i) {
      var clone = card.cloneNode(true);
      var r = card.getBoundingClientRect();
      clone.classList.add('card-fold-fly');
      clone.style.position = 'fixed';
      clone.style.left = r.left + 'px';
      clone.style.top = r.top + 'px';
      clone.style.width = r.width + 'px';
      clone.style.height = r.height + 'px';
      clone.style.margin = '0';
      clone.style.transitionDelay = (i * 80) + 'ms';
      var dx = centerX - r.left - r.width / 2 + (i === 0 ? -10 : 10);
      var dy = centerY - r.top - r.height / 2;
      clone.style.setProperty('--fold-dx', dx + 'px');
      clone.style.setProperty('--fold-dy', dy + 'px');
      layer.appendChild(clone);
    });
    cardsEl.innerHTML = '';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        layer.querySelectorAll('.card-fold-fly').forEach(function (el) { el.classList.add('fold-animate'); });
        setTimeout(function () {
          layer.innerHTML = '';
          if (callback) callback();
        }, 650);
      });
    });
  }

  function runDealAnimation() {
    var s = game.getState();
    var tableEl = document.getElementById('table-oval');
    if (!tableEl) {
      dealPhase = false;
      render();
      var st0 = game.getState();
      if (st0 && !st0.players[st0.currentPlayerIndex].isHuman) setTimeout(runAITurns, 400);
      return;
    }
    dealPhase = false;
    render();
    dealPhase = true;

    var tableRect = tableEl.getBoundingClientRect();
    var cx = tableRect.left + tableRect.width / 2;
    var cy = tableRect.top + tableRect.height / 2;
    var cardIndex = 0;
    for (var i = 0; i < s.players.length; i++) {
      var cardsEl = document.getElementById('player-' + i + '-cards');
      if (!cardsEl) continue;
      for (var ci = 0; ci < cardsEl.children.length; ci++) {
        var cardEl = cardsEl.children[ci];
        var cr = cardEl.getBoundingClientRect();
        var dx = cx - cr.left - cr.width / 2;
        var dy = cy - cr.top - cr.height / 2;
        cardEl.style.setProperty('--deal-from-x', dx + 'px');
        cardEl.style.setProperty('--deal-from-y', dy + 'px');
        cardEl.style.animationDelay = (cardIndex * 70) + 'ms';
        cardEl.classList.add('card-deal-anim');
        if (window.PokerSounds) {
          (function (delay) { setTimeout(function () { PokerSounds.dealCard(); }, delay); })(cardIndex * 70);
        }
        cardIndex++;
      }
    }
    var totalDelay = cardIndex * 70 + 480;
    setTimeout(function () {
      document.querySelectorAll('.card-deal-anim').forEach(function (el) {
        el.classList.remove('card-deal-anim');
        el.style.removeProperty('--deal-from-x');
        el.style.removeProperty('--deal-from-y');
        el.style.removeProperty('animation-delay');
      });
      dealPhase = false;
      var st = game.getState();
      if (!st.players[st.currentPlayerIndex].isHuman) setTimeout(runAITurns, 400);
    }, totalDelay);
  }

  function onStartHand() {
    if (!game) return;
    if (window.PokerSounds) { PokerSounds.init(); PokerSounds.shuffle(); }
    prevCommunityLength = 0;
    dealPhase = true;
    gameHasStarted = true;
    winSoundPlayed = false;
    game.startNewHand();
    render();
    runDealAnimation();
  }

  document.getElementById('btn-practice').addEventListener('click', function () {
    if (window.PokerSounds) { PokerSounds.init(); PokerSounds.uiClick(); }
    showScreen('settings-screen');
  });

  document.getElementById('btn-enter-game').addEventListener('click', function () {
    if (window.PokerSounds) PokerSounds.uiClick();
    onEnterGame();
  });

  var btnStartHand = document.getElementById('btn-start-hand');
  if (btnStartHand) btnStartHand.addEventListener('click', onStartHand);

  document.getElementById('btn-back').addEventListener('click', function () {
    if (!document.getElementById('settings-screen').classList.contains('hidden')) {
      showScreen('home-screen');
      var ci = document.getElementById('top-chips-info');
      if (ci) ci.classList.add('hidden');
    } else if (!document.getElementById('game-screen').classList.contains('hidden')) {
      showScreen('settings-screen');
      var ci = document.getElementById('top-chips-info');
      if (ci) ci.classList.add('hidden');
    } else {
      showScreen('home-screen');
    }
  });

  function bindGamePanel() {
    var inp = document.getElementById('panel-bet-input');
    if (inp) {
      inp.addEventListener('input', function () { updateCallBetButton(); });
      inp.addEventListener('change', function () { updateCallBetButton(); });
    }

    var btnFold = document.getElementById('btn-fold');
    var btnCheck = document.getElementById('btn-check');
    var btnCall = document.getElementById('btn-call');
    if (btnFold) btnFold.addEventListener('click', function () {
      if (!game) return;
      var s = game.getState();
      if (s.handOver || s.currentPlayerIndex !== 0 || s.players[0].isFolded) return;
      if (window.PokerSounds) PokerSounds.fold();
      runFoldAnimation(0, function () {
        doAct('fold');
      });
    });
    if (btnCheck) btnCheck.addEventListener('click', function () {
      if (!game) return;
      if (game.getToCall() > 0) return;
      var s = game.getState();
      if (s.handOver || s.currentPlayerIndex !== 0 || s.players[0].isFolded) return;
      if (window.PokerSounds) PokerSounds.check();
      doAct('check');
    });
    if (btnCall) btnCall.addEventListener('click', function () {
      var toCall = game.getToCall();
      var amt = getBetInputValue();
      var s = game.getState();
      var human = s.players[0];
      var maxBet = Math.max.apply(null, s.players.map(function (p) { return p.currentBet; }));
      if (toCall > 0 && amt > toCall) {
        if (window.PokerSounds) PokerSounds.chipBet();
        doAct('raise', maxBet + amt);
      } else if (toCall > 0) {
        if (window.PokerSounds) PokerSounds.chipCall();
        doAct('call');
      } else if (amt > 0) {
        if (window.PokerSounds) PokerSounds.chipBet();
        doAct('raise', maxBet + amt);
      } else {
        if (window.PokerSounds) PokerSounds.check();
        doAct('check');
      }
    });

    var btnD3 = document.getElementById('btn-div3');
    var btnD2 = document.getElementById('btn-div2');
    var btnX2 = document.getElementById('btn-x2');
    var btnX3 = document.getElementById('btn-x3');
    if (btnD3) btnD3.addEventListener('click', function () { setBetInputValue(Math.floor(getBetInputValue() / 3)); updateCallBetButton(); });
    if (btnD2) btnD2.addEventListener('click', function () { setBetInputValue(Math.floor(getBetInputValue() / 2)); updateCallBetButton(); });
    if (btnX2) btnX2.addEventListener('click', function () { setBetInputValue(getBetInputValue() * 2); updateCallBetButton(); });
    if (btnX3) btnX3.addEventListener('click', function () { setBetInputValue(getBetInputValue() * 3); updateCallBetButton(); });

    document.querySelectorAll('.game-screen .panel-btn[data-frac]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!game) return;
        var s = game.getState();
        var human = s.players[0];
        var frac = btn.getAttribute('data-frac');
        if (frac === 'all') {
          if (window.PokerSounds) PokerSounds.allIn();
          setBetInputValue(human.chips + human.currentBet);
          doAct('raise', human.currentBet + human.chips);
          return;
        }
        var add = Math.floor(s.pot * parseFloat(frac));
        setBetInputValue(add);
        var maxBet = Math.max.apply(null, s.players.map(function (p) { return p.currentBet; }));
        var targetBet = maxBet + Math.max(add, game.getToCall());
        if (targetBet <= human.currentBet) {
          if (game.getToCall() === 0) { if (window.PokerSounds) PokerSounds.check(); doAct('check'); }
          else { if (window.PokerSounds) PokerSounds.chipCall(); doAct('call'); }
        } else {
          if (window.PokerSounds) PokerSounds.chipBet();
          doAct('raise', targetBet);
        }
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!game) return;
    var s = game.getState();
    if (s.handOver || s.currentPlayerIndex !== 0 || s.players[0].isFolded) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    var key = e.key.toLowerCase();
    if (key === 'f') {
      e.preventDefault();
      var foldBtn = document.getElementById('btn-fold');
      if (foldBtn) foldBtn.click();
    } else if (key === 'c') {
      e.preventDefault();
      var callBtn = document.getElementById('btn-call');
      if (callBtn) callBtn.click();
    } else if (key === 'x') {
      e.preventDefault();
      var checkBtn = document.getElementById('btn-check');
      if (checkBtn) checkBtn.click();
    } else if (key === 'r') {
      e.preventDefault();
      var inp = document.getElementById('panel-bet-input');
      if (inp) inp.focus();
    }
  });

  function onNextHand() {
    if (!game) return;
    if (window.PokerSounds) PokerSounds.shuffle();
    prevCommunityLength = 0;
    winSoundPlayed = false;
    var wb = document.getElementById('winner-banner');
    if (wb) wb.classList.add('hidden');
    dealPhase = true;
    game.startNewHand();
    render();
    runDealAnimation();
  }

  var btnNextHand = document.getElementById('btn-next-hand');
  if (btnNextHand) btnNextHand.addEventListener('click', onNextHand);

  function showActionIndicator(playerIndex, actionText, callback) {
    var ind = document.getElementById('action-indicator');
    var seat = document.querySelector('#game-seats .seat-item[data-player-index="' + playerIndex + '"]');
    if (!ind) { if (callback) callback(); return; }
    ind.textContent = actionText;
    ind.classList.remove('hidden');
    ind.style.display = 'block';
    ind.style.animation = 'none';
    ind.offsetHeight;
    ind.style.animation = '';
    if (seat) {
      var r = seat.getBoundingClientRect();
      ind.style.left = (r.left + r.width / 2) + 'px';
      ind.style.top = (r.top - 44) + 'px';
    }
    setTimeout(function () {
      ind.classList.add('hidden');
      if (callback) callback();
    }, 650);
  }

  initSettingsUI();
  bindGamePanel();
  showScreen('home-screen');

  var timeEl = document.getElementById('top-time');
  if (timeEl) {
    function updateTime() {
      var d = new Date();
      timeEl.textContent = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    }
    updateTime();
    setInterval(updateTime, 60000);
  }
})();
