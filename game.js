const suits = [
  { symbol: "♠", red: false, color: "spade" },
  { symbol: "♥", red: true, color: "heart" },
  { symbol: "♦", red: true, color: "diamond" },
  { symbol: "♣", red: false, color: "club" },
];

const ranks = [
  { label: "A", value: 1 },
  { label: "2", value: -2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 10 },
  { label: "Q", value: 10 },
  { label: "K", value: 0 },
];

const players = [
  { name: "You", human: true, cards: [], total: 0 },
  { name: "Maya", human: false, cards: [], total: 0 },
  { name: "Noah", human: false, cards: [], total: 0 },
  { name: "Iris", human: false, cards: [], total: 0 },
];

let playerCount = 4;
let stock = [];
let discard = [];
let currentPlayer = 0;
let dealerIndex = 0;
let handNumber = 0;
let holeNumber = 1;
let gameStarted = false;
let drawnCard = null;
let drawnFromDiscard = false;
let phase = "draw";
let startingFlips = 0;
let roundOver = false;
let busy = false;
const cpuThinkDelay = 1600;
const cpuFinishDelay = 1300;
const equitySamples = 700;
const solverNames = ["You", "Maya", "Noah", "Iris"];
let solverPlayerCount = 2;
let solverCurrentPlayer = 0;
let solverHands = createEmptySolverHands();
let solverDiscardPile = [];
let solverActiveCardSlot = null;
let learnedCpuBaseline = null;
let gtoWorker = null;

const playersEl = document.querySelector("#players");
const scoreboardEl = document.querySelector("#scoreboard");
const messageEl = document.querySelector("#message");
const equityOutputEl = document.querySelector("#equityOutput");
const mainMenuEl = document.querySelector("#mainMenu");
const gameTableEl = document.querySelector("#gameTable");
const solverScreenEl = document.querySelector("#solverScreen");
const holeBoardEl = document.querySelector("#holeBoard");
const stockPileEl = document.querySelector("#stockPile");
const discardPileEl = document.querySelector("#discardPile");
const openDiscardButtonEl = document.querySelector("#openDiscardButton");
const discardDialogEl = document.querySelector("#discardDialog");
const discardHistoryEl = document.querySelector("#discardHistory");
const closeDiscardButtonEl = document.querySelector("#closeDiscardButton");
const stockCountEl = document.querySelector("#stockCount");
const discardCardEl = document.querySelector("#discardCard");
const dealerInfoEl = document.querySelector("#dealerInfo");
const playerCountControlsEl = document.querySelector("#playerCountControls");
const menuPlayerCountControlsEl = document.querySelector("#menuPlayerCountControls");
const drawnCardPanelEl = document.querySelector("#drawnCardPanel");
const drawnCardEl = document.querySelector("#drawnCard");
const throwDrawnButtonEl = document.querySelector("#throwDrawnButton");
const newRoundButtonEl = document.querySelector("#newRoundButton");
const nextHoleButtonEl = document.querySelector("#nextHoleButton");
const menuButtonEl = document.querySelector("#menuButton");
const solverButtonEl = document.querySelector("#solverButton");
const solverMenuButtonEl = document.querySelector("#solverMenuButton");
const startGameButtonEl = document.querySelector("#startGameButton");
const resumeGameButtonEl = document.querySelector("#resumeGameButton");
const hintButtonEl = document.querySelector("#hintButton");
const autoPlayButtonEl = document.querySelector("#autoPlayButton");
const solverPlayerCountControlsEl = document.querySelector("#solverPlayerCountControls");
const solverCurrentPlayerEl = document.querySelector("#solverCurrentPlayer");
const solverOpenDiscardButtonEl = document.querySelector("#solverOpenDiscardButton");
const solverDiscardDialogEl = document.querySelector("#solverDiscardDialog");
const solverCloseDiscardButtonEl = document.querySelector("#solverCloseDiscardButton");
const solverClearDiscardButtonEl = document.querySelector("#solverClearDiscardButton");
const solverDeckPickerEl = document.querySelector("#solverDeckPicker");
const solverDiscardListEl = document.querySelector("#solverDiscardList");
const solverCardDialogEl = document.querySelector("#solverCardDialog");
const solverCardPickerEl = document.querySelector("#solverCardPicker");
const solverCloseCardButtonEl = document.querySelector("#solverCloseCardButton");
const solverClearCardButtonEl = document.querySelector("#solverClearCardButton");
const solverClearButtonEl = document.querySelector("#solverClearButton");
const solverRandomButtonEl = document.querySelector("#solverRandomButton");
const solverRunButtonEl = document.querySelector("#solverRunButton");
const gtoRunButtonEl = document.querySelector("#gtoRunButton");
const gtoSamplesEl = document.querySelector("#gtoSamples");
const gtoDepthEl = document.querySelector("#gtoDepth");
const solverPlayersEl = document.querySelector("#solverPlayers");
const solverOutputEl = document.querySelector("#solverOutput");
const cpuLabRoundsEl = document.querySelector("#cpuLabRounds");
const cpuLabRunButtonEl = document.querySelector("#cpuLabRunButton");
const cpuLabOutputEl = document.querySelector("#cpuLabOutput");

function buildDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: crypto.randomUUID(),
        label: rank.label,
        value: rank.value,
        suit: suit.symbol,
        red: suit.red,
        color: suit.color,
      });
    }
  }
  return shuffle(deck);
}

