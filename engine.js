function installGolfEngine(root) {
  const DEFAULT_SAMPLES = 550;
  const MAX_ROLLOUT_TURNS = 120;

  function cloneCard(card) {
    return card ? { ...card } : null;
  }

  function cloneState(state) {
    return {
      players: state.players.map((player) => ({
        name: player.name,
        human: player.human,
        cards: player.cards.map((slot) => ({ card: cloneCard(slot.card), faceUp: !!slot.faceUp })),
      })),
      stock: state.stock.map(cloneCard),
      stockIsUnknownPool: !!state.stockIsUnknownPool,
      discard: state.discard.map(cloneCard),
      currentPlayer: state.currentPlayer,
      phase: state.phase,
      drawnCard: cloneCard(state.drawnCard),
      drawnFromDiscard: !!state.drawnFromDiscard,
      roundOver: !!state.roundOver,
    };
  }

  function shuffle(cards, rng = Math.random) {
    const copy = [...cards];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cardName(card) {
    return card ? `${card.label}${card.suit}` : "";
  }

  function scoreCards(cards) {
    let total = 0;
    for (const column of [0, 1, 2]) {
      const top = cards[column];
      const bottom = cards[column + 3];
      if (top.label !== bottom.label) total += top.value + bottom.value;
    }
    return total;
  }

  function visibleScore(slots) {
    let total = 0;
    for (const column of [0, 1, 2]) {
      const top = slots[column];
      const bottom = slots[column + 3];
      const cancelled = top.faceUp && bottom.faceUp && top.card.label === bottom.card.label;
      if (!cancelled && top.faceUp) total += top.card.value;
      if (!cancelled && bottom.faceUp) total += bottom.card.value;
    }
    return total;
  }

  function scorePlayer(player) {
    return scoreCards(player.cards.map((slot) => slot.card));
  }

  function faceDownCount(player) {
    return player.cards.filter((slot) => !slot.faceUp).length;
  }

  function allFaceUp(player) {
    return player.cards.every((slot) => slot.faceUp);
  }

  function nextPlayerIndex(state) {
    return (state.currentPlayer + 1) % state.players.length;
  }

  function ensureStock(state, rng = Math.random) {
    if (state.stock.length > 0) return;
    const top = state.discard.pop();
    state.stock = shuffle(state.discard, rng);
    state.discard = top ? [top] : [];
  }

  function materializeUnknowns(state, rng = Math.random) {
    const world = cloneState(state);
    const unknown = [];
    const hiddenRefs = [];
    for (const player of world.players) {
      player.cards.forEach((slot, index) => {
        if (!slot.faceUp) {
          if (slot.card) unknown.push(slot.card);
          hiddenRefs.push({ player, index });
        }
      });
    }
    unknown.push(...world.stock);
    const shuffled = shuffle(unknown, rng);
    const stockSize = state.stockIsUnknownPool
      ? Math.max(0, shuffled.length - hiddenRefs.length)
      : state.stock.length;
    world.stock = shuffled.splice(0, stockSize);
    for (const ref of hiddenRefs) {
      ref.player.cards[ref.index].card = shuffled.pop();
    }
    world.stockIsUnknownPool = false;
    return world;
  }

  function finishTurn(state) {
    state.phase = "draw";
    state.drawnCard = null;
    state.drawnFromDiscard = false;
    if (allFaceUp(state.players[state.currentPlayer])) {
      state.roundOver = true;
      return;
    }
    state.currentPlayer = nextPlayerIndex(state);
  }

  function replaceCard(state, playerIndex, cardIndex, card) {
    const player = state.players[playerIndex];
    const replaced = player.cards[cardIndex].card;
    player.cards[cardIndex] = { card, faceUp: true };
    state.discard.push(replaced);
  }

  function visibleDelta(state, action) {
    if (!["take-discard-place", "replace"].includes(action.type)) return 0;
    const player = state.players[state.currentPlayer];
    const card = action.type === "take-discard-place" ? state.discard.at(-1) : state.drawnCard;
    if (!card) return 0;
    const before = visibleScore(player.cards);
    const after = player.cards.map((slot) => ({ card: slot.card, faceUp: slot.faceUp }));
    after[action.index] = { card, faceUp: true };
    return visibleScore(after) - before;
  }

  function legalActions(state) {
    const player = state.players[state.currentPlayer];
    if (!player || state.roundOver) return [];

    if (state.phase === "draw") {
      const actions = [{ type: "draw-stock", label: "Draw from stock" }];
      const topDiscard = state.discard.at(-1);
      if (topDiscard) {
        for (let index = 0; index < 6; index += 1) {
          actions.push({
            type: "take-discard-place",
            index,
            label: `Take ${cardName(topDiscard)} and place on card ${index + 1}`,
          });
        }
      }
      return actions;
    }

    if (state.phase === "replace" && state.drawnCard) {
      const actions = player.cards.map((slot, index) => ({
        type: "replace",
        index,
        label: `Put ${cardName(state.drawnCard)} on card ${index + 1}`,
      }));
      if (!state.drawnFromDiscard) {
        actions.push({ type: "pass-drawn", label: `Pass ${cardName(state.drawnCard)} to discard` });
      }
      return actions;
    }

    return [];
  }

  function choosePlacementForCard(state, card, playerIndex = state.currentPlayer) {
    const player = state.players[playerIndex];
    let best = { index: 0, score: Infinity };
    for (let index = 0; index < 6; index += 1) {
      const cards = player.cards.map((slot) => slot.card);
      cards[index] = card;
      const shownPenalty = player.cards[index].faceUp ? 0 : 0.25;
      const score = scoreCards(cards) + shownPenalty;
      if (score < best.score) best = { index, score };
    }
    return best;
  }

  function bestImmediatePlacement(state, card, playerIndex = state.currentPlayer) {
    const player = state.players[playerIndex];
    const passScore = scorePlayer(player);
    const placement = choosePlacementForCard(state, card, playerIndex);
    return placement.score < passScore - 0.1 ? placement : null;
  }

  function applyAction(state, action, rng = Math.random) {
    if (action.type === "draw-stock") {
      ensureStock(state, rng);
      const card = state.stock.pop();
      const placement = bestImmediatePlacement(state, card);
      if (placement) {
        replaceCard(state, state.currentPlayer, placement.index, card);
      } else {
        state.discard.push(card);
      }
      finishTurn(state);
      return;
    }

    if (action.type === "take-discard-place") {
      const card = state.discard.pop();
      replaceCard(state, state.currentPlayer, action.index, card);
      finishTurn(state);
      return;
    }

    if (action.type === "replace") {
      replaceCard(state, state.currentPlayer, action.index, state.drawnCard);
      finishTurn(state);
      return;
    }

    if (action.type === "pass-drawn") {
      state.discard.push(state.drawnCard);
      finishTurn(state);
    }
  }

  function applyTreeAction(state, action, rng = Math.random) {
    if (action.type === "draw-stock") {
      ensureStock(state, rng);
      state.drawnCard = state.stock.pop();
      state.drawnFromDiscard = false;
      state.phase = "replace";
      return;
    }
    applyAction(state, action, rng);
  }

  function chooseCpuAction(state) {
    const actions = legalActions(state);
    if (actions.length === 0) return null;
    let best = actions[0];
    let bestScore = Infinity;
    for (const action of actions) {
      const trial = cloneState(state);
      applyAction(trial, action);
      const score = scorePlayer(trial.players[state.currentPlayer]);
      if (score < bestScore) {
        best = action;
        bestScore = score;
      }
    }
    return best;
  }

  function rollout(state, heroIndex, rng = Math.random) {
    let guard = 0;
    while (!state.roundOver && guard < MAX_ROLLOUT_TURNS) {
      const action = chooseCpuAction(state);
      if (!action) break;
      applyAction(state, action, rng);
      guard += 1;
    }
    if (!state.roundOver) state.roundOver = true;
    const scores = state.players.map(scorePlayer);
    const bestOpponent = Math.min(...scores.filter((_, index) => index !== heroIndex));
    return {
      score: scores[heroIndex],
      margin: scores[heroIndex] - bestOpponent,
      win: scores[heroIndex] === Math.min(...scores) ? 1 : 0,
    };
  }

  function closeoutPressure(state, action) {
    const nextPlayer = state.players[nextPlayerIndex(state)];
    if (!nextPlayer || faceDownCount(nextPlayer) > 1) return 0;
    let pressure = 0;
    if (action.type === "draw-stock") pressure += 0.7;
    if (action.type === "pass-drawn") pressure += 0.5;
    const now = visibleDelta(state, action);
    if (now > 0) pressure += now * 1.1;
    if (now < 0) pressure += now * 0.25;
    const replaced = ["replace", "take-discard-place"].includes(action.type)
      ? state.players[state.currentPlayer].cards[action.index]
      : null;
    if (replaced?.faceUp) {
      if (replaced.card.label === "2") pressure += 5;
      else if (replaced.card.label === "K") pressure += 3;
      else if (replaced.card.label === "A") pressure += 2;
    }
    return pressure;
  }

  function hiddenAverageValue(state) {
    const values = [];
    for (const card of state.stock) values.push(card.value);
    for (const player of state.players) {
      for (const slot of player.cards) {
        if (!slot.faceUp && slot.card) values.push(slot.card.value);
      }
    }
    if (values.length === 0) return 5;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function cardForAction(state, action) {
    if (action.type === "take-discard-place") return state.discard.at(-1);
    if (action.type === "replace") return state.drawnCard;
    return null;
  }

  function slotExpectedValue(state, slot) {
    return slot.faceUp ? slot.card.value : hiddenAverageValue(state);
  }

  function projectedColumnValue(topCard, bottomCard) {
    const knownPair = topCard?.label && bottomCard?.label && topCard.label !== "?" && bottomCard.label !== "?";
    if (knownPair && topCard.label === bottomCard.label) return 0;
    return (topCard?.value || 0) + (bottomCard?.value || 0);
  }

  function projectedColumnDelta(state, action, forcedCard = null) {
    if (!["take-discard-place", "replace"].includes(action.type)) return 0;
    const player = state.players[state.currentPlayer];
    const incoming = forcedCard || cardForAction(state, action);
    if (!incoming) return 0;
    const index = action.index;
    const partnerIndex = index < 3 ? index + 3 : index - 3;
    const slot = player.cards[index];
    const partner = player.cards[partnerIndex];
    const hiddenAverage = hiddenAverageValue(state);
    const currentCard = slot.faceUp ? slot.card : { label: "?", value: hiddenAverage };
    const partnerCard = partner.faceUp ? partner.card : { label: "?", value: hiddenAverage };
    const before = index < 3
      ? projectedColumnValue(currentCard, partnerCard)
      : projectedColumnValue(partnerCard, currentCard);
    const after = index < 3
      ? projectedColumnValue(incoming, partnerCard)
      : projectedColumnValue(partnerCard, incoming);
    return after - before;
  }

  function premiumProtectionPenalty(card, incoming) {
    if (!card || !incoming) return 0;
    if (incoming.value <= card.value) return 0;
    if (card.label === "2") return 12;
    if (card.label === "K") return 9;
    if (card.label === "A") return 6;
    if (card.value <= 3) return 4;
    return 0;
  }

  function giveawayPenalty(card) {
    if (!card) return 0;
    if (card.label === "2") return 5;
    if (card.label === "K") return 3.5;
    if (card.label === "A") return 2.5;
    if (card.value <= 3) return 1.5;
    return 0;
  }

  function discardedCardForAction(state, action) {
    if (!["take-discard-place", "replace"].includes(action.type)) return null;
    const slot = state.players[state.currentPlayer]?.cards[action.index];
    return slot?.card || null;
  }

  function opponentThreatForDiscard(state, card) {
    if (!card || state.players.length < 2) {
      return { value: 0, label: "", player: "", cancel: false };
    }
    const opponentIndex = nextPlayerIndex(state);
    const opponent = state.players[opponentIndex];
    const hiddenAverage = hiddenAverageValue(state);
    const base = scorePlayerWithUnknowns(state, opponentIndex);
    let best = { value: 0, label: "", player: opponent.name, cancel: false };

    for (let index = 0; index < 6; index += 1) {
      const slot = opponent.cards[index];
      const partnerIndex = index < 3 ? index + 3 : index - 3;
      const partner = opponent.cards[partnerIndex];
      const cards = opponent.cards.map((candidate) => (
        candidate.faceUp ? candidate.card : { label: "?", value: hiddenAverage }
      ));
      cards[index] = card;
      const after = projectedColumnValue(cards[0], cards[3])
        + projectedColumnValue(cards[1], cards[4])
        + projectedColumnValue(cards[2], cards[5]);
      const gain = base - after;
      const cancel = partner.faceUp && partner.card.label === card.label;
      const knownGain = slot.faceUp ? slot.card.value - card.value : gain;
      const value = Math.max(gain, knownGain, 0) + (cancel ? 1.5 : 0);
      if (value > best.value) {
        best = {
          value,
          label: `Gives ${cardName(card)} to ${opponent.name}; best immediate reply is card ${index + 1}${cancel ? " for a column cancel" : ""}.`,
          player: opponent.name,
          cancel,
        };
      }
    }

    return best;
  }

  function createsKnownColumnCancel(state, action) {
    const incoming = action.card || cardForAction(state, action);
    if (!incoming || action.index === undefined) return false;
    const player = state.players[state.currentPlayer];
    const partnerIndex = action.index < 3 ? action.index + 3 : action.index - 3;
    const partner = player.cards[partnerIndex];
    return partner.faceUp && partner.card.label === incoming.label;
  }

  function drawMechanicsScore(state) {
    const base = scorePlayerWithUnknowns(state, state.currentPlayer);
    const stock = state.stock.length > 0 ? state.stock : [];
    if (stock.length === 0) return base;
    let total = 0;
    for (const card of stock) {
      const passScore = base + 0.15;
      const placements = state.players[state.currentPlayer].cards.map((slot, index) =>
        placementMechanicsScore(state, { type: "replace", index }, card)
      );
      total += Math.min(passScore, ...placements);
    }
    return total / stock.length;
  }

  function scorePlayerWithUnknowns(state, playerIndex) {
    const player = state.players[playerIndex];
    const hiddenAverage = hiddenAverageValue(state);
    const cards = player.cards.map((slot) => slot.faceUp ? slot.card : { label: "?", value: hiddenAverage });
    return projectedColumnValue(cards[0], cards[3])
      + projectedColumnValue(cards[1], cards[4])
      + projectedColumnValue(cards[2], cards[5]);
  }

  function placementMechanicsScore(state, action, forcedCard = null) {
    const player = state.players[state.currentPlayer];
    const incoming = forcedCard || cardForAction(state, action);
    if (!incoming) return scorePlayerWithUnknowns(state, state.currentPlayer);
    const slot = player.cards[action.index];
    const scoredAction = forcedCard ? { ...action, type: "replace", card: forcedCard } : action;
    let score = scorePlayerWithUnknowns(state, state.currentPlayer) + projectedColumnDelta(state, scoredAction, forcedCard);
    if (slot.faceUp) {
      score += premiumProtectionPenalty(slot.card, incoming);
      score += giveawayPenalty(slot.card) * 0.35;
    } else {
      score -= 0.2;
    }
    if (createsKnownColumnCancel(state, scoredAction)) score -= 1.1;
    return score;
  }

  function mechanicsEvaluation(state, action) {
    let score = scorePlayerWithUnknowns(state, state.currentPlayer);
    if (action.type === "draw-stock") {
      score = drawMechanicsScore(state);
    } else if (action.type === "pass-drawn") {
      score += 0.2;
    } else if (["take-discard-place", "replace"].includes(action.type)) {
      score = placementMechanicsScore(state, action);
    }
    const pressure = closeoutPressure(state, action);
    const threat = opponentThreatForDiscard(state, discardedCardForAction(state, action));
    const makesOwnCancel = createsKnownColumnCancel(state, action);
    const threatCap = makesOwnCancel ? 2.5 : 4.5;
    const threatPenalty = Math.min(threat.value * 0.3, threatCap);
    return {
      mechanicsScore: score + pressure + threatPenalty,
      pressure,
      opponentThreat: threat.value,
      opponentThreatPenalty: threatPenalty,
      opponentThreatLabel: threat.label,
      mechanicsNote: pressure > 0
        ? "Mechanics first: adjusted for close-out/premium-card pressure."
        : threat.value > 0
          ? "Mechanics first: includes the next player's immediate discard threat."
          : "Mechanics first: immediate value, hidden average, column cancels and premium-card protection.",
    };
  }

  function evaluateActions(state, options = {}) {
    const samples = options.samples || DEFAULT_SAMPLES;
    const heroIndex = state.currentPlayer;
    const actions = legalActions(state);
    return actions
      .map((action) => {
        let totalScore = 0;
        let totalMargin = 0;
        let totalWins = 0;
        for (let i = 0; i < samples; i += 1) {
          const world = materializeUnknowns(state, options.rng || Math.random);
          applyAction(world, action, options.rng || Math.random);
          const outcome = rollout(world, heroIndex, options.rng || Math.random);
          totalScore += outcome.score;
          totalMargin += outcome.margin;
          totalWins += outcome.win;
        }
        const now = visibleDelta(state, action);
        const mechanics = mechanicsEvaluation(state, action);
        return {
          ...action,
          visibleDelta: now,
          ev: totalScore / samples,
          margin: totalMargin / samples,
          winPct: (totalWins / samples) * 100,
          pressure: mechanics.pressure,
          opponentThreat: mechanics.opponentThreat,
          opponentThreatPenalty: mechanics.opponentThreatPenalty,
          opponentThreatLabel: mechanics.opponentThreatLabel,
          mechanicsScore: mechanics.mechanicsScore,
          mechanicsNote: mechanics.mechanicsNote,
          rankEV: mechanics.mechanicsScore + (totalScore / samples) * 0.08,
        };
      })
      .sort((a, b) => a.rankEV - b.rankEV || a.mechanicsScore - b.mechanicsScore || a.visibleDelta - b.visibleDelta);
  }

  function stateKey(state, depth) {
    const playersKey = state.players
      .map((player) => player.cards.map((slot) => `${slot.faceUp ? "1" : "0"}${slot.card?.id || slot.card?.label || "?"}`).join(","))
      .join("|");
    const discardKey = state.discard.at(-1)?.id || state.discard.at(-1)?.label || "";
    const drawnKey = state.drawnCard?.id || state.drawnCard?.label || "";
    return `${depth}:${state.currentPlayer}:${state.phase}:${discardKey}:${drawnKey}:${playersKey}:${state.stock.length}`;
  }

  function scoreVector(state) {
    return state.players.map(scorePlayer);
  }

  function recursiveScoreVector(state, depth, rng, cache) {
    if (state.roundOver || depth <= 0) return scoreVector(state);
    const key = stateKey(state, depth);
    if (cache.has(key)) return cache.get(key);
    const actions = legalActions(state);
    if (actions.length === 0) return scoreVector(state);

    let bestVector = null;
    let bestOwnScore = Infinity;
    for (const action of actions) {
      const trial = cloneState(state);
      applyTreeAction(trial, action, rng);
      const vector = recursiveScoreVector(trial, depth - 1, rng, cache);
      const ownScore = vector[state.currentPlayer];
      if (ownScore < bestOwnScore) {
        bestOwnScore = ownScore;
        bestVector = vector;
      }
    }
    cache.set(key, bestVector);
    return bestVector;
  }

  function solveDecisionTree(state, options = {}) {
    const depth = options.depth || 5;
    const samples = options.samples || 160;
    const rng = options.rng || Math.random;
    const heroIndex = state.currentPlayer;
    const actions = legalActions(state);
    const cache = new Map();

    return actions
      .map((action) => {
        let totalScore = 0;
        let totalMargin = 0;
        let totalWins = 0;
        for (let i = 0; i < samples; i += 1) {
          const world = materializeUnknowns(state, rng);
          applyTreeAction(world, action, rng);
          const vector = recursiveScoreVector(world, depth - 1, rng, cache);
          const heroScore = vector[heroIndex];
          const bestOpponent = Math.min(...vector.filter((_, index) => index !== heroIndex));
          totalScore += heroScore;
          totalMargin += heroScore - bestOpponent;
          totalWins += heroScore === Math.min(...vector) ? 1 : 0;
        }
        const now = visibleDelta(state, action);
        return {
          ...action,
          visibleDelta: now,
          ev: totalScore / samples,
          margin: totalMargin / samples,
          winPct: (totalWins / samples) * 100,
          rankEV: totalScore / samples,
        };
      })
      .sort((a, b) => a.rankEV - b.rankEV || a.margin - b.margin || a.visibleDelta - b.visibleDelta);
  }

  root.GolfEngine = {
    cloneState,
    scoreCards,
    scorePlayer,
    visibleScore,
    legalActions,
    evaluateActions,
    solveDecisionTree,
    faceDownCount,
  };
  root.GolfEngine.workerSource = `${installGolfEngine.toString()}\ninstallGolfEngine(globalThis);`;
}

installGolfEngine(globalThis);