function cardName(card) {
  return card ? `${card.label}${card.suit}` : "";
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function activePlayers() {
  return players.slice(0, playerCount);
}

function playerLeftOf(index) {
  return (index + 1) % playerCount;
}

function startRound(options = {}) {
  const advanceDealer = options.advanceDealer ?? handNumber > 0;
  if (advanceDealer) dealerIndex = playerLeftOf(dealerIndex);
  if (dealerIndex >= playerCount) dealerIndex = 0;
  handNumber += 1;
  holeNumber = ((handNumber - 1) % 18) + 1;
  gameStarted = true;

  stock = buildDeck();
  discard = [];
  drawnCard = null;
  drawnFromDiscard = false;
  currentPlayer = 0;
  phase = "setup";
  startingFlips = 0;
  roundOver = false;
  busy = false;

  for (const player of activePlayers()) {
    player.cards = Array.from({ length: 6 }, () => ({ card: stock.pop(), faceUp: false }));
    if (!player.human) flipRandomStartingCards(player);
  }
  for (const player of players.slice(playerCount)) {
    player.cards = [];
  }

  discard.push(stock.pop());
  const starter = activePlayers()[playerLeftOf(dealerIndex)];
  setMessage(`${activePlayers()[dealerIndex].name} deals. ${starter.name} is first after you choose two starting cards.`);
  clearEquity("Choose your starting cards, then calculate equity at any decision point.");
  showGame();
  render();
}

function startNewGame() {
  dealerIndex = 0;
  handNumber = 0;
  holeNumber = 1;
  gameStarted = true;
  for (const player of players) {
    player.total = 0;
    player.cards = [];
  }
  startRound({ advanceDealer: false });
}

function showMenu() {
  mainMenuEl.hidden = false;
  gameTableEl.hidden = true;
  solverScreenEl.hidden = true;
  resumeGameButtonEl.hidden = !gameStarted;
}

function showGame() {
  mainMenuEl.hidden = true;
  gameTableEl.hidden = false;
  solverScreenEl.hidden = true;
  resumeGameButtonEl.hidden = !gameStarted;
}

function showSolver() {
  mainMenuEl.hidden = true;
  gameTableEl.hidden = true;
  solverScreenEl.hidden = false;
  renderSolver();
}

function flipRandomStartingCards(player) {
  const first = Math.floor(Math.random() * 6);
  let second = Math.floor(Math.random() * 6);
  while (second === first) second = Math.floor(Math.random() * 6);
  player.cards[first].faceUp = true;
  player.cards[second].faceUp = true;
}

function cardHtml(card) {
  if (!card) return "";
  return `
    <span class="corner">${card.label}</span>
    <span class="rank">${card.label}</span>
    <span class="suit">${card.suit}</span>
  `;
}

function renderCard(card, options = {}) {
  const button = document.createElement(options.button ? "button" : "div");
  button.className = "card";
  if (card?.red) button.classList.add("red");
  if (card?.color) button.classList.add(`suit-${card.color}`);
  if (!options.faceUp) button.classList.add("hidden-card");
  if (options.playable) button.classList.add("playable");
  if (options.cancelled) button.classList.add("cancelled");
  button.innerHTML = options.faceUp ? cardHtml(card) : "";
  if (options.position) {
    button.insertAdjacentHTML("beforeend", `<span class="card-position">${options.position}</span>`);
  }
  return button;
}

function render() {
  renderPlayers();
  renderPiles();
  renderScoreboard();
  renderHoleBoard();
  renderDealerInfo();
  renderPlayerCountControls();
  drawnCardPanelEl.hidden = !drawnCard || !players[currentPlayer].human || phase !== "replace";
  drawnCardEl.className = "card large";
  if (drawnCard?.red) drawnCardEl.classList.add("red");
  drawnCardEl.innerHTML = drawnCard ? cardHtml(drawnCard) : "";
  throwDrawnButtonEl.hidden = drawnFromDiscard;
  throwDrawnButtonEl.disabled = drawnFromDiscard;
  nextHoleButtonEl.hidden = !roundOver;
  stockPileEl.disabled = busy || roundOver || !isHumanDrawPhase();
  discardPileEl.disabled = busy || roundOver || !isHumanDrawPhase();
}

function clearEquity(text = "Calculate the current decision when you want EV guidance.") {
  equityOutputEl.textContent = text;
}

function renderHoleBoard() {
  const side = holeNumber <= 9 ? "Front nine" : "Back nine";
  holeBoardEl.innerHTML = `<strong>Hole ${holeNumber}</strong><span>${side}</span>`;
}

function renderPlayers() {
  playersEl.innerHTML = "";
  playersEl.classList.toggle("count-2", playerCount === 2);
  playersEl.classList.toggle("count-3", playerCount === 3);
  playersEl.classList.toggle("count-4", playerCount === 4);
  activePlayers().forEach((player, playerIndex) => {
    const section = document.createElement("article");
    section.className = "player";
    if (playerIndex === currentPlayer && !roundOver) section.classList.add("active");

    const score = scorePlayer(player);
    const header = document.createElement("div");
    header.className = "player-header";
    header.innerHTML = `
      <h2 class="player-name">${player.name}</h2>
      <span class="player-score">${roundOver ? `score ${score.final}` : `shown ${score.visible}`}</span>
    `;

    const grid = document.createElement("div");
    grid.className = "grid";
    const cancelledIndexes = cancelledCardIndexes(player.cards, roundOver);

    player.cards.forEach((slot, cardIndex) => {
      const canReplace = player.human && playerIndex === currentPlayer && phase === "replace" && drawnCard && !busy;
      const canChooseStarter = player.human && playerIndex === currentPlayer && phase === "setup" && !slot.faceUp && !busy;
      const cardEl = renderCard(slot.card, {
        button: canReplace || canChooseStarter,
        faceUp: slot.faceUp || roundOver,
        playable: canReplace || canChooseStarter,
        cancelled: cancelledIndexes.has(cardIndex) && (slot.faceUp || roundOver),
        position: player.human ? cardIndex + 1 : null,
      });
      if (canReplace) {
        cardEl.type = "button";
        cardEl.title = "Replace this card";
        cardEl.addEventListener("click", () => replaceCard(cardIndex));
      }
      if (canChooseStarter) {
        cardEl.type = "button";
        cardEl.title = "Flip this starting card";
        cardEl.addEventListener("click", () => chooseStartingCard(cardIndex));
      }
      grid.append(cardEl);
    });

    section.append(header, grid);
    playersEl.append(section);
  });
}

function renderDealerInfo() {
  const list = activePlayers();
  const dealer = list[dealerIndex];
  const starter = list[playerLeftOf(dealerIndex)];
  dealerInfoEl.innerHTML = dealer && starter ? `Dealer: <strong>${dealer.name}</strong><br>First: <strong>${starter.name}</strong>` : "";
}

function renderPlayerCountControls() {
  [playerCountControlsEl, menuPlayerCountControlsEl].forEach((control) => {
    control.querySelectorAll("button").forEach((button) => {
      const isActive = Number(button.dataset.count) === playerCount;
      button.classList.toggle("active", isActive);
      button.disabled = busy;
    });
  });
}

function renderPiles() {
  stockCountEl.textContent = stock.length;
  const topDiscard = discard.at(-1);
  discardCardEl.className = "card mini";
  if (topDiscard?.red) discardCardEl.classList.add("red");
  discardCardEl.innerHTML = cardHtml(topDiscard);
}

function renderScoreboard() {
  scoreboardEl.innerHTML = players
    .slice(0, playerCount)
    .map((player) => `<div class="score-pill"><strong>${player.total}</strong><span>${player.name}</span></div>`)
    .join("");
}

function openDiscardHistory() {
  if (drawnFromDiscard && phase === "replace") cancelDiscardSelection();
  renderDiscardHistory();
  if (typeof discardDialogEl.showModal === "function") {
    discardDialogEl.showModal();
  } else {
    discardDialogEl.setAttribute("open", "");
  }
}

function closeDiscardHistory() {
  if (typeof discardDialogEl.close === "function") {
    discardDialogEl.close();
  } else {
    discardDialogEl.removeAttribute("open");
  }
}

function renderDiscardHistory() {
  if (discard.length === 0) {
    discardHistoryEl.innerHTML = `<p class="empty-discard">The discard pile is empty.</p>`;
    return;
  }
  discardHistoryEl.innerHTML = "";
  [...discard].reverse().forEach((card, index) => {
    const entry = document.createElement("div");
    entry.className = "discard-entry";
    const cardEl = renderCard(card, { faceUp: true });
    const label = document.createElement("span");
    label.className = "discard-label";
    label.textContent = index === 0 ? "Top" : `${index + 1} down`;
    entry.append(cardEl, label);
    discardHistoryEl.append(entry);
  });
}

function isHumanDrawPhase() {
  return players[currentPlayer].human && phase === "draw";
}

function setMessage(text) {
  messageEl.textContent = text;
}

function drawFromStock() {
  if (drawnFromDiscard && phase === "replace") {
    cancelDiscardSelection();
    return;
  }
  if (!isHumanDrawPhase() || busy) return;
  ensureStock();
  drawnCard = stock.pop();
  drawnFromDiscard = false;
  phase = "replace";
  setMessage("Replace one of your six cards, or pass this card straight to discard.");
  clearEquity("You drew from stock. Calculate equity to compare replacements and passing.");
  render();
}

function chooseStartingCard(cardIndex) {
  const player = players[currentPlayer];
  if (!player.human || phase !== "setup" || player.cards[cardIndex].faceUp || busy) return;
  player.cards[cardIndex].faceUp = true;
  startingFlips += 1;
  if (startingFlips >= 2) {
    currentPlayer = playerLeftOf(dealerIndex);
    phase = "draw";
    render();
    if (!players[currentPlayer].human) {
      setMessage(`${players[currentPlayer].name} starts because they are left of the dealer.`);
      setTimeout(cpuTurn, cpuThinkDelay);
      return;
    }
    setMessage("Your turn. Draw from the stock or discard pile.");
  } else {
    setMessage("Choose one more card to flip up.");
  }
  render();
}

function drawFromDiscard() {
  if (drawnFromDiscard && phase === "replace") {
    cancelDiscardSelection();
    return;
  }
  if (!isHumanDrawPhase() || busy || discard.length === 0) return;
  drawnCard = discard.pop();
  drawnFromDiscard = true;
  phase = "replace";
  setMessage("Discard selected. Click one of your cards to swap, or click another control to cancel.");
  clearEquity("Discard selected. Calculate equity to compare placements.");
  render();
}

function cancelDiscardSelection() {
  if (phase !== "replace" || !drawnFromDiscard || !drawnCard || busy) return;
  discard.push(drawnCard);
  drawnCard = null;
  drawnFromDiscard = false;
  phase = "draw";
  setMessage("Discard selection cancelled. Draw from the stock or discard pile.");
  clearEquity();
  render();
}

function replaceCard(cardIndex) {
  const player = players[currentPlayer];
  if (!player.human || phase !== "replace" || !drawnCard || busy) return;
  const replaced = player.cards[cardIndex].card;
  player.cards[cardIndex] = { card: drawnCard, faceUp: true };
  discard.push(replaced);
  drawnCard = null;
  drawnFromDiscard = false;
  clearEquity();
  finishTurn();
}

function throwDrawnAndFlip() {
  if (phase !== "replace" || drawnFromDiscard || !drawnCard || busy) return;
  discard.push(drawnCard);
  drawnCard = null;
  clearEquity();
  finishTurn();
}

function finishTurn() {
  phase = "draw";
  const player = players[currentPlayer];
  if (allFaceUp(player)) {
    endRound();
    return;
  }

  currentPlayer = (currentPlayer + 1) % playerCount;
  render();
  if (!players[currentPlayer].human) {
    setTimeout(cpuTurn, cpuThinkDelay);
  } else {
    setMessage("Your turn. Draw from the stock or discard pile.");
    clearEquity();
  }
}

function endRound() {
  roundOver = true;
  drawnCard = null;
  for (const player of activePlayers()) {
    const score = scorePlayer(player).final;
    player.total += score;
  }
  const roundScores = activePlayers().map((player) => ({ name: player.name, score: scorePlayer(player).final }));
  const winner = [...roundScores].sort((a, b) => a.score - b.score)[0];
  setMessage(`${players[currentPlayer].name} turned up all six cards. Everyone reveals and counts. ${winner.name} wins this round with ${winner.score}. Press Next hole to deal again.`);
  render();
}

function scorePlayer(player) {
  const cards = player.cards;
  let visible = 0;
  let final = 0;
  for (const column of [0, 1, 2]) {
    const top = cards[column];
    const bottom = cards[column + 3];
    const finalCancelled = top.card.label === bottom.card.label;
    const visibleCancelled = finalCancelled && top.faceUp && bottom.faceUp;
    if (!finalCancelled) final += top.card.value + bottom.card.value;
    if (!visibleCancelled && top.faceUp) visible += top.card.value;
    if (!visibleCancelled && bottom.faceUp) visible += bottom.card.value;
  }
  return { visible, final };
}

function cancelledCardIndexes(cards, includeHidden = false) {
  const indexes = new Set();
  for (const column of [0, 1, 2]) {
    const top = cards[column];
    const bottom = cards[column + 3];
    const canShowCancellation = includeHidden || (top.faceUp && bottom.faceUp);
    if (canShowCancellation && top.card.label === bottom.card.label) {
      indexes.add(column);
      indexes.add(column + 3);
    }
  }
  return indexes;
}

function allFaceUp(player) {
  return player.cards.every((slot) => slot.faceUp);
}

function ensureStock() {
  if (stock.length > 0) return;
  const topDiscard = discard.pop();
  stock = shuffle(discard);
  discard = topDiscard ? [topDiscard] : [];
}

function cpuTurn() {
  if (roundOver || players[currentPlayer].human) return;
  busy = true;
  const player = players[currentPlayer];
  ensureStock();
  const decision = cpuSolverDecision();

  if (decision.type === "take-discard") {
    const card = discard.pop();
    cpuApplyReplacement(player, decision.index, card);
    setMessage(`${player.name} solver took ${cardName(card)} from discard and replaced card ${decision.index + 1}.`);
  } else {
    const card = stock.pop();
    const remainingPool = currentUnknownPool();
    const passEV = cpuPassBoardEV(remainingPool, 120);
    const bestPlacement = cpuBestPlacementForCard(card, remainingPool);
    if (bestPlacement && bestPlacement.ev < passEV - 0.05) {
      cpuApplyReplacement(player, bestPlacement.index, card);
      setMessage(`${player.name} solver drew ${cardName(card)} and replaced card ${bestPlacement.index + 1}.`);
    } else {
      discard.push(card);
      setMessage(`${player.name} solver drew ${cardName(card)} and passed it.`);
    }
  }

  busy = false;
  render();
  setTimeout(finishTurn, cpuFinishDelay);
}

function bestHiddenIndex(player) {
  const hidden = player.cards
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => !slot.faceUp);
  if (hidden.length === 0) {
    return highestVisibleIndex(player);
  }
  const partnerMatch = hidden.find(({ index }) => {
    const partner = index < 3 ? index + 3 : index - 3;
    return player.cards[partner].faceUp && player.cards[partner].card.value >= 7;
  });
  return (partnerMatch || hidden[0]).index;
}

function highestVisibleIndex(player) {
  return player.cards.reduce((best, slot, index) => {
    if (!slot.faceUp) return best;
    return slot.card.value > player.cards[best].card.value ? index : best;
  }, 0);
}

function chooseReplacement(player, card) {
  let best = { index: -1, gain: -Infinity };
  player.cards.forEach((slot, index) => {
    const partner = index < 3 ? index + 3 : index - 3;
    const partnerSlot = player.cards[partner];
    let currentCost = slot.faceUp ? slot.card.value : 6;
    let newCost = card.value;
    if (partnerSlot.faceUp && partnerSlot.card.label === card.label) {
      currentCost += partnerSlot.card.value;
      newCost = 0;
    }
    const gain = currentCost - newCost;
    if (gain > best.gain) best = { index, gain };
  });
  return best;
}

function cloneSlot(slot, keepHiddenCard) {
  return {
    card: slot.faceUp || keepHiddenCard ? slot.card : null,
    faceUp: slot.faceUp,
  };
}

function buildEquityBase() {
  const unknown = [...stock];
  const basePlayers = activePlayers().map((player) => ({
    name: player.name,
    human: player.human,
    cards: player.cards.map((slot) => {
      if (!slot.faceUp) unknown.push(slot.card);
      return cloneSlot(slot, false);
    }),
  }));

  return {
    players: basePlayers,
    unknown,
    discard: [...discard],
    currentPlayer,
    dealerIndex,
    phase,
    startingFlips,
    drawnCard,
    drawnFromDiscard,
  };
}

function materializeSimulation(base) {
  const unknown = shuffle(base.unknown);
  const simPlayers = base.players.map((player) => ({
    name: player.name,
    human: player.human,
    cards: player.cards.map((slot) => ({ ...slot })),
  }));

  for (const player of simPlayers) {
    for (const slot of player.cards) {
      if (!slot.card) slot.card = unknown.pop();
    }
  }

  return {
    players: simPlayers,
    stock: shuffle(unknown),
    discard: [...base.discard],
    currentPlayer: base.currentPlayer,
    dealerIndex: base.dealerIndex,
    phase: base.phase,
    startingFlips: base.startingFlips,
    drawnCard: base.drawnCard,
    drawnFromDiscard: base.drawnFromDiscard,
    roundOver: false,
  };
}

function simScorePlayer(player) {
  let total = 0;
  for (const column of [0, 1, 2]) {
    const top = player.cards[column].card;
    const bottom = player.cards[column + 3].card;
    if (top.label !== bottom.label) total += top.value + bottom.value;
  }
  return total;
}

function simAllFaceUp(player) {
  return player.cards.every((slot) => slot.faceUp);
}

function ensureSimStock(sim) {
  if (sim.stock.length > 0) return;
  const topDiscard = sim.discard.pop();
  sim.stock = shuffle(sim.discard);
  sim.discard = topDiscard ? [topDiscard] : [];
}

function chooseSimReplacement(player, card) {
  let best = { index: -1, gain: -Infinity };
  player.cards.forEach((slot, index) => {
    const partner = index < 3 ? index + 3 : index - 3;
    const partnerSlot = player.cards[partner];
    let currentCost = slot.faceUp ? slot.card.value : 6;
    let newCost = card.value;
    if (partnerSlot.faceUp && partnerSlot.card.label === card.label) {
      currentCost += partnerSlot.card.value;
      newCost = 0;
    }
    const gain = currentCost - newCost;
    if (gain > best.gain) best = { index, gain };
  });
  return best;
}

function simReplace(sim, playerIndex, cardIndex, card) {
  const player = sim.players[playerIndex];
  const replaced = player.cards[cardIndex].card;
  player.cards[cardIndex] = { card, faceUp: true };
  sim.discard.push(replaced);
}

function finishSimTurn(sim) {
  sim.phase = "draw";
  if (simAllFaceUp(sim.players[sim.currentPlayer])) {
    sim.roundOver = true;
    return;
  }
  sim.currentPlayer = (sim.currentPlayer + 1) % sim.players.length;
}

function applyStockPolicy(sim, playerIndex, card) {
  const choice = chooseSimReplacement(sim.players[playerIndex], card);
  if (choice.index !== -1 && (choice.gain >= 2 || card.value <= 3)) {
    simReplace(sim, playerIndex, choice.index, card);
  } else {
    sim.discard.push(card);
  }
  finishSimTurn(sim);
}

function simAutoTurn(sim) {
  ensureSimStock(sim);
  const topDiscard = sim.discard.at(-1);
  const discardChoice = topDiscard ? chooseSimReplacement(sim.players[sim.currentPlayer], topDiscard) : { index: -1, gain: -Infinity };
  if (topDiscard && discardChoice.index !== -1 && discardChoice.gain >= 3) {
    const card = sim.discard.pop();
    simReplace(sim, sim.currentPlayer, discardChoice.index, card);
    finishSimTurn(sim);
    return;
  }
  applyStockPolicy(sim, sim.currentPlayer, sim.stock.pop());
}

function rollout(sim) {
  let guard = 0;
  while (!sim.roundOver && guard < 160) {
    simAutoTurn(sim);
    guard += 1;
  }
  const scores = sim.players.map(simScorePlayer);
  const playerScore = scores[0];
  const bestScore = Math.min(...scores);
  return {
    score: playerScore,
    win: playerScore === bestScore ? 1 : 0,
    margin: playerScore - Math.min(...scores.slice(1)),
  };
}

function visibleScoreForSlots(cards) {
  let visible = 0;
  for (const column of [0, 1, 2]) {
    const top = cards[column];
    const bottom = cards[column + 3];
    const visibleCancelled = top.faceUp && bottom.faceUp && top.card.label === bottom.card.label;
    if (!visibleCancelled && top.faceUp) visible += top.card.value;
    if (!visibleCancelled && bottom.faceUp) visible += bottom.card.value;
  }
  return visible;
}

function immediateVisibleDelta(action) {
  const player = players[currentPlayer];
  if (!player || !["replace", "take-discard-place", "pass-drawn", "draw-stock"].includes(action.type)) return 0;
  if (action.type === "pass-drawn" || action.type === "draw-stock") return 0;
  const card = action.type === "take-discard-place" ? discard.at(-1) : drawnCard;
  if (!card) return 0;
  const before = visibleScoreForSlots(player.cards);
  const cards = player.cards.map((slot) => ({ card: slot.card, faceUp: slot.faceUp }));
  cards[action.index] = { card, faceUp: true };
  return visibleScoreForSlots(cards) - before;
}

function discardThreatText() {
  if (phase !== "draw" || discard.length === 0) return "";
  const threat = nextPlayerDiscardThreat();
  if (!threat) return "";
  return `${threat.player.name} can improve by about ${threat.gain} if ${cardName(threat.card)} is left on discard.`;
}

function nextPlayerDiscardThreat() {
  if (phase !== "draw" || discard.length === 0) return null;
  const nextIndex = (currentPlayer + 1) % playerCount;
  const nextPlayer = players[nextIndex];
  const topDiscard = discard.at(-1);
  if (!nextPlayer || nextPlayer.human || !topDiscard) return null;
  const choice = chooseReplacement(nextPlayer, topDiscard);
  if (choice.gain < 3) return null;
  return { player: nextPlayer, card: topDiscard, gain: choice.gain };
}

function faceDownCount(player) {
  return player.cards.filter((slot) => !slot.faceUp).length;
}

function nextPlayerCloseoutPressure() {
  if (phase !== "draw" && phase !== "replace") return null;
  const nextIndex = (currentPlayer + 1) % playerCount;
  const nextPlayer = players[nextIndex];
  if (!nextPlayer || faceDownCount(nextPlayer) > 1) return null;
  return { player: nextPlayer, faceDown: faceDownCount(nextPlayer) };
}

function actionCreatesVisibleCancel(action) {
  if (!["replace", "take-discard-place"].includes(action.type)) return false;
  const player = players[currentPlayer];
  const card = action.type === "take-discard-place" ? discard.at(-1) : drawnCard;
  if (!player || !card) return false;
  const partnerIndex = action.index < 3 ? action.index + 3 : action.index - 3;
  const partner = player.cards[partnerIndex];
  return partner.faceUp && partner.card.label === card.label;
}

function knownDiscardedCardForAction(action) {
  if (!["replace", "take-discard-place"].includes(action.type)) return null;
  const slot = players[currentPlayer]?.cards[action.index];
  return slot?.faceUp ? slot.card : null;
}

function premiumGiveawayPenalty(card) {
  if (!card) return 0;
  if (card.label === "2") return 5;
  if (card.label === "K") return 3;
  if (card.label === "A") return 2;
  if (card.value <= 3) return 1.25;
  return 0;
}

function closeoutRankAdjustment(action) {
  const pressure = nextPlayerCloseoutPressure();
  if (!pressure) return 0;
  let adjustment = 0;
  if (action.type === "draw-stock") adjustment += 1.15;
  if (action.type === "pass-drawn") adjustment += 0.85;
  if (action.visibleDelta > 0) adjustment += action.visibleDelta * 1.4;
  if (action.visibleDelta < 0) adjustment += action.visibleDelta * 0.35;
  adjustment += premiumGiveawayPenalty(knownDiscardedCardForAction(action));
  return adjustment;
}

function practicalRankScore(result) {
  let score = result.ev;
  const isDiscardPlacement = result.type === "take-discard-place";
  const threat = nextPlayerDiscardThreat();
  const blocksRealThreat = threat && threat.gain >= Math.max(3, result.visibleDelta + 3);
  if (isDiscardPlacement && result.visibleDelta > 0 && !actionCreatesVisibleCancel(result) && !blocksRealThreat) {
    score += 8 + result.visibleDelta;
  }
  return score;
}

function bestMoveContext(best) {
  const notes = [];
  if (best.type === "draw-stock") {
    notes.push("Stock EV includes the next choice after you see the card.");
    if (discard.length > 0) notes.push(`Drawing also covers ${cardName(discard.at(-1))} on discard.`);
  }
  if (best.type === "take-discard-place" && best.visibleDelta < 0) {
    notes.push("This immediately lowers your shown score.");
  }
  if (best.type === "take-discard-place" && best.visibleDelta > 0) {
    notes.push("This worsens shown score now, so the EV is coming from future or denial value.");
  }
  return notes.join(" ");
}

function cloneSimulation(sim) {
  return {
    players: sim.players.map((player) => ({
      name: player.name,
      human: player.human,
      cards: player.cards.map((slot) => ({ card: slot.card, faceUp: slot.faceUp })),
    })),
    stock: [...sim.stock],
    discard: [...sim.discard],
    currentPlayer: sim.currentPlayer,
    dealerIndex: sim.dealerIndex,
    phase: sim.phase,
    startingFlips: sim.startingFlips,
    drawnCard: sim.drawnCard,
    drawnFromDiscard: sim.drawnFromDiscard,
    roundOver: sim.roundOver,
  };
}

function legalEquityActions() {
  const player = players[currentPlayer];
  if (!player?.human || roundOver || busy) return [];

  if (phase === "setup") {
    const hiddenIndexes = player.cards
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => !slot.faceUp)
      .map(({ index }) => index);
    if (startingFlips === 0) {
      const pairs = [];
      for (let i = 0; i < hiddenIndexes.length; i += 1) {
        for (let j = i + 1; j < hiddenIndexes.length; j += 1) {
          pairs.push({
            type: "setup",
            indexes: [hiddenIndexes[i], hiddenIndexes[j]],
            label: `Flip cards ${hiddenIndexes[i] + 1} and ${hiddenIndexes[j] + 1}`,
          });
        }
      }
      return pairs;
    }
    return hiddenIndexes.map((index) => ({ type: "setup", indexes: [index], label: `Flip card ${index + 1}` }));
  }

  if (phase === "draw") {
    const actions = [{ type: "draw-stock", label: "Draw from stock, then choose after seeing it" }];
    if (discard.length > 0) {
      const topDiscard = discard.at(-1);
      player.cards.forEach((slot, index) => {
        actions.push({
          type: "take-discard-place",
          index,
          label: `Lift ${cardName(topDiscard)} from discard and place on card ${index + 1}`,
        });
      });
    }
    return actions;
  }

  if (phase === "replace" && drawnCard) {
    const actions = player.cards.map((slot, index) => ({
      type: "replace",
      index,
      label: `Put ${cardName(drawnCard)} on card ${index + 1}`,
    }));
    if (!drawnFromDiscard) {
      actions.push({
        type: "pass-drawn",
        label: `Pass ${cardName(drawnCard)} to discard`,
      });
    }
    return actions;
  }

  return [];
}

function applyEquityAction(sim, action) {
  if (action.type === "setup") {
    for (const index of action.indexes) {
      sim.players[sim.currentPlayer].cards[index].faceUp = true;
      sim.startingFlips += 1;
    }
    if (sim.startingFlips >= 2) {
      sim.currentPlayer = playerLeftOf(sim.dealerIndex);
      sim.phase = "draw";
    }
    return;
  }

  if (action.type === "draw-stock") {
    ensureSimStock(sim);
    applyStockPolicy(sim, sim.currentPlayer, sim.stock.pop());
    return;
  }

  if (action.type === "take-discard-place") {
    const card = sim.discard.pop();
    simReplace(sim, sim.currentPlayer, action.index, card);
    finishSimTurn(sim);
    return;
  }

  if (action.type === "replace") {
    simReplace(sim, sim.currentPlayer, action.index, sim.drawnCard);
    sim.drawnCard = null;
    sim.drawnFromDiscard = false;
    finishSimTurn(sim);
    return;
  }

  if (action.type === "pass-drawn") {
    sim.discard.push(sim.drawnCard);
    sim.drawnCard = null;
    finishSimTurn(sim);
    return;
  }

}

function legacyRolloutEquity() {
  if (!players[currentPlayer].human || roundOver) {
    clearEquity("Equity is available on your decisions during an active round.");
    return;
  }
  const actions = legalEquityActions();
  if (actions.length === 0) {
    clearEquity("No legal decision to calculate right now.");
    return;
  }
  equityOutputEl.innerHTML = `<div class="equity-note">Calculating ${actions.length} choices across ${equitySamples} rollouts each...</div>`;
  setTimeout(() => {
    const base = buildEquityBase();
    const worlds = Array.from({ length: equitySamples }, () => materializeSimulation(base));
    const results = actions.map((action) => {
      let totalScore = 0;
      let totalWins = 0;
      let totalMargin = 0;
      const visibleDelta = immediateVisibleDelta(action);
      for (const world of worlds) {
        const sim = cloneSimulation(world);
        applyEquityAction(sim, action);
        const outcome = rollout(sim);
        totalScore += outcome.score;
        totalWins += outcome.win;
        totalMargin += outcome.margin;
      }
      return {
        ...action,
        ev: totalScore / equitySamples,
        winPct: (totalWins / equitySamples) * 100,
        margin: totalMargin / equitySamples,
        visibleDelta,
      };
    }).map((result) => ({ ...result, rankScore: practicalRankScore(result) }))
      .sort((a, b) => a.rankScore - b.rankScore || a.ev - b.ev || a.margin - b.margin);
    legacyRenderEquityResults(results);
  }, 20);
}

function legacyRenderEquityResults(results) {
  if (results.length === 0) {
    clearEquity("No equity result is available.");
    return;
  }
  const best = results[0];
  const threat = discardThreatText();
  const visibleChange = best.visibleDelta === 0 ? "no shown-score change" : `${best.visibleDelta > 0 ? "+" : ""}${best.visibleDelta} shown-score change`;
  const context = bestMoveContext(best);
  equityOutputEl.innerHTML = `
    <div class="equity-summary">
      <span>Best move</span>
      <strong>${best.label}</strong>
      <span class="equity-note">${visibleChange}${context ? `; ${context}` : ""}${threat ? `; ${threat}` : ""}</span>
      <span class="equity-note">Ranked by expected score, with self-worsening discard takes demoted unless they cancel or block a real threat. Rows show score EV | margin | now | win%.</span>
    </div>
    <div class="equity-list">
      ${results
        .map((result, index) => `
          <div class="equity-row ${index === 0 ? "best" : ""}">
            <span>${result.label}</span>
            <span>${result.ev.toFixed(2)} | ${result.margin.toFixed(2)} | ${result.visibleDelta > 0 ? "+" : ""}${result.visibleDelta} | ${result.winPct.toFixed(0)}%</span>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function cardPoolWithout(pool, card) {
  if (!card) return [...pool];
  const index = pool.findIndex((candidate) => candidate.id === card.id);
  if (index === -1) return [...pool];
  return [...pool.slice(0, index), ...pool.slice(index + 1)];
}

function currentUnknownPool() {
  const pool = [...stock];
  for (const player of activePlayers()) {
    for (const slot of player.cards) {
      if (!slot.faceUp) pool.push(slot.card);
    }
  }
  return pool;
}

function finalBoardScore(cards) {
  let total = 0;
  for (const column of [0, 1, 2]) {
    const top = cards[column];
    const bottom = cards[column + 3];
    if (top.label !== bottom.label) total += top.value + bottom.value;
  }
  return total;
}

function buildBoardState(player, override = null) {
  const cards = player.cards.map((slot) => (slot.faceUp ? slot.card : null));
  let replacedHidden = 0;
  if (override) {
    if (!player.cards[override.index].faceUp) replacedHidden = 1;
    cards[override.index] = override.card;
  }
  return { cards, replacedHidden };
}

function estimateBoardScore(playerIndex, options = {}) {
  const player = players[playerIndex];
  const pool = options.pool ? [...options.pool] : currentUnknownPool();
  const { cards, replacedHidden } = buildBoardState(player, options.override || null);
  const hiddenIndexes = cards.map((card, index) => (card ? null : index)).filter((index) => index !== null);
  if (hiddenIndexes.length === 0) return finalBoardScore(cards);

  const samples = options.samples || 500;
  let total = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const shuffled = shuffle(pool);
    for (let i = 0; i < replacedHidden; i += 1) shuffled.pop();
    const sampleCards = [...cards];
    for (const index of hiddenIndexes) {
      sampleCards[index] = shuffled.pop();
    }
    total += finalBoardScore(sampleCards);
  }
  return total / samples;
}

function knownCardActionEV(card, index, pool = currentUnknownPool()) {
  return estimateBoardScore(currentPlayer, {
    override: { card, index },
    pool,
    samples: 600,
  });
}

function passCurrentBoardEV(pool = currentUnknownPool()) {
  return estimateBoardScore(currentPlayer, { pool, samples: 600 });
}

function stockDrawEV() {
  const pool = currentUnknownPool();
  if (pool.length === 0) return passCurrentBoardEV(pool);
  let total = 0;
  for (const drawn of pool) {
    const remainingPool = cardPoolWithout(pool, drawn);
    const passEV = passCurrentBoardEV(remainingPool);
    const replaceEVs = players[currentPlayer].cards.map((slot, index) => knownCardActionEV(drawn, index, remainingPool));
    total += Math.min(passEV, ...replaceEVs);
  }
  return total / pool.length;
}

function cpuKnownCardActionEV(card, index, pool = currentUnknownPool(), samples = 140) {
  return estimateBoardScore(currentPlayer, {
    override: { card, index },
    pool,
    samples,
  });
}

function cpuPassBoardEV(pool = currentUnknownPool(), samples = 140) {
  return estimateBoardScore(currentPlayer, { pool, samples });
}

function cpuStockDrawEV() {
  const pool = currentUnknownPool();
  if (pool.length === 0) return cpuPassBoardEV(pool);
  const sampledPool = shuffle(pool).slice(0, Math.min(18, pool.length));
  let total = 0;
  for (const drawn of sampledPool) {
    const remainingPool = cardPoolWithout(pool, drawn);
    const passEV = cpuPassBoardEV(remainingPool, 90);
    const replaceEVs = players[currentPlayer].cards.map((slot, index) =>
      cpuKnownCardActionEV(drawn, index, remainingPool, 90)
    );
    total += Math.min(passEV, ...replaceEVs);
  }
  return total / sampledPool.length;
}

function cpuBestPlacementForCard(card, pool = currentUnknownPool()) {
  return players[currentPlayer].cards
    .map((slot, index) => ({
      type: "replace",
      index,
      card,
      ev: cpuKnownCardActionEV(card, index, pool),
    }))
    .sort((a, b) => a.ev - b.ev)[0];
}

function cpuSolverDecision() {
  ensureStock();
  const topDiscard = discard.at(-1);
  const actions = [];
  actions.push({
    type: "draw-stock",
    ev: applyCpuBaselineAdjustment("stock", cpuStockDrawEV()),
  });
  if (topDiscard) {
    const discardPool = currentUnknownPool();
    for (let index = 0; index < 6; index += 1) {
      actions.push({
        type: "take-discard",
        index,
        card: topDiscard,
        ev: applyCpuBaselineAdjustment("discard", cpuKnownCardActionEV(topDiscard, index, discardPool)),
      });
    }
  }
  return actions.sort((a, b) => a.ev - b.ev)[0];
}

function cpuApplyReplacement(player, index, card) {
  const replaced = player.cards[index].card;
  player.cards[index] = { card, faceUp: true };
  discard.push(replaced);
}

function reliableEquityActions() {
  const player = players[currentPlayer];
  if (!player?.human || roundOver || busy) return [];
  const withCloseoutRank = (actions) =>
    actions.map((action) => {
      const closeoutAdjustment = closeoutRankAdjustment(action);
      return {
        ...action,
        closeoutAdjustment,
        rankEV: action.ev + closeoutAdjustment,
      };
    });

  if (phase === "setup") {
    const hiddenIndexes = player.cards
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => !slot.faceUp)
      .map(({ index }) => index);
    if (startingFlips === 0) {
      const pairs = [];
      for (let i = 0; i < hiddenIndexes.length; i += 1) {
        for (let j = i + 1; j < hiddenIndexes.length; j += 1) {
          pairs.push({
            type: "setup",
            label: `Flip cards ${hiddenIndexes[i] + 1} and ${hiddenIndexes[j] + 1}`,
            ev: passCurrentBoardEV(),
            visibleDelta: 0,
            note: "Starting flips reveal information but do not change final score by themselves.",
          });
        }
      }
      return withCloseoutRank(pairs);
    }
    return withCloseoutRank(hiddenIndexes.map((index) => ({
      type: "setup",
      label: `Flip card ${index + 1}`,
      ev: passCurrentBoardEV(),
      visibleDelta: 0,
      note: "Starting flips reveal information but do not change final score by themselves.",
    })));
  }

  if (phase === "draw") {
    const actions = [{
      type: "draw-stock",
      label: "Draw from stock",
      ev: stockDrawEV(),
      visibleDelta: 0,
      note: "Includes seeing the stock card, then either placing it or passing it.",
    }];
    if (discard.length > 0) {
      const topDiscard = discard.at(-1);
      player.cards.forEach((slot, index) => {
        const action = {
          type: "take-discard-place",
          index,
          label: `Take ${cardName(topDiscard)} and place on card ${index + 1}`,
          ev: knownCardActionEV(topDiscard, index),
        };
        action.visibleDelta = immediateVisibleDelta(action);
        action.note = actionCreatesVisibleCancel(action)
          ? "Immediate column cancellation."
          : action.visibleDelta < 0
            ? "Immediately lowers shown score."
            : action.visibleDelta > 0
              ? "Raises shown score now; only consider if hidden-card EV justifies it."
              : "No immediate shown-score change.";
        actions.push(action);
      });
    }
    return withCloseoutRank(actions);
  }

  if (phase === "replace" && drawnCard) {
    const actions = players[currentPlayer].cards.map((slot, index) => {
      const action = {
        type: "replace",
        index,
        label: `Put ${cardName(drawnCard)} on card ${index + 1}`,
        ev: knownCardActionEV(drawnCard, index),
      };
      action.visibleDelta = immediateVisibleDelta(action);
      action.note = actionCreatesVisibleCancel(action)
        ? "Immediate column cancellation."
        : action.visibleDelta < 0
          ? "Immediately lowers shown score."
          : action.visibleDelta > 0
            ? "Raises shown score now; only useful if replacing a likely worse hidden card."
            : "No immediate shown-score change.";
      return action;
    });
    if (!drawnFromDiscard) {
      actions.push({
        type: "pass-drawn",
        label: `Pass ${cardName(drawnCard)} to discard`,
        ev: passCurrentBoardEV(),
        visibleDelta: 0,
        note: "Keeps your current board.",
      });
    }
    return withCloseoutRank(actions);
  }

  return [];
}

function currentEngineState() {
  return {
    players: activePlayers().map((player) => ({
      name: player.name,
      human: player.human,
      cards: player.cards.map((slot) => ({ card: slot.card, faceUp: slot.faceUp })),
    })),
    stock: [...stock],
    discard: [...discard],
    currentPlayer,
    phase,
    drawnCard,
    drawnFromDiscard,
    roundOver,
  };
}

function engineActionNote(result) {
  const notes = [];
  if (result.type === "draw-stock") {
    notes.push("Simulates drawing from stock, then choosing whether to place or pass the card.");
  }
  if (result.type === "pass-drawn") {
    notes.push("Keeps your current board and throws the drawn card away.");
  }
  if (["take-discard-place", "replace"].includes(result.type)) {
    if (result.visibleDelta < 0) notes.push("Immediately lowers your shown score.");
    if (result.visibleDelta > 0) notes.push("Raises your shown score now, so it needs future or denial value.");
    if (result.visibleDelta === 0) notes.push("Keeps your shown score unchanged.");
  }
  if (result.pressure > 0) {
    notes.push("Adjusted for close-out pressure because the next player may be able to end the hole.");
  }
  return notes.join(" ");
}

function calculateEquity() {
  if (drawnFromDiscard && phase === "replace") {
    // Keep the selected discard available for placement calculations.
  }
  if (!players[currentPlayer].human || roundOver) {
    clearEquity("Equity is available on your decisions during an active round.");
    return;
  }
  if (phase === "setup" || !window.GolfEngine) {
    const results = reliableEquityActions().sort((a, b) =>
      (a.rankEV ?? a.ev) - (b.rankEV ?? b.ev) || a.ev - b.ev || a.visibleDelta - b.visibleDelta
    );
    renderEquityResults(results);
    return;
  }
  equityOutputEl.innerHTML = `<div class="equity-note">Running solver rollouts...</div>`;
  setTimeout(() => {
    const results = window.GolfEngine.evaluateActions(currentEngineState(), { samples: 320 });
    renderEngineEquityResults(results);
  }, 20);
}

function renderEquityResults(results) {
  if (!results.length) {
    clearEquity("No legal decision to calculate right now.");
    return;
  }
  const best = results[0];
  const closeout = nextPlayerCloseoutPressure();
  const visibleChange = best.visibleDelta === 0 ? "no shown-score change" : `${best.visibleDelta > 0 ? "+" : ""}${best.visibleDelta} shown-score change`;
  equityOutputEl.innerHTML = `
    <div class="equity-summary">
      <span>Best move</span>
      <strong>${best.label}</strong>
      <span class="equity-note">${visibleChange}. ${best.note || ""}</span>
      ${closeout ? `<span class="equity-note">Close-out pressure: ${closeout.player.name} has ${closeout.faceDown} face-down card left, so stock/pass lines are demoted and giving away premium low cards is penalised.</span>` : ""}
      <span class="equity-note">Reliable mode: lower is better. Rows show score EV | now${closeout ? " | close pressure" : ""}.</span>
    </div>
    <div class="equity-list">
      ${results
        .map((result, index) => `
          <div class="equity-row ${index === 0 ? "best" : ""}">
            <span>${result.label}</span>
            <span>${result.ev.toFixed(2)} | ${result.visibleDelta > 0 ? "+" : ""}${result.visibleDelta}${closeout ? ` | +${result.closeoutAdjustment.toFixed(2)}` : ""}</span>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderEngineEquityResults(results) {
  if (!results.length) {
    clearEquity("No legal decision to calculate right now.");
    return;
  }
  const best = results[0];
  const closeout = nextPlayerCloseoutPressure();
  const visibleChange = best.visibleDelta === 0 ? "no shown-score change" : `${best.visibleDelta > 0 ? "+" : ""}${best.visibleDelta} shown-score change`;
  equityOutputEl.innerHTML = `
    <div class="equity-summary">
      <span>Best move</span>
      <strong>${best.label}</strong>
      <span class="equity-note">${visibleChange}. ${engineActionNote(best)}</span>
      ${closeout ? `<span class="equity-note">Close-out pressure: ${closeout.player.name} has ${closeout.faceDown} face-down card left, so the ranking includes a pressure adjustment.</span>` : ""}
      <span class="equity-note">Engine mode: Monte Carlo rollouts to the end of the hole. Lower is better. Rows show score EV | margin | now | win%${closeout ? " | pressure" : ""}.</span>
    </div>
    <div class="equity-list">
      ${results
        .map((result, index) => `
          <div class="equity-row ${index === 0 ? "best" : ""}">
            <span>${result.label}</span>
            <span>${result.ev.toFixed(2)} | ${result.margin.toFixed(2)} | ${result.visibleDelta > 0 ? "+" : ""}${result.visibleDelta} | ${result.winPct.toFixed(0)}%${closeout ? ` | +${result.pressure.toFixed(2)}` : ""}</span>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function autoPlayCpus() {
  if (!players[currentPlayer].human || roundOver) return;
  setMessage("Computer turns will continue automatically after your move.");
}

function setPlayerCount(count) {
  if (count === playerCount || busy) return;
  playerCount = count;
  dealerIndex = 0;
  handNumber = 0;
  holeNumber = 1;
  for (const player of players) {
    player.total = 0;
    player.cards = [];
  }
  setMessage(`Starting a new ${count}-player match.`);
  startRound({ advanceDealer: false });
}

function setMenuPlayerCount(count) {
  if (count === playerCount) return;
  playerCount = count;
  renderPlayerCountControls();
}

function createEmptySolverHands() {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 6 }, () => ({ code: "" }))
  );
}

function solverDeckOptions() {
  const options = [{ code: "", label: "Unknown" }];
  for (const suit of suits) {
    for (const rank of ranks) {
      options.push({
        code: `${rank.label}${suit.symbol}`,
        label: `${rank.label}${suit.symbol}`,
        card: {
          id: `${rank.label}${suit.symbol}`,
          label: rank.label,
          value: rank.value,
          suit: suit.symbol,
          red: suit.red,
          color: suit.color,
        },
      });
    }
  }
  return options;
}

function solverCardFromCode(code) {
  return solverDeckOptions().find((option) => option.code === code)?.card || null;
}

function solverOptionHtml(selectedCode, allowUnknown = true) {
  return solverDeckOptions()
    .filter((option) => allowUnknown || option.code)
    .map((option) => `<option value="${option.code}" ${option.code === selectedCode ? "selected" : ""}>${option.label}</option>`)
    .join("");
}

function setSolverPlayerCount(count) {
  solverPlayerCount = count;
  solverCurrentPlayer = 0;
  renderSolver();
}

function renderSolver() {
  renderSolverControls();
  renderSolverPlayers();
}

function renderSolverControls() {
  solverCurrentPlayer = 0;
  solverPlayerCountControlsEl.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.count) === solverPlayerCount);
  });
  solverCurrentPlayerEl.innerHTML = Array.from({ length: solverPlayerCount }, (_, index) =>
    `<option value="${index}" ${index === solverCurrentPlayer ? "selected" : ""}>${solverNames[index]}</option>`
  ).join("");
  renderSolverDiscardList();
}

function renderSolverPlayers() {
  solverPlayersEl.innerHTML = "";
  solverPlayersEl.classList.toggle("count-2", solverPlayerCount === 2);
  solverPlayersEl.classList.toggle("count-3", solverPlayerCount === 3);
  solverPlayersEl.classList.toggle("count-4", solverPlayerCount === 4);
  for (let playerIndex = 0; playerIndex < solverPlayerCount; playerIndex += 1) {
    const section = document.createElement("article");
    section.className = "solver-player";
    if (playerIndex === solverCurrentPlayer) section.classList.add("solving");
    section.innerHTML = `
      <div class="solver-player-header">
        <h2>${solverNames[playerIndex]}</h2>
        ${playerIndex === solverCurrentPlayer ? "<span>Solving</span>" : ""}
      </div>
    `;
    const grid = document.createElement("div");
    grid.className = "solver-grid";
    solverHands[playerIndex].forEach((slot, slotIndex) => {
      const selectedCard = solverCardFromCode(slot.code);
      const card = document.createElement("div");
      card.className = "solver-card";
      const preview = selectedCard
        ? `<div class="solver-card-preview" data-player="${playerIndex}" data-slot="${slotIndex}"></div>`
        : `<div class="unknown-card">Unknown</div>`;
      card.innerHTML = `
        <div class="solver-card-title"><span>Card ${slotIndex + 1}</span></div>
        <button type="button" class="solver-card-button" data-player="${playerIndex}" data-slot="${slotIndex}">
          ${preview}
        </button>
      `;
      if (selectedCard) {
        const previewEl = card.querySelector(".solver-card-preview");
        previewEl.append(renderCard(selectedCard, { faceUp: true, position: slotIndex + 1 }));
      }
      grid.append(card);
    });
    section.append(grid);
    solverPlayersEl.append(section);
  }
}

function solverKnownCodes() {
  const codes = [];
  for (let playerIndex = 0; playerIndex < solverPlayerCount; playerIndex += 1) {
    for (const slot of solverHands[playerIndex]) {
      if (slot.code) codes.push(slot.code);
    }
  }
  codes.push(...solverDiscardPile);
  return codes;
}

function solverDuplicateWarnings() {
  const counts = new Map();
  for (const code of solverKnownCodes()) counts.set(code, (counts.get(code) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
}

function solverUnknownPool() {
  const used = new Set(solverKnownCodes());
  return solverDeckOptions()
    .filter((option) => option.code && !used.has(option.code))
    .map((option) => option.card);
}

function solverHiddenAverageValue() {
  const pool = solverUnknownPool();
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, card) => sum + card.value, 0);
  return {
    average: total / pool.length,
    count: pool.length,
  };
}

function solverExpectedColumnValue(topCard, bottomCard, hiddenAverage) {
  const topKnown = !!topCard;
  const bottomKnown = !!bottomCard;
  if (topKnown && bottomKnown && topCard.label === bottomCard.label) return 0;
  return (topKnown ? topCard.value : hiddenAverage) + (bottomKnown ? bottomCard.value : hiddenAverage);
}

function solverExpectedHandValue(cards, hiddenAverage) {
  return solverExpectedColumnValue(cards[0], cards[3], hiddenAverage)
    + solverExpectedColumnValue(cards[1], cards[4], hiddenAverage)
    + solverExpectedColumnValue(cards[2], cards[5], hiddenAverage);
}

function solverStockImprovementDiagnostics() {
  const pool = solverUnknownPool();
  if (pool.length === 0) return null;
  const player = solverPlayersState()[solverCurrentPlayer];
  const currentCards = player.cards.map((slot) => slot.card || null);
  const currentAverage = pool.reduce((sum, card) => sum + card.value, 0) / pool.length;
  const currentValue = solverExpectedHandValue(currentCards, currentAverage);
  let improving = 0;
  let premiumOrLow = 0;
  let pairHits = 0;
  let totalBestGain = 0;

  for (const drawn of pool) {
    const remaining = cardPoolWithout(pool, drawn);
    const remainingAverage = remaining.length
      ? remaining.reduce((sum, card) => sum + card.value, 0) / remaining.length
      : currentAverage;
    const baseAfterDraw = solverExpectedHandValue(currentCards, remainingAverage);
    let bestValue = baseAfterDraw;
    let makesPair = false;

    for (let index = 0; index < 6; index += 1) {
      const testCards = [...currentCards];
      testCards[index] = drawn;
      const partnerIndex = index < 3 ? index + 3 : index - 3;
      if (currentCards[partnerIndex]?.label === drawn.label) makesPair = true;
      bestValue = Math.min(bestValue, solverExpectedHandValue(testCards, remainingAverage));
    }

    const gain = baseAfterDraw - bestValue;
    if (gain > 0.1) {
      improving += 1;
      totalBestGain += gain;
    }
    if (drawn.label === "2" || drawn.label === "K" || drawn.value <= 3) premiumOrLow += 1;
    if (makesPair) pairHits += 1;
  }

  return {
    improving,
    total: pool.length,
    chance: (improving / pool.length) * 100,
    premiumOrLow,
    pairHits,
    averageGain: improving ? totalBestGain / improving : 0,
    currentValue,
  };
}

function solverAverageDiagnosticsHtml() {
  const hiddenAverage = solverHiddenAverageValue();
  if (!hiddenAverage) return "";
  const stock = solverStockImprovementDiagnostics();
  return `
    <span class="equity-note">Average unknown card value in your hidden-card pool: ${hiddenAverage.average.toFixed(2)} across ${hiddenAverage.count} cards.</span>
    ${stock ? `<span class="equity-note">Stock improvement chance: ${stock.chance.toFixed(0)}% (${stock.improving}/${stock.total} draws). Premium/low cards left: ${stock.premiumOrLow}. Pair hits: ${stock.pairHits}. Avg gain when useful: ${stock.averageGain.toFixed(2)}.</span>` : ""}
  `;
}

function solverPlayersState() {
  return Array.from({ length: solverPlayerCount }, (_, playerIndex) => ({
    name: solverNames[playerIndex],
    cards: solverHands[playerIndex].map((slot) => ({
      card: solverCardFromCode(slot.code),
      faceUp: !!slot.code,
    })),
  }));
}

function solverFinalScore(cards) {
  let total = 0;
  for (const column of [0, 1, 2]) {
    const top = cards[column];
    const bottom = cards[column + 3];
    if (top.label !== bottom.label) total += top.value + bottom.value;
  }
  return total;
}

function solverEstimateHand(playerIndex, override = null, samples = 800, poolOverride = null) {
  const state = solverPlayersState()[playerIndex];
  const pool = poolOverride ? [...poolOverride] : solverUnknownPool();
  const cards = state.cards.map((slot) => slot.card || null);
  let replacedUnknown = 0;
  if (override) {
    if (!state.cards[override.index].card) replacedUnknown = 1;
    cards[override.index] = override.card;
  }
  const hiddenIndexes = cards.map((card, index) => (card ? null : index)).filter((index) => index !== null);
  if (hiddenIndexes.length === 0) return solverFinalScore(cards);
  let total = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const shuffled = shuffle(pool);
    for (let i = 0; i < replacedUnknown; i += 1) shuffled.pop();
    const sampleCards = [...cards];
    for (const index of hiddenIndexes) sampleCards[index] = shuffled.pop();
    total += solverFinalScore(sampleCards);
  }
  return total / samples;
}

function solverVisibleDelta(card, index) {
  const state = solverPlayersState()[solverCurrentPlayer];
  const before = visibleScoreForSlots(state.cards.map((slot) => ({
    card: slot.card || { label: "?", value: 0 },
    faceUp: !!slot.card,
  })));
  const afterSlots = state.cards.map((slot) => ({
    card: slot.card || { label: "?", value: 0 },
    faceUp: !!slot.card,
  }));
  afterSlots[index] = { card, faceUp: true };
  return visibleScoreForSlots(afterSlots) - before;
}

function solverStockEV() {
  const pool = solverUnknownPool();
  if (pool.length === 0) return solverEstimateHand(solverCurrentPlayer);
  let total = 0;
  for (const card of pool) {
    const remainingPool = cardPoolWithout(pool, card);
    const pass = solverEstimateHand(solverCurrentPlayer, null, 300, remainingPool);
    const placements = Array.from({ length: 6 }, (_, index) =>
      solverEstimateHand(solverCurrentPlayer, { card, index }, 300, remainingPool)
    );
    total += Math.min(pass, ...placements);
  }
  return total / pool.length;
}

function solverEngineState() {
  return {
    players: solverPlayersState().map((player, index) => ({
      name: player.name,
      human: index === solverCurrentPlayer,
      cards: player.cards.map((slot) => ({
        card: slot.card,
        faceUp: !!slot.card,
      })),
    })),
    stock: solverUnknownPool(),
    stockIsUnknownPool: true,
    discard: solverDiscardPile.map((code) => solverCardFromCode(code)).filter(Boolean),
    currentPlayer: solverCurrentPlayer,
    phase: "draw",
    drawnCard: null,
    drawnFromDiscard: false,
    roundOver: false,
  };
}

function runSolver() {
  const duplicates = solverDuplicateWarnings();
  if (duplicates.length > 0) {
    solverOutputEl.innerHTML = `<p class="solver-warning">Duplicate cards in spot: ${duplicates.join(", ")}. Fix these before solving.</p>`;
    return;
  }
  if (!window.GolfEngine) {
    solverOutputEl.innerHTML = `<p class="solver-warning">Solver engine is not loaded. Refresh the page and try again.</p>`;
    return;
  }
  solverOutputEl.innerHTML = `<div class="equity-note">Running Dream Machine rollouts...</div>`;
  setTimeout(() => {
    const results = window.GolfEngine.evaluateActions(solverEngineState(), { samples: 360 });
    renderSolverEngineResults(results);
  }, 20);
}

function renderSolverEngineResults(results) {
  if (!results.length) {
    solverOutputEl.innerHTML = `<p class="solver-warning">No legal move is available for this spot.</p>`;
    return;
  }
  const best = results[0];
  const explanation = explainSolverBestMove(best, results);
  solverOutputEl.innerHTML = `
    <div class="equity-summary">
      <span>Best move</span>
      <span class="solving-for">Solving for ${solverNames[solverCurrentPlayer]}</span>
      ${solverAverageDiagnosticsHtml()}
      <strong>${best.label}</strong>
      <span class="equity-note">${explanation}</span>
      <span class="equity-note">${best.mechanicsNote || "Mechanics-first mode ranks basic card-game value before using rollouts as a tiebreaker."}</span>
      ${best.opponentThreat > 0 ? `<span class="equity-note">${best.opponentThreatLabel} Raw threat: ${best.opponentThreat.toFixed(2)}. Applied penalty is capped at ${best.opponentThreatPenalty.toFixed(2)}.</span>` : ""}
      <span class="equity-note">Lower is better. Rows show mechanics | opp threat | applied penalty | rollout EV | margin | now | win%.</span>
    </div>
    <div class="equity-list">
      ${results.map((result, index) => `
        <div class="equity-row ${index === 0 ? "best" : ""}">
          <span>${result.label}</span>
          <span>${result.mechanicsScore.toFixed(2)} | ${result.opponentThreat.toFixed(2)} | ${result.opponentThreatPenalty.toFixed(2)} | ${result.ev.toFixed(2)} | ${result.margin.toFixed(2)} | ${result.visibleDelta > 0 ? "+" : ""}${result.visibleDelta} | ${result.winPct.toFixed(0)}%</span>
        </div>
      `).join("")}
    </div>
  `;
}

function runGtoTreeSolve() {
  const duplicates = solverDuplicateWarnings();
  if (duplicates.length > 0) {
    solverOutputEl.innerHTML = `<p class="solver-warning">Duplicate cards in spot: ${duplicates.join(", ")}. Fix these before solving.</p>`;
    return;
  }
  if (!window.GolfEngine) {
    solverOutputEl.innerHTML = `<p class="solver-warning">Solver engine is not loaded. Refresh the page and try again.</p>`;
    return;
  }
  const samples = Number(gtoSamplesEl.value) || 1000;
  const depth = Number(gtoDepthEl.value) || 6;
  solverOutputEl.innerHTML = `<div class="equity-note">Starting background GTO tree solve...</div>`;
  gtoRunButtonEl.disabled = true;

  if (gtoWorker) gtoWorker.terminate();

  try {
    gtoWorker = createGtoWorker();
    gtoWorker.onmessage = (event) => {
      const { type, completed, message, results } = event.data;
      if (type === "progress") {
        renderGtoTreeResults(results, { completed, samples, depth, running: true });
      }
      if (type === "done") {
        renderGtoTreeResults(results, { completed, samples, depth, running: false });
        gtoRunButtonEl.disabled = false;
        gtoWorker.terminate();
        gtoWorker = null;
      }
      if (type === "error") {
        solverOutputEl.innerHTML = `<p class="solver-warning">${message}</p>`;
        gtoRunButtonEl.disabled = false;
      }
    };
    gtoWorker.onerror = () => {
      runGtoTreeFallback(depth, samples);
    };
    gtoWorker.postMessage({
      state: solverEngineState(),
      depth,
      samples,
      batchSize: Math.min(100, Math.max(25, Math.floor(samples / 10))),
    });
  } catch (error) {
    runGtoTreeFallback(depth, samples);
  }
}

function createGtoWorker() {
  const workerBody = `
    function actionKey(result) {
      return \`\${result.type}:\${result.index ?? ""}:\${result.label}\`;
    }

    function mergeBatch(totals, result, samples) {
      const key = actionKey(result);
      const current = totals.get(key) || {
        ...result,
        totalScore: 0,
        totalMargin: 0,
        totalWins: 0,
        samples: 0,
      };
      current.totalScore += result.ev * samples;
      current.totalMargin += result.margin * samples;
      current.totalWins += (result.winPct / 100) * samples;
      current.samples += samples;
      totals.set(key, current);
    }

    function finaliseTotals(totals) {
      return [...totals.values()]
        .map((result) => ({
          ...result,
          ev: result.totalScore / result.samples,
          margin: result.totalMargin / result.samples,
          winPct: (result.totalWins / result.samples) * 100,
          rankEV: result.totalScore / result.samples,
        }))
        .sort((a, b) => a.rankEV - b.rankEV || a.margin - b.margin || a.visibleDelta - b.visibleDelta);
    }

    self.onmessage = (event) => {
      const { state, depth, samples, batchSize } = event.data;
      const totals = new Map();
      let completed = 0;

      try {
        while (completed < samples) {
          const currentBatch = Math.min(batchSize, samples - completed);
          const results = self.GolfEngine.solveDecisionTree(state, {
            depth,
            samples: currentBatch,
          });
          for (const result of results) mergeBatch(totals, result, currentBatch);
          completed += currentBatch;
          self.postMessage({
            type: "progress",
            completed,
            samples,
            results: finaliseTotals(totals),
          });
        }

        self.postMessage({
          type: "done",
          completed,
          samples,
          results: finaliseTotals(totals),
        });
      } catch (error) {
        self.postMessage({
          type: "error",
          message: error?.message || "Tree solve failed.",
        });
      }
    };
  `;
  const source = `${window.GolfEngine.workerSource}\n${workerBody}`;
  const blob = new Blob([source], { type: "text/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

function runGtoTreeFallback(depth, samples) {
  if (gtoWorker) {
    gtoWorker.terminate();
    gtoWorker = null;
  }
  const fallbackSamples = Math.min(samples, 700);
  solverOutputEl.innerHTML = `<div class="equity-note">Background worker unavailable. Showing the stronger rollout solver instead of a noisy small tree.</div>`;
  setTimeout(() => {
    const results = window.GolfEngine.evaluateActions(solverEngineState(), {
      samples: fallbackSamples,
    });
    renderGtoTreeResults(results, {
      completed: fallbackSamples,
      samples: fallbackSamples,
      depth,
      running: false,
      fallback: true,
    });
    gtoRunButtonEl.disabled = false;
  }, 20);
}

function renderGtoTreeResults(results, meta = {}) {
  if (!results.length) {
    solverOutputEl.innerHTML = `<p class="solver-warning">No legal move is available for this spot.</p>`;
    return;
  }
  const best = results[0];
  const nextBest = results[1];
  const edge = nextBest ? nextBest.ev - best.ev : 0;
  const edgeText = nextBest
    ? edge < 0.25
      ? `This is very close: ${nextBest.label} is only ${edge.toFixed(2)} behind.`
      : `This is ${edge.toFixed(2)} points better than ${nextBest.label} in the tree.`
    : "Only one legal move is available.";
  const progress = meta.samples
    ? meta.fallback
      ? `Background tree worker was unavailable. Showing ${meta.completed} rollout worlds instead.`
      : `${meta.running ? "Running" : "Complete"}: ${meta.completed}/${meta.samples} worlds at depth ${meta.depth}.`
    : "Starter tree solve.";
  solverOutputEl.innerHTML = `
    <div class="equity-summary">
      <span>GTO tree solve</span>
      <span class="solving-for">Solving for ${solverNames[solverCurrentPlayer]}</span>
      ${solverAverageDiagnosticsHtml()}
      <strong>${best.label}</strong>
      <span class="equity-note">${edgeText}</span>
      <span class="equity-note">${progress}</span>
      <span class="equity-note">${meta.fallback ? "Fallback mode uses the stronger rollout solver because a local tree would be too small and noisy." : "Starter GTO mode: samples hidden worlds, then recursively assumes every player chooses the lowest-score branch for themselves."} Rows show score EV | margin | now | win%.</span>
    </div>
    <div class="equity-list">
      ${results.map((result, index) => `
          <div class="equity-row ${index === 0 ? "best" : ""}">
            <span>${result.label}</span>
          <span>${result.ev.toFixed(2)} | ${result.margin.toFixed(2)} | ${result.visibleDelta > 0 ? "+" : ""}${result.visibleDelta} | ${result.winPct.toFixed(0)}%</span>
          </div>
      `).join("")}
    </div>
  `;
}

function applyCpuBaselineAdjustment(actionType, ev) {
  if (!learnedCpuBaseline) return ev;
  if (actionType === "stock") {
    return ev - learnedCpuBaseline.stockPreference;
  }
  if (actionType === "discard") {
    return ev - learnedCpuBaseline.discardPreference;
  }
  return ev;
}

function explainSolverBestMove(best, results) {
  const nextBest = results[1];
  const parts = [];
  const now = best.visibleDelta ?? best.now ?? 0;
  if (now < 0) {
    parts.push(`It lowers your shown score by ${Math.abs(now)} right now.`);
  } else if (now > 0) {
    parts.push(`It raises your shown score by ${now} right now, so only take this seriously if the EV edge is clear.`);
  } else {
    parts.push("It does not change your shown score immediately.");
  }

  if (best.label.startsWith("Draw from stock")) {
    parts.push("Drawing keeps your options open because you can still pass a bad stock card.");
    parts.push("Taking the discard is guaranteed, but it commits you to that card immediately.");
  } else {
    const match = best.label.match(/card (\d+)/);
    const cardIndex = match ? Number(match[1]) - 1 : null;
    const discardCard = solverCardFromCode(solverDiscardPile.at(-1));
    if (discardCard && cardIndex !== null) {
      const partnerIndex = cardIndex < 3 ? cardIndex + 3 : cardIndex - 3;
      const partner = solverPlayersState()[solverCurrentPlayer].cards[partnerIndex];
      if (partner.card && partner.card.label === discardCard.label) {
        parts.push(`It pairs with card ${partnerIndex + 1}, so that column scores zero.`);
      } else if (!partner.card) {
        parts.push(`Its partner card ${partnerIndex + 1} is unknown, so the value comes from replacing a likely worse unknown/known card.`);
      } else {
        parts.push(`It does not make a pair with card ${partnerIndex + 1}.`);
      }
    }
  }

  if (nextBest) {
    const bestRank = best.mechanicsScore ?? best.ev;
    const nextRank = nextBest.mechanicsScore ?? nextBest.ev;
    const gap = nextRank - bestRank;
    if (gap < 0.25) {
      parts.push(`The top options are very close; ${nextBest.label} is only ${gap.toFixed(2)} points behind.`);
    } else {
      parts.push(`It is about ${gap.toFixed(2)} points better than ${nextBest.label} by mechanics-first score.`);
    }
  }
  return parts.join(" ");
}

function clearSolverSpot() {
  solverHands = createEmptySolverHands();
  solverDiscardPile = [];
  solverCurrentPlayer = 0;
  solverOutputEl.textContent = "Build a spot, then run the solver.";
  renderSolver();
}

function randomSolverSpot() {
  const deck = shuffle(solverDeckOptions().filter((option) => option.code).map((option) => option.code));
  solverHands = createEmptySolverHands();
  solverDiscardPile = [];
  solverCurrentPlayer = 0;

  for (let playerIndex = 0; playerIndex < solverPlayerCount; playerIndex += 1) {
    const knownIndexes = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 2 + Math.floor(Math.random() * 3));
    for (let slotIndex = 0; slotIndex < 6; slotIndex += 1) {
      solverHands[playerIndex][slotIndex] = {
        code: knownIndexes.includes(slotIndex) ? deck.pop() : "",
      };
    }
  }

  const maxDiscardCount = Math.min(18, Math.max(1, deck.length - 12));
  const discardBands = [
    [1, 4],
    [5, 9],
    [10, maxDiscardCount],
  ].filter(([min, max]) => max >= min);
  const [minDiscard, maxDiscard] = discardBands[Math.floor(Math.random() * discardBands.length)];
  const discardCount = minDiscard + Math.floor(Math.random() * (maxDiscard - minDiscard + 1));
  for (let i = 0; i < discardCount; i += 1) {
    solverDiscardPile.push(deck.pop());
  }

  solverOutputEl.textContent = "Random spot created. Run the solver when ready.";
  renderSolver();
}

function renderSolverDiscardList() {
  if (solverDiscardPile.length === 0) {
    solverDiscardListEl.innerHTML = `<span class="equity-note">No discard cards added.</span>`;
    return;
  }
  const topCode = solverDiscardPile.at(-1);
  const topCard = solverCardFromCode(topCode);
  solverDiscardListEl.innerHTML = `
    <div class="solver-discard-top">
      <span>Top card</span>
      <div class="solver-discard-top-card"></div>
    </div>
    <div class="solver-discard-history">
      ${solverDiscardPile
    .map((code, index) => `
      <div class="solver-discard-item">
        <span>${index === solverDiscardPile.length - 1 ? "Top" : `${solverDiscardPile.length - index} down`}: ${code}</span>
        <button type="button" data-index="${index}" data-remove="true">Remove</button>
      </div>
    `)
    .join("")}
    </div>
  `;
  const topCardEl = solverDiscardListEl.querySelector(".solver-discard-top-card");
  if (topCard && topCardEl) {
    topCardEl.append(renderCard(topCard, { faceUp: true }));
  }
}

function solverHandUsedCodes() {
  const codes = new Set();
  for (let playerIndex = 0; playerIndex < solverPlayerCount; playerIndex += 1) {
    for (const slot of solverHands[playerIndex]) {
      if (slot.code) codes.add(slot.code);
    }
  }
  return codes;
}

function solverKnownCodesExceptActiveSlot() {
  const codes = new Set(solverDiscardPile);
  for (let playerIndex = 0; playerIndex < solverPlayerCount; playerIndex += 1) {
    for (let slotIndex = 0; slotIndex < 6; slotIndex += 1) {
      if (
        solverActiveCardSlot &&
        solverActiveCardSlot.playerIndex === playerIndex &&
        solverActiveCardSlot.slotIndex === slotIndex
      ) {
        continue;
      }
      const code = solverHands[playerIndex][slotIndex].code;
      if (code) codes.add(code);
    }
  }
  return codes;
}

function openSolverDiscardPicker() {
  renderSolverDeckPicker();
  if (typeof solverDiscardDialogEl.showModal === "function") {
    solverDiscardDialogEl.showModal();
  } else {
    solverDiscardDialogEl.setAttribute("open", "");
  }
}

function closeSolverDiscardPicker() {
  if (typeof solverDiscardDialogEl.close === "function") {
    solverDiscardDialogEl.close();
  } else {
    solverDiscardDialogEl.removeAttribute("open");
  }
}

function renderSolverDeckPicker() {
  const usedInHands = solverHandUsedCodes();
  const selected = new Set(solverDiscardPile);
  const top = solverDiscardPile.at(-1);
  solverDeckPickerEl.innerHTML = solverDeckOptions()
    .filter((option) => option.code)
    .map((option) => {
      const used = usedInHands.has(option.code);
      const isSelected = selected.has(option.code);
      const isTop = option.code === top;
      return `
        <button type="button" class="solver-deck-card suit-${option.card.color} ${used ? "used" : ""} ${isSelected ? "selected" : ""} ${isTop ? "top-card" : ""}" data-code="${option.code}" ${used ? "disabled" : ""}>
          ${option.label}
          ${isTop ? "<span>Top</span>" : isSelected ? "<span>Discard</span>" : ""}
        </button>
      `;
    })
    .join("");
}

function toggleSolverDiscardCard(code) {
  if (solverHandUsedCodes().has(code)) return;
  const index = solverDiscardPile.indexOf(code);
  if (index === -1) {
    solverDiscardPile.push(code);
  } else if (index === solverDiscardPile.length - 1) {
    solverDiscardPile.splice(index, 1);
  } else {
    solverDiscardPile.splice(index, 1);
    solverDiscardPile.push(code);
  }
  renderSolverDiscardList();
  renderSolverDeckPicker();
}

function openSolverCardPicker(playerIndex, slotIndex) {
  solverActiveCardSlot = { playerIndex, slotIndex };
  renderSolverCardPicker();
  if (typeof solverCardDialogEl.showModal === "function") {
    solverCardDialogEl.showModal();
  } else {
    solverCardDialogEl.setAttribute("open", "");
  }
}

function closeSolverCardPicker() {
  solverActiveCardSlot = null;
  if (typeof solverCardDialogEl.close === "function") {
    solverCardDialogEl.close();
  } else {
    solverCardDialogEl.removeAttribute("open");
  }
}

function renderSolverCardPicker() {
  if (!solverActiveCardSlot) return;
  const currentCode = solverHands[solverActiveCardSlot.playerIndex][solverActiveCardSlot.slotIndex].code;
  const used = solverKnownCodesExceptActiveSlot();
  solverCardPickerEl.innerHTML = solverDeckOptions()
    .filter((option) => option.code)
    .map((option) => {
      const isUsed = used.has(option.code);
      const isSelected = option.code === currentCode;
      return `
        <button type="button" class="solver-deck-card suit-${option.card.color} ${isUsed ? "used" : ""} ${isSelected ? "selected top-card" : ""}" data-code="${option.code}" ${isUsed ? "disabled" : ""}>
          ${option.label}
          ${isSelected ? "<span>Selected</span>" : ""}
        </button>
      `;
    })
    .join("");
}

function setSolverSlotCard(code) {
  if (!solverActiveCardSlot) return;
  if (solverKnownCodesExceptActiveSlot().has(code)) return;
  solverHands[solverActiveCardSlot.playerIndex][solverActiveCardSlot.slotIndex].code = code;
  closeSolverCardPicker();
  renderSolverPlayers();
  renderSolverDiscardList();
}

function clearSolverSlotCard() {
  if (!solverActiveCardSlot) return;
  solverHands[solverActiveCardSlot.playerIndex][solverActiveCardSlot.slotIndex].code = "";
  closeSolverCardPicker();
  renderSolverPlayers();
  renderSolverDiscardList();
}

const cpuLabPolicies = [
  {
    name: "Greedy",
    discardTake: 2,
    stockKeep: 1,
    lowKeep: 3,
  },
  {
    name: "Cautious",
    discardTake: 4,
    stockKeep: 3,
    lowKeep: 1,
  },
  {
    name: "Discard-aware",
    discardTake: 1,
    stockKeep: 2,
    lowKeep: 3,
  },
  {
    name: "Stock-heavy",
    discardTake: 5,
    stockKeep: 2,
    lowKeep: 2,
  },
];

function cpuLabDeck() {
  return shuffle(solverDeckOptions().filter((option) => option.code).map((option) => option.card));
}

function cpuLabInitialPlayers(count) {
  const deck = cpuLabDeck();
  const labPlayers = Array.from({ length: count }, (_, index) => ({
    name: cpuLabPolicies[index % cpuLabPolicies.length].name,
    policy: cpuLabPolicies[index % cpuLabPolicies.length],
    cards: Array.from({ length: 6 }, () => ({ card: deck.pop(), faceUp: false })),
  }));
  for (const player of labPlayers) {
    const flips = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 2);
    flips.forEach((index) => {
      player.cards[index].faceUp = true;
    });
  }
  return {
    players: labPlayers,
    stock: deck,
    discard: [deck.pop()],
    currentPlayer: 0,
    roundOver: false,
  };
}

function cpuLabEnsureStock(state) {
  if (state.stock.length > 0) return;
  const top = state.discard.pop();
  state.stock = shuffle(state.discard);
  state.discard = top ? [top] : [];
}

function cpuLabChooseReplacement(player, card) {
  let best = { index: -1, gain: -Infinity, cancels: false };
  player.cards.forEach((slot, index) => {
    const partnerIndex = index < 3 ? index + 3 : index - 3;
    const partner = player.cards[partnerIndex];
    const assumedCurrent = slot.faceUp ? slot.card.value : 5.4;
    let newCost = card.value;
    let gain = assumedCurrent - newCost;
    const cancels = partner.faceUp && partner.card.label === card.label;
    if (cancels) {
      gain = assumedCurrent + partner.card.value;
    }
    if (gain > best.gain) best = { index, gain, cancels };
  });
  return best;
}

function cpuLabReplace(state, player, index, card) {
  const replaced = player.cards[index].card;
  player.cards[index] = { card, faceUp: true };
  state.discard.push(replaced);
}

function cpuLabFinishTurn(state) {
  if (state.players[state.currentPlayer].cards.every((slot) => slot.faceUp)) {
    state.roundOver = true;
    return;
  }
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
}

function cpuLabTurn(state, stats) {
  cpuLabEnsureStock(state);
  const player = state.players[state.currentPlayer];
  const policy = player.policy;
  const topDiscard = state.discard.at(-1);
  const discardChoice = cpuLabChooseReplacement(player, topDiscard);

  if (discardChoice.cancels || discardChoice.gain >= policy.discardTake) {
    const card = state.discard.pop();
    cpuLabReplace(state, player, discardChoice.index, card);
    stats[player.name].discardTakes += 1;
    cpuLabFinishTurn(state);
    return;
  }

  const drawn = state.stock.pop();
  const stockChoice = cpuLabChooseReplacement(player, drawn);
  if (stockChoice.cancels || stockChoice.gain >= policy.stockKeep || drawn.value <= policy.lowKeep) {
    cpuLabReplace(state, player, stockChoice.index, drawn);
    stats[player.name].stockKeeps += 1;
  } else {
    state.discard.push(drawn);
    stats[player.name].stockPasses += 1;
  }
  cpuLabFinishTurn(state);
}

function cpuLabScore(player) {
  return solverFinalScore(player.cards.map((slot) => slot.card));
}

function cpuLabRound(playerTotal) {
  const state = cpuLabInitialPlayers(playerTotal);
  const stats = Object.fromEntries(cpuLabPolicies.map((policy) => [
    policy.name,
    { rounds: 0, score: 0, wins: 0, discardTakes: 0, stockKeeps: 0, stockPasses: 0 },
  ]));
  let guard = 0;
  while (!state.roundOver && guard < 220) {
    cpuLabTurn(state, stats);
    guard += 1;
  }
  const scores = state.players.map((player) => ({ player, score: cpuLabScore(player) }));
  const bestScore = Math.min(...scores.map((entry) => entry.score));
  for (const { player, score } of scores) {
    const row = stats[player.name];
    row.rounds += 1;
    row.score += score;
    if (score === bestScore) row.wins += 1;
  }
  return stats;
}

function runCpuLab() {
  const rounds = Number(cpuLabRoundsEl.value);
  const playerTotal = solverPlayerCount;
  cpuLabOutputEl.innerHTML = `<div class="equity-note">Running ${rounds.toLocaleString()} simulated rounds...</div>`;
  setTimeout(() => {
    const totals = Object.fromEntries(cpuLabPolicies.map((policy) => [
      policy.name,
      { rounds: 0, score: 0, wins: 0, discardTakes: 0, stockKeeps: 0, stockPasses: 0 },
    ]));
    for (let i = 0; i < rounds; i += 1) {
      const result = cpuLabRound(playerTotal);
      for (const [name, row] of Object.entries(result)) {
        for (const key of Object.keys(row)) totals[name][key] += row[key];
      }
    }
    renderCpuLab(totals, rounds, playerTotal);
  }, 20);
}

function renderCpuLab(totals, rounds, playerTotal) {
  const rows = Object.entries(totals)
    .filter(([, row]) => row.rounds > 0)
    .map(([name, row]) => ({
      name,
      avgScore: row.score / row.rounds,
      winRate: (row.wins / row.rounds) * 100,
      discardTakes: row.discardTakes / row.rounds,
      stockKeeps: row.stockKeeps / row.rounds,
      stockPasses: row.stockPasses / row.rounds,
    }))
    .sort((a, b) => a.avgScore - b.avgScore);
  const best = rows[0];
  learnedCpuBaseline = {
    policy: best.name,
    avgScore: best.avgScore,
    stockPreference: Math.min(1.25, best.stockKeeps * 0.08 + best.stockPasses * 0.04),
    discardPreference: Math.min(1.25, best.discardTakes * 0.08),
  };

  cpuLabOutputEl.innerHTML = `
    <div class="equity-summary">
      <strong>${rounds.toLocaleString()} rounds, ${playerTotal} players</strong>
      <span class="equity-note">EV baseline: lower average score is better. Best policy is now feeding small priors into the spot solver.</span>
    </div>
    <div class="lab-table">
      ${rows.map((row, index) => `
        <div class="lab-row ${index === 0 ? "best" : ""}">
          <span>${row.name}</span>
          <span>${row.avgScore.toFixed(2)} EV</span>
          <span>${row.winRate.toFixed(1)}%</span>
        </div>
      `).join("")}
    </div>
    <div class="equity-note">
      ${best.name} takes discard ${best.discardTakes.toFixed(1)} times/round, keeps stock ${best.stockKeeps.toFixed(1)} times/round, passes stock ${best.stockPasses.toFixed(1)} times/round. Solver priors: stock ${learnedCpuBaseline.stockPreference.toFixed(2)}, discard ${learnedCpuBaseline.discardPreference.toFixed(2)}.
    </div>
  `;
}

stockPileEl.addEventListener("click", drawFromStock);
discardPileEl.addEventListener("click", drawFromDiscard);
openDiscardButtonEl.addEventListener("click", openDiscardHistory);
closeDiscardButtonEl.addEventListener("click", closeDiscardHistory);
throwDrawnButtonEl.addEventListener("click", throwDrawnAndFlip);
newRoundButtonEl.addEventListener("click", startRound);
nextHoleButtonEl.addEventListener("click", startRound);
menuButtonEl.addEventListener("click", showMenu);
solverButtonEl.addEventListener("click", showSolver);
solverMenuButtonEl.addEventListener("click", showMenu);
startGameButtonEl.addEventListener("click", startNewGame);
resumeGameButtonEl.addEventListener("click", showGame);
hintButtonEl.addEventListener("click", calculateEquity);
autoPlayButtonEl.addEventListener("click", autoPlayCpus);
playerCountControlsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-count]");
  if (!button) return;
  setPlayerCount(Number(button.dataset.count));
});
menuPlayerCountControlsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-count]");
  if (!button) return;
  setMenuPlayerCount(Number(button.dataset.count));
});
solverPlayerCountControlsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-count]");
  if (!button) return;
  setSolverPlayerCount(Number(button.dataset.count));
});
solverCurrentPlayerEl.addEventListener("change", () => {
  solverCurrentPlayer = 0;
  renderSolverPlayers();
});
solverOpenDiscardButtonEl.addEventListener("click", openSolverDiscardPicker);
solverCloseDiscardButtonEl.addEventListener("click", closeSolverDiscardPicker);
solverClearDiscardButtonEl.addEventListener("click", () => {
  solverDiscardPile = [];
  renderSolverDiscardList();
  renderSolverDeckPicker();
});
solverDeckPickerEl.addEventListener("click", (event) => {
  const cardButton = event.target.closest(".solver-deck-card");
  if (!cardButton || cardButton.disabled) return;
  toggleSolverDiscardCard(cardButton.dataset.code);
});
solverCardPickerEl.addEventListener("click", (event) => {
  const cardButton = event.target.closest(".solver-deck-card");
  if (!cardButton || cardButton.disabled) return;
  setSolverSlotCard(cardButton.dataset.code);
});
solverCloseCardButtonEl.addEventListener("click", closeSolverCardPicker);
solverClearCardButtonEl.addEventListener("click", clearSolverSlotCard);
solverDiscardListEl.addEventListener("click", (event) => {
  const removeButton = event.target.closest("button[data-remove]");
  if (removeButton) {
    solverDiscardPile.splice(Number(removeButton.dataset.index), 1);
    renderSolverControls();
    renderSolverDeckPicker();
  }
});
solverPlayersEl.addEventListener("click", (event) => {
  const button = event.target.closest(".solver-card-button");
  if (!button) return;
  openSolverCardPicker(Number(button.dataset.player), Number(button.dataset.slot));
});
solverRunButtonEl.addEventListener("click", runSolver);
gtoRunButtonEl.addEventListener("click", runGtoTreeSolve);
solverClearButtonEl.addEventListener("click", clearSolverSpot);
solverRandomButtonEl.addEventListener("click", randomSolverSpot);
cpuLabRunButtonEl.addEventListener("click", runCpuLab);

showMenu();
renderPlayerCountControls();
renderSolver();
