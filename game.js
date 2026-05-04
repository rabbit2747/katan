"use strict";

const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
const RESOURCE_BANK_SIZE = 19;
const RESOURCE_LABEL = {
  wood: "목재",
  brick: "벽돌",
  sheep: "양",
  wheat: "밀",
  ore: "광석",
};
const RESOURCE_EMOJI = {
  wood: "🪵",
  brick: "🧱",
  sheep: "🐑",
  wheat: "🌾",
  ore: "🪨",
};
const TERRAIN = {
  forest: { label: "숲", resource: "wood", color: "#357852" },
  hill: { label: "언덕", resource: "brick", color: "#b65b3c" },
  pasture: { label: "목초지", resource: "sheep", color: "#7fb95b" },
  field: { label: "밀밭", resource: "wheat", color: "#d9b844" },
  mountain: { label: "산", resource: "ore", color: "#8a8c88" },
  desert: { label: "사막", resource: null, color: "#d8be79" },
};
const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  dev: { sheep: 1, wheat: 1, ore: 1 },
};
const PLAYER_COLORS = ["#2563a5", "#b94235", "#d97706", "#8e5bb8"];
const DEV_DECK_TEMPLATE = [
  ...Array(14).fill("knight"),
  ...Array(5).fill("victory"),
  ...Array(2).fill("roadBuilding"),
  ...Array(2).fill("yearOfPlenty"),
  ...Array(2).fill("monopoly"),
];
const DEV_LABEL = {
  knight: "기사",
  victory: "승점",
  roadBuilding: "도로 건설",
  yearOfPlenty: "풍년",
  monopoly: "독점",
};
const PORT_TYPES = ["generic", "generic", "generic", "generic", "wood", "brick", "sheep", "wheat", "ore"];
const PORT_LABEL = {
  generic: "3:1",
  wood: "목재 2:1",
  brick: "벽돌 2:1",
  sheep: "양 2:1",
  wheat: "밀 2:1",
  ore: "광석 2:1",
};
const HEX_SIZE = 76;
const BOARD_CENTER = { x: 460, y: 360 };
const HEX_DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

let state = null;
let selectedBuild = null;
let freeRoadsToPlace = 0;
let robberContext = null;
let robberVictimContext = null;
let discardContext = null;
let monopolyContext = null;

const els = {
  board: document.getElementById("board"),
  playBtn: document.getElementById("playBtn"),
  newGameModal: document.getElementById("newGameModal"),
  closeNewGameBtn: document.getElementById("closeNewGameBtn"),
  optionsBtn: document.getElementById("optionsBtn"),
  optionsModal: document.getElementById("optionsModal"),
  closeOptionsBtn: document.getElementById("closeOptionsBtn"),
  devHelpBtn: document.getElementById("devHelpBtn"),
  devHelpModal: document.getElementById("devHelpModal"),
  closeDevHelpBtn: document.getElementById("closeDevHelpBtn"),
  monopolyModal: document.getElementById("monopolyModal"),
  monopolyChoices: document.getElementById("monopolyChoices"),
  robberVictimModal: document.getElementById("robberVictimModal"),
  robberVictimChoices: document.getElementById("robberVictimChoices"),
  discardModal: document.getElementById("discardModal"),
  discardSummary: document.getElementById("discardSummary"),
  discardList: document.getElementById("discardList"),
  discardRemaining: document.getElementById("discardRemaining"),
  confirmDiscardBtn: document.getElementById("confirmDiscardBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  targetScoreInput: document.getElementById("targetScoreInput"),
  playerColorInputs: Array.from({ length: 4 }, (_, i) => document.getElementById(`playerColor${i}`)),
  npcTurnDelay: document.getElementById("npcTurnDelay"),
  npcTurnDelayValue: document.getElementById("npcTurnDelayValue"),
  emojiToggle: document.getElementById("emojiToggle"),
  rollBtn: document.getElementById("rollBtn"),
  endTurnBtn: document.getElementById("endTurnBtn"),
  turnPlayer: document.getElementById("turnPlayer"),
  turnPhase: document.getElementById("turnPhase"),
  turnTrack: document.getElementById("turnTrack"),
  playerDiceGrid: document.getElementById("playerDiceGrid"),
  diceDisplay: document.getElementById("diceDisplay"),
  scoreboard: document.getElementById("scoreboard"),
  statusText: document.getElementById("statusText"),
  buildHint: document.getElementById("buildHint"),
  resourceBar: document.getElementById("resourceBar"),
  bankResourceBar: document.getElementById("bankResourceBar"),
  costList: document.getElementById("costList"),
  log: document.getElementById("log"),
  giveResource: document.getElementById("giveResource"),
  takeResource: document.getElementById("takeResource"),
  bankTradeBtn: document.getElementById("bankTradeBtn"),
  playerTradeBtn: document.getElementById("playerTradeBtn"),
  playerTradeModal: document.getElementById("playerTradeModal"),
  closePlayerTradeBtn: document.getElementById("closePlayerTradeBtn"),
  tradeOpponentSelect: document.getElementById("tradeOpponentSelect"),
  tradeGiveResource: document.getElementById("tradeGiveResource"),
  tradeGiveAmount: document.getElementById("tradeGiveAmount"),
  tradeTakeResource: document.getElementById("tradeTakeResource"),
  tradeTakeAmount: document.getElementById("tradeTakeAmount"),
  playerTradeStatus: document.getElementById("playerTradeStatus"),
  submitPlayerTradeBtn: document.getElementById("submitPlayerTradeBtn"),
  tradeRate: document.getElementById("tradeRate"),
  devCards: document.getElementById("devCards"),
  awardCards: document.getElementById("awardCards"),
};

function emptyResources() {
  return Object.fromEntries(RESOURCES.map((r) => [r, 0]));
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function key(parts) {
  return parts.join(",");
}

function axialToPixel(q, r) {
  return {
    x: BOARD_CENTER.x + HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: BOARD_CENTER.y + HEX_SIZE * 1.5 * r,
  };
}

function vertexPoints(cx, cy) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return {
      x: cx + HEX_SIZE * Math.cos(angle),
      y: cy + HEX_SIZE * Math.sin(angle),
    };
  });
}

function pointKey(p) {
  return `${Math.round(p.x)},${Math.round(p.y)}`;
}

function createBoard() {
  const coords = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      if (Math.abs(q + r) <= 2) coords.push({ q, r });
    }
  }

  const terrains = shuffle([
    ...Array(4).fill("forest"),
    ...Array(3).fill("hill"),
    ...Array(4).fill("pasture"),
    ...Array(4).fill("field"),
    ...Array(3).fill("mountain"),
    "desert",
  ]);
  const numbers = shuffle([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
  const vertices = new Map();
  const edges = new Map();

  const hexes = coords.map((coord, index) => {
    const terrain = terrains[index];
    const center = axialToPixel(coord.q, coord.r);
    const points = vertexPoints(center.x, center.y);
    const vertexIds = points.map((p) => {
      const id = pointKey(p);
      if (!vertices.has(id)) {
        vertices.set(id, { id, x: Math.round(p.x), y: Math.round(p.y), building: null, hexes: [] });
      }
      vertices.get(id).hexes.push(index);
      return id;
    });
    const edgeIds = vertexIds.map((from, i) => {
      const to = vertexIds[(i + 1) % 6];
      const id = [from, to].sort().join("|");
      if (!edges.has(id)) edges.set(id, { id, vertices: [from, to], owner: null });
      return id;
    });

    return {
      id: index,
      q: coord.q,
      r: coord.r,
      terrain,
      number: terrain === "desert" ? null : numbers.pop(),
      center,
      points,
      vertexIds,
      edgeIds,
      robber: terrain === "desert",
    };
  });

  const vertexList = [...vertices.values()];
  const edgeList = [...edges.values()];
  vertexList.forEach((v) => {
    v.edges = edgeList.filter((e) => e.vertices.includes(v.id)).map((e) => e.id);
  });
  const ports = createPorts(vertexList);

  return { hexes, vertices: vertexList, edges: edgeList, ports };
}

function createPorts(vertices) {
  const coastal = vertices
    .filter((v) => v.hexes.length < 3)
    .map((v) => ({
      ...v,
      angle: Math.atan2(v.y - BOARD_CENTER.y, v.x - BOARD_CENTER.x),
    }))
    .sort((a, b) => a.angle - b.angle);
  const types = shuffle(PORT_TYPES);
  const spacing = Math.max(1, Math.floor(coastal.length / 9));
  const used = new Set();
  const ports = [];

  for (let i = 0; i < 9; i += 1) {
    const start = (i * spacing) % coastal.length;
    const pair = findCoastalPortPair(coastal, start, used);
    if (!pair) continue;
    pair.forEach((vertex) => used.add(vertex.id));
    const mid = {
      x: (pair[0].x + pair[1].x) / 2,
      y: (pair[0].y + pair[1].y) / 2,
    };
    const dx = mid.x - BOARD_CENTER.x;
    const dy = mid.y - BOARD_CENTER.y;
    const len = Math.hypot(dx, dy) || 1;
    ports.push({
      id: `port-${i}`,
      type: types[i],
      vertices: pair.map((vertex) => vertex.id),
      x: mid.x + (dx / len) * 54,
      y: mid.y + (dy / len) * 54,
      dockX: mid.x,
      dockY: mid.y,
    });
  }
  return ports;
}

function findCoastalPortPair(coastal, start, used) {
  for (let offset = 0; offset < coastal.length; offset += 1) {
    const a = coastal[(start + offset) % coastal.length];
    const b = coastal[(start + offset + 1) % coastal.length];
    if (!a || !b || used.has(a.id) || used.has(b.id)) continue;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance < HEX_SIZE * 1.25) return [a, b];
  }
  return null;
}

function createPlayers(difficulty) {
  const colors = getConfiguredPlayerColors();
  return ["나", "NPC A", "NPC B", "NPC C"].map((name, i) => ({
    id: i,
    name,
    color: colors[i],
    isHuman: i === 0,
    difficulty: i === 0 ? null : difficulty,
    resources: emptyResources(),
    devCards: [],
    playedKnights: 0,
    roads: 0,
    settlements: 0,
    cities: 0,
    longestRoad: 0,
    lastRoll: null,
  }));
}

function getConfiguredPlayerColors() {
  return els.playerColorInputs.map((input, index) => input?.value || PLAYER_COLORS[index]);
}

function getNpcTurnDelay() {
  return Number(els.npcTurnDelay?.value || 1500);
}

function useEmoji() {
  return Boolean(els.emojiToggle?.checked);
}

function resourceText(res, mode = "name") {
  if (!useEmoji()) return RESOURCE_LABEL[res];
  if (mode === "emoji") return RESOURCE_EMOJI[res];
  if (mode === "compact") return `${RESOURCE_EMOJI[res]} ${RESOURCE_LABEL[res]}`;
  return `${RESOURCE_LABEL[res]} ${RESOURCE_EMOJI[res]}`;
}

function updateNpcDelayLabel() {
  if (!els.npcTurnDelayValue) return;
  els.npcTurnDelayValue.textContent = `${(getNpcTurnDelay() / 1000).toFixed(1)}초`;
}

function applyPlayerColorSettings() {
  if (!state) return;
  getConfiguredPlayerColors().forEach((color, index) => {
    state.players[index].color = color;
  });
  render();
}

function openOptionsModal() {
  els.optionsModal.hidden = false;
}

function closeOptionsModal() {
  els.optionsModal.hidden = true;
}

function openNewGameModal() {
  els.newGameModal.hidden = false;
}

function closeNewGameModal() {
  els.newGameModal.hidden = true;
}

function openDevHelpModal() {
  els.devHelpModal.hidden = false;
}

function closeDevHelpModal() {
  els.devHelpModal.hidden = true;
}

function openMonopolyModal(playerId) {
  monopolyContext = { playerId };
  els.monopolyChoices.innerHTML = RESOURCES.map((res) => {
    const total = state.players
      .filter((player) => player.id !== playerId)
      .reduce((sum, player) => sum + player.resources[res], 0);
    return `<button data-monopoly="${res}">${resourceText(res, "compact")}<br><span>상대 보유 ${total}장</span></button>`;
  }).join("");
  els.monopolyChoices.querySelectorAll("[data-monopoly]").forEach((btn) => {
    btn.addEventListener("click", () => resolveMonopoly(btn.dataset.monopoly));
  });
  els.monopolyModal.hidden = false;
}

function resolveMonopoly(resource) {
  if (!monopolyContext) return;
  const player = getPlayer(monopolyContext.playerId);
  let gained = 0;
  state.players.forEach((p) => {
    if (p.id === player.id) return;
    gained += p.resources[resource];
    player.resources[resource] += p.resources[resource];
    p.resources[resource] = 0;
  });
  log(`독점 카드로 ${RESOURCE_LABEL[resource]} ${gained}장을 가져왔습니다.`);
  monopolyContext = null;
  els.monopolyModal.hidden = true;
  checkWin();
  render();
}

function renderDiscardModal() {
  if (!discardContext) return;
  const player = getPlayer(discardContext.playerId);
  const selectedTotal = resourceCount({ resources: discardContext.selected });
  const remaining = discardContext.required - selectedTotal;
  els.discardSummary.textContent = `자원 ${resourceCount(player)}장 중 ${discardContext.required}장을 골라서 버리세요.`;
  els.discardList.innerHTML = RESOURCES.map((res) => {
    const owned = player.resources[res];
    const selected = discardContext.selected[res];
    return `
      <div class="discard-row">
        <strong>${resourceText(res, "compact")}</strong>
        <span>보유 ${owned}장</span>
        <button data-discard="${res}" data-delta="-1" ${selected <= 0 ? "disabled" : ""}>-</button>
        <div class="discard-count">${selected}</div>
        <button data-discard="${res}" data-delta="1" ${selected >= owned || remaining <= 0 ? "disabled" : ""}>+</button>
      </div>
    `;
  }).join("");
  els.discardRemaining.textContent = remaining > 0 ? `${remaining}장 더 선택` : "선택 완료";
  els.confirmDiscardBtn.disabled = remaining !== 0;
  els.discardList.querySelectorAll("[data-discard]").forEach((btn) => {
    btn.addEventListener("click", () => adjustDiscard(btn.dataset.discard, Number(btn.dataset.delta)));
  });
}

function adjustDiscard(res, delta) {
  if (!discardContext) return;
  const player = getPlayer(discardContext.playerId);
  const current = discardContext.selected[res];
  const selectedTotal = resourceCount({ resources: discardContext.selected });
  if (delta > 0 && (current >= player.resources[res] || selectedTotal >= discardContext.required)) return;
  if (delta < 0 && current <= 0) return;
  discardContext.selected[res] += delta;
  renderDiscardModal();
}

function confirmDiscard() {
  if (!discardContext) return;
  const selectedTotal = resourceCount({ resources: discardContext.selected });
  if (selectedTotal !== discardContext.required) return;
  const player = getPlayer(discardContext.playerId);
  RESOURCES.forEach((res) => {
    const amount = discardContext.selected[res];
    player.resources[res] -= amount;
    state.bank[res] += amount;
  });
  const robberPlayerId = discardContext.robberPlayerId;
  log(`${player.name}이 자원 ${discardContext.required}장을 골라 버렸습니다.`);
  discardContext = null;
  els.discardModal.hidden = true;
  finishSevenAfterDiscards(robberPlayerId);
  render();
}

function newGame() {
  const targetScore = Math.max(5, Math.min(20, Number(els.targetScoreInput.value || 10)));
  els.targetScoreInput.value = targetScore;
  state = {
    board: createBoard(),
    players: createPlayers(els.difficultySelect.value),
    currentPlayer: 0,
    phase: "setupOrderRoll",
    dice: null,
    devDeck: shuffle(DEV_DECK_TEMPLATE),
    bank: Object.fromEntries(RESOURCES.map((r) => [r, RESOURCE_BANK_SIZE])),
    longestRoadOwner: null,
    largestArmyOwner: null,
    targetScore,
    turnCounter: 1,
    devPlayedThisTurn: false,
    setupDone: false,
    setup: null,
    gameOver: false,
    log: [],
    lastProduction: null,
    rollAnimation: null,
  };
  state.setup = createSetupState();
  state.currentPlayer = state.setup.rollQueue[0];
  selectedBuild = null;
  freeRoadsToPlace = 0;
  robberContext = null;
  robberVictimContext = null;
  discardContext = null;
  monopolyContext = null;
  log("선 결정 주사위를 굴립니다. 각 참가자가 차례대로 굴립니다.");
  closeNewGameModal();
  render();
  continueSetupAutomation();
}

function createSetupState() {
  return {
    rolls: Array(state.players.length).fill(null),
    order: [],
    placementQueue: [],
    rollQueue: state.players.map((player) => player.id),
    rollingIndex: 0,
    rerollCount: 0,
    step: 0,
    pendingSettlement: null,
  };
}

function continueSetupAutomation() {
  if (!state || state.setupDone || state.gameOver) return;
  if (state.rollAnimation) return;
  if (getPlayer().isHuman) return;
  setTimeout(() => {
    if (!state || state.setupDone || getPlayer().isHuman) return;
    if (state.phase === "setupOrderRoll") {
      rollSetupOrderDice();
    } else {
      npcSetupPlacement();
    }
    continueSetupAutomation();
  }, getNpcTurnDelay());
}

function rollSetupOrderDice() {
  if (!state || state.phase !== "setupOrderRoll" || state.rollAnimation) return;
  const total = d6() + d6();
  const playerId = state.currentPlayer;
  startRollAnimation(playerId, total, () => finishSetupOrderDice(playerId, total));
}

function finishSetupOrderDice(playerId, total) {
  if (!state || state.phase !== "setupOrderRoll") return;
  state.setup.rolls[playerId] = total;
  getPlayer(playerId).lastRoll = total;
  state.dice = total;
  log(`${getPlayer(playerId).name} 선 결정 주사위: ${total}`);
  state.setup.rollingIndex += 1;

  if (state.setup.rollingIndex >= state.setup.rollQueue.length) {
    finishSetupOrderRolls();
    render();
    continueSetupAutomation();
    return;
  }

  state.currentPlayer = state.setup.rollQueue[state.setup.rollingIndex];
  render();
  continueSetupAutomation();
}

function startRollAnimation(playerId, total, onDone) {
  state.rollAnimation = { playerId, total };
  state.dice = null;
  render();
  setTimeout(() => {
    if (!state) return;
    state.rollAnimation = null;
    onDone();
  }, 1000);
}

function finishSetupOrderRolls() {
  const rolled = state.setup.rollQueue.map((playerId) => ({
    playerId,
    roll: state.setup.rolls[playerId],
  }));
  const high = Math.max(...rolled.map((item) => item.roll));
  const tied = rolled.filter((item) => item.roll === high).map((item) => item.playerId);

  if (tied.length > 1) {
    state.setup.rerollCount += 1;
    tied.forEach((playerId) => {
      state.setup.rolls[playerId] = null;
      getPlayer(playerId).lastRoll = null;
    });
    state.setup.rollQueue = tied;
    state.setup.rollingIndex = 0;
    state.currentPlayer = tied[0];
    state.dice = null;
    log(`최고점 동점입니다. ${tied.map((id) => getPlayer(id).name).join(", ")}만 다시 굴립니다.`);
    return;
  }

  const order = state.players
    .map((player) => ({ playerId: player.id, roll: state.setup.rolls[player.id] }))
    .sort((a, b) => b.roll - a.roll || a.playerId - b.playerId)
    .map((item) => item.playerId);
  const firstPlayer = order[0];
  state.setup.order = order;
  state.setup.placementQueue = [...order, ...order.slice().reverse()];
  state.setup.rollingIndex = 0;
  state.currentPlayer = state.setup.placementQueue[0];
  state.phase = "setupSettlement";
  selectedBuild = "settlement";
  state.dice = null;
  log(`${getPlayer(firstPlayer).name}부터 초기 배치를 시작합니다.`);
}

function npcSetupPlacement() {
  const playerId = state.currentPlayer;
  const secondPass = state.setup.step >= state.setup.order.length;
  const spot = chooseInitialSettlement(playerId, secondPass);
  if (!spot) return;
  placeSettlement(playerId, spot.vertexId, true);
  const roadId = chooseInitialRoad(playerId, spot.vertexId);
  if (roadId) placeRoad(playerId, roadId, true);
  log(`${getPlayer(playerId).name}이 초기 마을과 도로를 배치했습니다.`);
  finishSetupPlacement(spot.vertexId);
}

function chooseInitialRoad(playerId, vertexId) {
  const candidates = adjacentFreeEdges(vertexId).filter((edge) => canBuildRoad(playerId, edge.id, true));
  candidates.sort((a, b) => roadExpansionScore(playerId, b.id) - roadExpansionScore(playerId, a.id));
  return candidates[0]?.id;
}

function finishSetupPlacement(vertexId) {
  const secondPass = state.setup.step >= state.setup.order.length;
  if (secondPass) grantStartingResources(state.currentPlayer, vertexId);
  state.setup.step += 1;
  state.setup.pendingSettlement = null;

  if (state.setup.step >= state.setup.placementQueue.length) {
    state.setupDone = true;
    state.phase = "roll";
    state.currentPlayer = state.setup.order[0];
    state.dice = null;
    selectedBuild = null;
    log("초기 배치가 끝났습니다. 첫 턴을 시작합니다.");
    render();
    if (!getPlayer().isHuman) setTimeout(runNpcTurn, getNpcTurnDelay());
    return;
  }

  state.currentPlayer = state.setup.placementQueue[state.setup.step];
  state.phase = "setupSettlement";
  selectedBuild = "settlement";
  render();
}

function chooseInitialSettlement(playerId, secondPass) {
  const legalVertices = state.board.vertices.filter((v) => canBuildSettlement(playerId, v.id, true));
  const scored = legalVertices.map((v) => {
    const score = v.hexes.reduce((sum, hexId) => {
      const hex = state.board.hexes[hexId];
      return sum + numberWeight(hex.number) + (TERRAIN[hex.terrain].resource ? 1.5 : 0);
    }, 0);
    return { vertexId: v.id, score: score + Math.random() * (secondPass ? 4 : 2) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function grantStartingResources(playerId, vertexId) {
  const vertex = getVertex(vertexId);
  vertex.hexes.forEach((hexId) => {
    const res = TERRAIN[state.board.hexes[hexId].terrain].resource;
    if (res) gainResource(playerId, res, 1);
  });
}

function numberWeight(number) {
  if (!number) return 0;
  return { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[number] || 0;
}

function getPlayer(id = state.currentPlayer) {
  return state.players[id];
}

function getVertex(id) {
  return state.board.vertices.find((v) => v.id === id);
}

function getEdge(id) {
  return state.board.edges.find((e) => e.id === id);
}

function getHex(id) {
  return state.board.hexes.find((h) => h.id === id);
}

function adjacentFreeEdges(vertexId) {
  return getVertex(vertexId).edges.map(getEdge).filter((e) => !e.owner);
}

function hasResources(player, cost) {
  return Object.entries(cost).every(([res, amount]) => player.resources[res] >= amount);
}

function spendResources(playerId, cost) {
  const player = getPlayer(playerId);
  if (!hasResources(player, cost)) return false;
  Object.entries(cost).forEach(([res, amount]) => {
    player.resources[res] -= amount;
    state.bank[res] += amount;
  });
  return true;
}

function gainResource(playerId, res, amount) {
  const actual = Math.min(amount, state.bank[res]);
  state.bank[res] -= actual;
  getPlayer(playerId).resources[res] += actual;
  return actual;
}

function canBuildRoad(playerId, edgeId, free = false) {
  const edge = getEdge(edgeId);
  const player = getPlayer(playerId);
  if (!edge || edge.owner !== null || (!free && !hasResources(player, COSTS.road))) return false;
  if (free && !state.setupDone) return true;
  return edge.vertices.some((vertexId) => {
    const v = getVertex(vertexId);
    if (v.building?.owner === playerId) return true;
    if (v.building && v.building.owner !== playerId) return false;
    return v.edges.some((nearEdgeId) => getEdge(nearEdgeId).owner === playerId);
  });
}

function canBuildSettlement(playerId, vertexId, free = false) {
  const v = getVertex(vertexId);
  const player = getPlayer(playerId);
  if (!v || v.building || player.settlements >= 5) return false;
  if (!free && !hasResources(player, COSTS.settlement)) return false;
  const tooClose = v.edges.some((edgeId) => getEdge(edgeId).vertices.some((id) => id !== vertexId && getVertex(id).building));
  if (tooClose) return false;
  if (free) return true;
  return v.edges.some((edgeId) => getEdge(edgeId).owner === playerId);
}

function canBuildCity(playerId, vertexId) {
  const v = getVertex(vertexId);
  const player = getPlayer(playerId);
  return Boolean(v?.building?.owner === playerId && v.building.type === "settlement" && player.cities < 4 && hasResources(player, COSTS.city));
}

function placeRoad(playerId, edgeId, free = false) {
  if (!canBuildRoad(playerId, edgeId, free)) return false;
  if (!free && !spendResources(playerId, COSTS.road)) return false;
  getEdge(edgeId).owner = playerId;
  getPlayer(playerId).roads += 1;
  updateLongestRoad();
  return true;
}

function placeSettlement(playerId, vertexId, free = false) {
  if (!canBuildSettlement(playerId, vertexId, free)) return false;
  if (!free && !spendResources(playerId, COSTS.settlement)) return false;
  getVertex(vertexId).building = { owner: playerId, type: "settlement" };
  getPlayer(playerId).settlements += 1;
  updateLongestRoad();
  return true;
}

function placeCity(playerId, vertexId) {
  if (!canBuildCity(playerId, vertexId)) return false;
  if (!spendResources(playerId, COSTS.city)) return false;
  getVertex(vertexId).building.type = "city";
  const player = getPlayer(playerId);
  player.settlements -= 1;
  player.cities += 1;
  return true;
}

function rollDice() {
  if (!state || state.gameOver || state.rollAnimation || !getPlayer().isHuman) return;
  if (state.phase === "setupOrderRoll") {
    rollSetupOrderDice();
    return;
  }
  if (state.phase !== "roll") return;
  if (freeRoadsToPlace > 0) {
    flashStatus(`무료 도로 ${freeRoadsToPlace}개를 먼저 배치하세요.`);
    return;
  }
  const total = d6() + d6();
  startRegularRoll(state.currentPlayer, total, () => {
    if (state.phase === "roll") state.phase = "build";
    render();
  });
}

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

function resolveRoll(total) {
  state.dice = total;
  getPlayer(state.currentPlayer).lastRoll = total;
  state.lastProduction = null;
  log(`${getPlayer().name} 주사위: ${total}`);
  if (total === 7) {
    handleSeven(state.currentPlayer);
    return;
  }
  const demand = Object.fromEntries(RESOURCES.map((r) => [r, []]));
  state.board.hexes.forEach((hex) => {
    if (hex.number !== total || hex.robber) return;
    const res = TERRAIN[hex.terrain].resource;
    if (!res) return;
    hex.vertexIds.forEach((vertexId) => {
      const building = getVertex(vertexId).building;
      if (building) demand[res].push({ playerId: building.owner, amount: building.type === "city" ? 2 : 1 });
    });
  });
  RESOURCES.forEach((res) => {
    const requests = demand[res];
    const totalNeeded = requests.reduce((sum, item) => sum + item.amount, 0);
    if (totalNeeded === 0) return;
    if (state.bank[res] >= totalNeeded) {
      requests.forEach((item) => {
        const gained = gainResource(item.playerId, res, item.amount);
        recordProductionGain(item.playerId, res, gained);
      });
    } else {
      log(`${RESOURCE_LABEL[res]} 부족으로 이번 생산은 지급되지 않았습니다.`);
    }
  });
  logProductionSummary(total);
}

function startRegularRoll(playerId, total, onDone) {
  startRollAnimation(playerId, total, () => {
    resolveRoll(total);
    onDone();
  });
}

function recordProductionGain(playerId, res, amount) {
  if (!amount) return;
  if (!state.lastProduction) {
    state.lastProduction = {
      roll: state.dice,
      gains: Object.fromEntries(state.players.map((player) => [player.id, emptyResources()])),
    };
  }
  state.lastProduction.gains[playerId][res] += amount;
}

function logProductionSummary(total) {
  if (!state.lastProduction) {
    log(`${total}: 생산된 자원이 없습니다.`);
    return;
  }
  const parts = state.players
    .map((player) => {
      const gained = formatResourceGain(state.lastProduction.gains[player.id]);
      return gained ? `${player.name} ${gained}` : "";
    })
    .filter(Boolean);
  log(`${total}: ${parts.join(" / ")}`);
}

function handleSeven(playerId) {
  let humanMustDiscard = false;
  state.players.forEach((player) => {
    const count = resourceCount(player);
    if (count > 7) {
      if (player.isHuman) {
        humanMustDiscard = true;
      } else {
        autoDiscardResources(player.id, Math.floor(count / 2));
      }
    }
  });
  if (humanMustDiscard) {
    startHumanDiscard(playerId);
    return;
  }
  finishSevenAfterDiscards(playerId);
}

function autoDiscardResources(playerId, amount) {
  const player = getPlayer(playerId);
  let toDiscard = amount;
  RESOURCES.slice().sort((a, b) => player.resources[b] - player.resources[a]).forEach((res) => {
    const n = Math.min(toDiscard, player.resources[res]);
    player.resources[res] -= n;
    state.bank[res] += n;
    toDiscard -= n;
  });
  log(`${player.name}이 자원 ${amount}장을 버렸습니다.`);
}

function startHumanDiscard(robberPlayerId) {
  const player = getPlayer(0);
  discardContext = {
    playerId: 0,
    robberPlayerId,
    required: Math.floor(resourceCount(player) / 2),
    selected: emptyResources(),
  };
  state.phase = "discard";
  selectedBuild = null;
  renderDiscardModal();
  els.discardModal.hidden = false;
  render();
}

function finishSevenAfterDiscards(playerId) {
  if (getPlayer(playerId).isHuman) {
    startHumanRobberMove("seven");
  } else {
    moveRobber(playerId);
  }
}

function startHumanRobberMove(source) {
  robberContext = { playerId: state.currentPlayer, source };
  state.phase = "robberMove";
  selectedBuild = null;
  log("도둑을 옮길 타일을 선택하세요.");
  render();
}

function moveRobber(playerId) {
  const target = chooseRobberHex(playerId);
  placeRobberOnHex(playerId, target.id);
}

function moveRobberMarker(hexId) {
  const target = getHex(hexId);
  if (!target || target.robber) return null;
  state.board.hexes.forEach((h) => {
    h.robber = h.id === target.id;
  });
  return target;
}

function getRobberVictims(target, playerId) {
  const owners = target.vertexIds
    .map((id) => getVertex(id).building?.owner)
    .filter((owner) => owner !== undefined && owner !== playerId && resourceCount(getPlayer(owner)) > 0);
  return [...new Set(owners)];
}

function placeRobberOnHex(playerId, hexId) {
  const target = moveRobberMarker(hexId);
  if (!target) return false;
  const victims = getRobberVictims(target, playerId);
  if (victims.length) {
    const victimId = victims[Math.floor(Math.random() * victims.length)];
    stealFromRobberVictim(playerId, victimId, target);
  } else {
    log(`${getPlayer(playerId).name}이 도둑을 ${TERRAIN[target.terrain].label}에 놓았습니다.`);
  }
  return true;
}

function onHexClick(hexId) {
  if (!state || state.gameOver || !getPlayer().isHuman || state.phase !== "robberMove") return;
  const target = moveRobberMarker(hexId);
  if (!target) {
    flashStatus("도둑은 현재 있는 타일이 아닌 다른 타일로 옮겨야 합니다.");
    return;
  }
  const victims = getRobberVictims(target, state.currentPlayer);
  if (victims.length > 1) {
    openRobberVictimModal(state.currentPlayer, target.id, victims);
    return;
  }
  if (victims.length === 1) {
    stealFromRobberVictim(state.currentPlayer, victims[0], target);
  } else {
    log(`${getPlayer(state.currentPlayer).name}이 도둑을 ${TERRAIN[target.terrain].label}에 놓았습니다.`);
  }
  finishHumanRobberMove();
}

function openRobberVictimModal(playerId, hexId, victims) {
  robberVictimContext = { playerId, hexId, victims };
  state.phase = "robberVictim";
  selectedBuild = null;
  const target = getHex(hexId);
  els.robberVictimChoices.innerHTML = victims.map((victimId) => {
    const player = getPlayer(victimId);
    return `
      <button data-robber-victim="${victimId}" style="--player-color:${player.color}">
        <strong>${escapeHtml(player.name)}</strong>
        <span>자원 ${resourceCount(player)}장</span>
      </button>
    `;
  }).join("");
  els.robberVictimChoices.querySelectorAll("[data-robber-victim]").forEach((btn) => {
    btn.addEventListener("click", () => chooseRobberVictim(Number(btn.dataset.robberVictim)));
  });
  log(`${getPlayer(playerId).name}이 도둑을 ${TERRAIN[target.terrain].label}에 놓았습니다. 강탈 대상을 선택하세요.`);
  els.robberVictimModal.hidden = false;
  render();
}

function chooseRobberVictim(victimId) {
  if (!robberVictimContext || !robberVictimContext.victims.includes(victimId)) return;
  const target = getHex(robberVictimContext.hexId);
  stealFromRobberVictim(robberVictimContext.playerId, victimId, target);
  els.robberVictimModal.hidden = true;
  robberVictimContext = null;
  finishHumanRobberMove();
}

function finishHumanRobberMove() {
  robberContext = null;
  robberVictimContext = null;
  els.robberVictimModal.hidden = true;
  state.phase = "build";
  render();
}

function chooseRobberHex(playerId) {
  const opponents = state.players.filter((p) => p.id !== playerId);
  const leader = opponents.sort((a, b) => victoryPoints(b, true) - victoryPoints(a, true))[0];
  const candidates = state.board.hexes.filter((h) => !h.robber);
  candidates.sort((a, b) => robberHexScore(b, playerId, leader.id) - robberHexScore(a, playerId, leader.id));
  return candidates[0];
}

function robberHexScore(hex, playerId, leaderId) {
  return hex.vertexIds.reduce((sum, vertexId) => {
    const owner = getVertex(vertexId).building?.owner;
    if (owner === undefined) return sum;
    if (owner === playerId) return sum - numberWeight(hex.number) * 2;
    return sum + numberWeight(hex.number) * (owner === leaderId ? 3 : 1);
  }, 0);
}

function stealRandomResource(thiefId, victimId) {
  const victim = getPlayer(victimId);
  const pool = RESOURCES.flatMap((res) => Array(victim.resources[res]).fill(res));
  if (!pool.length) return null;
  const res = pool[Math.floor(Math.random() * pool.length)];
  victim.resources[res] -= 1;
  getPlayer(thiefId).resources[res] += 1;
  return res;
}

function stealFromRobberVictim(thiefId, victimId, target) {
  const stolen = stealRandomResource(thiefId, victimId);
  if (stolen) {
    log(`${getPlayer(thiefId).name}이 도둑을 ${TERRAIN[target.terrain].label}에 놓고 ${getPlayer(victimId).name}에게서 ${RESOURCE_LABEL[stolen]} 1장을 빼앗았습니다.`);
  } else {
    log(`${getPlayer(thiefId).name}이 도둑을 ${TERRAIN[target.terrain].label}에 놓았습니다.`);
  }
  return stolen;
}

function endHumanTurn() {
  if (!state || state.gameOver || !getPlayer().isHuman || state.phase !== "build") return;
  if (freeRoadsToPlace > 0) {
    flashStatus(`무료 도로 ${freeRoadsToPlace}개를 먼저 배치하세요.`);
    return;
  }
  nextTurn();
}

function nextTurn() {
  checkWin();
  if (state.gameOver) return;
  const order = getTurnOrder();
  const index = order.indexOf(state.currentPlayer);
  state.currentPlayer = order[(index + 1) % order.length];
  state.phase = "roll";
  state.dice = null;
  state.turnCounter += 1;
  state.devPlayedThisTurn = false;
  selectedBuild = null;
  freeRoadsToPlace = 0;
  render();
  if (!getPlayer().isHuman) {
    setTimeout(runNpcTurn, getNpcTurnDelay());
  }
}

function runNpcTurn() {
  if (!state || state.gameOver || state.rollAnimation || getPlayer().isHuman) return;
  const player = getPlayer();
  startRegularRoll(player.id, d6() + d6(), () => {
    npcPlayBuildPhase(player.id);
    checkWin();
    render();
    if (!state.gameOver) setTimeout(nextTurn, getNpcTurnDelay());
  });
}

function npcPlayBuildPhase(playerId) {
  const maxActions = getPlayer(playerId).difficulty === "hard" ? 8 : 5;
  for (let i = 0; i < maxActions; i += 1) {
    const action = bestNpcAction(playerId);
    if (!action || action.score < 1) break;
    if (action.type === "city") {
      placeCity(playerId, action.vertexId);
      log(`${getPlayer(playerId).name}이 도시를 건설했습니다.`);
    } else if (action.type === "settlement") {
      placeSettlement(playerId, action.vertexId);
      log(`${getPlayer(playerId).name}이 마을을 건설했습니다.`);
    } else if (action.type === "road") {
      placeRoad(playerId, action.edgeId);
      log(`${getPlayer(playerId).name}이 도로를 건설했습니다.`);
    } else if (action.type === "dev") {
      buyDevelopmentCard(playerId);
      log(`${getPlayer(playerId).name}이 발전 카드를 샀습니다.`);
    }
  }
  npcUseDevCard(playerId);
}

function bestNpcAction(playerId) {
  const player = getPlayer(playerId);
  const noise = player.difficulty === "easy" ? 8 : player.difficulty === "normal" ? 3 : 0.8;
  const actions = [];
  state.board.vertices.forEach((v) => {
    if (canBuildCity(playerId, v.id)) actions.push({ type: "city", vertexId: v.id, score: 13 + productionScore(v.id) });
    if (canBuildSettlement(playerId, v.id)) actions.push({ type: "settlement", vertexId: v.id, score: 18 + productionScore(v.id) * 1.5 });
  });
  state.board.edges.forEach((e) => {
    if (canBuildRoad(playerId, e.id)) actions.push({ type: "road", edgeId: e.id, score: roadExpansionScore(playerId, e.id) });
  });
  if (state.devDeck.length && hasResources(player, COSTS.dev)) {
    actions.push({ type: "dev", score: player.difficulty === "hard" ? 8 : 5 });
  }
  actions.forEach((a) => {
    a.score += Math.random() * noise;
  });
  actions.sort((a, b) => b.score - a.score);
  return actions[0];
}

function productionScore(vertexId) {
  return getVertex(vertexId).hexes.reduce((sum, hexId) => sum + numberWeight(getHex(hexId).number), 0);
}

function roadExpansionScore(playerId, edgeId) {
  const edge = getEdge(edgeId);
  const endpoints = edge.vertices.map(getVertex);
  const openScore = endpoints.reduce((sum, v) => {
    const settlementTarget = canBuildSettlement(playerId, v.id) ? productionScore(v.id) + 7 : 0;
    return sum + settlementTarget + v.edges.filter((id) => !getEdge(id).owner).length;
  }, 0);
  const longestBonus = state.longestRoadOwner === playerId ? 1 : 4;
  return 4 + openScore + longestBonus;
}

function npcUseDevCard(playerId) {
  const player = getPlayer(playerId);
  const knightIndex = player.devCards.findIndex((c) => c.type === "knight" && c.turnBought !== state.turnCounter);
  if (knightIndex >= 0 && (player.difficulty === "hard" || Math.random() > 0.45)) {
    player.devCards.splice(knightIndex, 1);
    player.playedKnights += 1;
    moveRobber(playerId);
    updateLargestArmy();
  }
}

function buyDevelopmentCard(playerId = state.currentPlayer) {
  const player = getPlayer(playerId);
  if (!state.devDeck.length || !hasResources(player, COSTS.dev)) return false;
  if (!spendResources(playerId, COSTS.dev)) return false;
  const type = state.devDeck.pop();
  player.devCards.push({ type, turnBought: state.turnCounter || 0 });
  return true;
}

function humanBuild(type) {
  if (freeRoadsToPlace > 0 && type !== "road") {
    flashStatus(`무료 도로 ${freeRoadsToPlace}개를 먼저 배치하세요.`);
    return;
  }
  selectedBuild = type;
  els.buildHint.textContent =
    type === "road" ? "보드의 선을 클릭해 도로를 놓으세요." :
    type === "settlement" ? "교차점을 클릭해 마을을 놓으세요." :
    type === "city" ? "내 마을을 클릭해 도시로 업그레이드하세요." :
    "발전 카드를 즉시 구매합니다.";
  if (type === "dev") {
    if (buyDevelopmentCard()) log("발전 카드를 샀습니다.");
    else log("발전 카드를 살 수 없습니다.");
    selectedBuild = null;
    checkWin();
    render();
  } else {
    render();
  }
}

function onEdgeClick(edgeId) {
  if (!state || state.gameOver || !getPlayer().isHuman || selectedBuild !== "road") return;
  if (state.phase === "setupRoad") {
    const edge = getEdge(edgeId);
    if (!edge?.vertices.includes(state.setup.pendingSettlement)) {
      flashStatus("방금 놓은 마을에 붙은 도로를 선택하세요.");
      return;
    }
    if (placeRoad(state.currentPlayer, edgeId, true)) {
      log("초기 도로를 배치했습니다.");
      const settlementId = state.setup.pendingSettlement;
      selectedBuild = null;
      finishSetupPlacement(settlementId);
      continueSetupAutomation();
    } else {
      flashStatus("그 위치에는 도로를 놓을 수 없습니다.");
    }
    return;
  }
  if (!["roll", "build"].includes(state.phase)) return;
  const free = freeRoadsToPlace > 0;
  if (placeRoad(state.currentPlayer, edgeId, free)) {
    if (free) {
      freeRoadsToPlace -= 1;
      log("무료 도로를 건설했습니다.");
    } else {
      log("도로를 건설했습니다.");
    }
    selectedBuild = freeRoadsToPlace > 0 ? "road" : null;
    checkWin();
    render();
  } else {
    flashStatus("그 위치에는 도로를 놓을 수 없습니다.");
  }
}

function onVertexClick(vertexId) {
  if (!state || state.gameOver || !getPlayer().isHuman) return;
  if (state.phase === "setupSettlement") {
    if (placeSettlement(state.currentPlayer, vertexId, true)) {
      state.setup.pendingSettlement = vertexId;
      state.phase = "setupRoad";
      selectedBuild = "road";
      log("초기 마을을 배치했습니다. 이어서 붙어 있는 도로를 선택하세요.");
      render();
    } else {
      flashStatus("그 위치에는 초기 마을을 놓을 수 없습니다.");
    }
    return;
  }
  if (state.phase !== "build") return;
  if (selectedBuild === "settlement") {
    if (placeSettlement(state.currentPlayer, vertexId)) {
      log("마을을 건설했습니다.");
      selectedBuild = null;
      checkWin();
      render();
    } else {
      flashStatus("그 위치에는 마을을 놓을 수 없습니다.");
    }
  } else if (selectedBuild === "city") {
    if (placeCity(state.currentPlayer, vertexId)) {
      log("도시를 건설했습니다.");
      selectedBuild = null;
      checkWin();
      render();
    } else {
      flashStatus("그 마을은 도시로 업그레이드할 수 없습니다.");
    }
  }
}

function performBankTrade() {
  if (!state || state.gameOver || !getPlayer().isHuman || state.phase !== "build") return;
  const give = els.giveResource.value;
  const take = els.takeResource.value;
  if (give === take) return;
  const rate = tradeRateFor(state.currentPlayer, give);
  const player = getPlayer();
  if (player.resources[give] < rate || state.bank[take] < 1) {
    flashStatus(`${RESOURCE_LABEL[give]} ${rate}장이 필요합니다.`);
    return;
  }
  player.resources[give] -= rate;
  state.bank[give] += rate;
  state.bank[take] -= 1;
  player.resources[take] += 1;
  log(`${RESOURCE_LABEL[give]} ${rate}장을 ${RESOURCE_LABEL[take]} 1장으로 교환했습니다.`);
  render();
}

function openPlayerTradeModal() {
  if (!state || state.gameOver || state.currentPlayer !== 0 || state.phase !== "build") return;
  const opponentValue = els.tradeOpponentSelect.value || "1";
  els.tradeOpponentSelect.innerHTML = state.players
    .filter((player) => !player.isHuman)
    .map((player) => `<option value="${player.id}">${escapeHtml(player.name)} · 자원 ${resourceCount(player)}장</option>`)
    .join("");
  els.tradeOpponentSelect.value = state.players[Number(opponentValue)]?.isHuman ? "1" : opponentValue;
  fillResourceSelect(els.tradeGiveResource, els.tradeGiveResource.value || richestResource(state.players[0]) || "wood");
  fillResourceSelect(els.tradeTakeResource, els.tradeTakeResource.value || richestResource(getPlayer(Number(els.tradeOpponentSelect.value))) || "brick");
  els.tradeGiveAmount.value = Math.max(1, Number(els.tradeGiveAmount.value || 1));
  els.tradeTakeAmount.value = Math.max(1, Number(els.tradeTakeAmount.value || 1));
  els.playerTradeStatus.textContent = "";
  els.playerTradeModal.hidden = false;
  updatePlayerTradeModal();
}

function closePlayerTradeModal() {
  els.playerTradeModal.hidden = true;
}

function fillResourceSelect(select, value) {
  select.innerHTML = RESOURCES.map((res) => `<option value="${res}">${resourceText(res, "compact")}</option>`).join("");
  select.value = RESOURCES.includes(value) ? value : RESOURCES[0];
}

function richestResource(player) {
  return RESOURCES.slice().sort((a, b) => player.resources[b] - player.resources[a])[0];
}

function readPlayerTradeOffer() {
  return {
    opponentId: Number(els.tradeOpponentSelect.value),
    giveResource: els.tradeGiveResource.value,
    giveAmount: Math.max(1, Number(els.tradeGiveAmount.value || 1)),
    takeResource: els.tradeTakeResource.value,
    takeAmount: Math.max(1, Number(els.tradeTakeAmount.value || 1)),
  };
}

function validatePlayerTradeOffer(offer = readPlayerTradeOffer()) {
  if (!state || state.gameOver || state.currentPlayer !== 0 || state.phase !== "build") return "내 차례의 건설 단계에서만 교환할 수 있습니다.";
  const human = state.players[0];
  const opponent = state.players[offer.opponentId];
  if (!opponent || opponent.isHuman) return "교환할 상대를 선택하세요.";
  if (offer.giveResource === offer.takeResource) return "같은 자원끼리는 교환할 필요가 없습니다.";
  if (human.resources[offer.giveResource] < offer.giveAmount) return `내 ${resourceText(offer.giveResource, "name")}가 부족합니다.`;
  if (opponent.resources[offer.takeResource] < offer.takeAmount) return `${opponent.name}의 ${resourceText(offer.takeResource, "name")}가 부족합니다.`;
  return "";
}

function updatePlayerTradeModal() {
  if (els.playerTradeModal.hidden) return;
  fillResourceSelect(els.tradeGiveResource, els.tradeGiveResource.value || "wood");
  fillResourceSelect(els.tradeTakeResource, els.tradeTakeResource.value || "brick");
  const offer = readPlayerTradeOffer();
  const human = state.players[0];
  const opponent = state.players[offer.opponentId];
  els.tradeGiveAmount.max = Math.max(1, human.resources[offer.giveResource] || 0);
  els.tradeTakeAmount.max = Math.max(1, opponent?.resources[offer.takeResource] || 0);
  const error = validatePlayerTradeOffer(offer);
  els.submitPlayerTradeBtn.disabled = Boolean(error);
  els.playerTradeStatus.textContent = error || `${opponent.name}에게 제안할 수 있습니다.`;
}

function submitPlayerTradeOffer() {
  const offer = readPlayerTradeOffer();
  const error = validatePlayerTradeOffer(offer);
  if (error) {
    els.playerTradeStatus.textContent = error;
    return;
  }
  const opponent = getPlayer(offer.opponentId);
  els.submitPlayerTradeBtn.disabled = true;
  els.playerTradeStatus.textContent = `${opponent.name}가 제안을 검토하고 있습니다...`;
  setTimeout(() => {
    if (!state || state.gameOver || state.currentPlayer !== 0 || state.phase !== "build") return;
    const currentError = validatePlayerTradeOffer(offer);
    if (currentError) {
      els.playerTradeStatus.textContent = currentError;
      els.submitPlayerTradeBtn.disabled = true;
      return;
    }
    if (evaluateNpcTrade(0, offer.opponentId, offer)) {
      applyPlayerTrade(0, offer.opponentId, offer);
      els.playerTradeStatus.textContent = `${opponent.name}가 교환을 수락했습니다.`;
      closePlayerTradeModal();
      render();
    } else {
      els.playerTradeStatus.textContent = `${opponent.name}가 교환을 거절했습니다.`;
      els.submitPlayerTradeBtn.disabled = false;
    }
  }, Math.max(700, Math.min(1800, getNpcTurnDelay())));
}

function evaluateNpcTrade(humanId, npcId, offer) {
  const npc = getPlayer(npcId);
  const human = getPlayer(humanId);
  const gainValue = resourceNeedScore(npcId, offer.giveResource) * offer.giveAmount;
  const lossValue = resourceNeedScore(npcId, offer.takeResource) * offer.takeAmount;
  const cardBalance = offer.giveAmount - offer.takeAmount;
  let score = gainValue - lossValue + cardBalance * 0.55;
  if (victoryPoints(human, true) >= (state.targetScore || 10) - 2) score -= npc.difficulty === "hard" ? 2.4 : 1.2;
  const threshold = { easy: -1.25, normal: 0.15, hard: 1.05 }[npc.difficulty] ?? 0.15;
  return score >= threshold;
}

function resourceNeedScore(playerId, res) {
  const player = getPlayer(playerId);
  let score = 1;
  if (player.resources[res] === 0) score += 0.9;
  if (player.settlements > 0 && COSTS.city[res]) score += 1.6;
  if (COSTS.settlement[res]) score += 1.2;
  if (COSTS.road[res] && state.board.edges.some((edge) => canBuildRoad(playerId, edge.id, true))) score += 0.9;
  if (state.devDeck.length && COSTS.dev[res]) score += 0.8;
  const nearCosts = [COSTS.city, COSTS.settlement, COSTS.road, COSTS.dev];
  nearCosts.forEach((cost) => {
    if (!cost[res]) return;
    const missing = Object.entries(cost).reduce((sum, [r, amount]) => sum + Math.max(0, amount - player.resources[r]), 0);
    if (missing <= cost[res] + 1) score += 1.1;
  });
  return score;
}

function applyPlayerTrade(humanId, npcId, offer) {
  const human = getPlayer(humanId);
  const npc = getPlayer(npcId);
  human.resources[offer.giveResource] -= offer.giveAmount;
  npc.resources[offer.giveResource] += offer.giveAmount;
  npc.resources[offer.takeResource] -= offer.takeAmount;
  human.resources[offer.takeResource] += offer.takeAmount;
  log(`${npc.name}가 교환을 수락했습니다: ${resourceText(offer.giveResource, "name")} ${offer.giveAmount}장을 주고 ${resourceText(offer.takeResource, "name")} ${offer.takeAmount}장을 받았습니다.`);
}

function tradeRateFor(playerId, resource) {
  let rate = 4;
  state.board.ports.forEach((port) => {
    const owned = port.vertices.some((vertexId) => getVertex(vertexId).building?.owner === playerId);
    if (!owned) return;
    if (port.type === "generic") rate = Math.min(rate, 3);
    if (port.type === resource) rate = Math.min(rate, 2);
  });
  return rate;
}

function updateLongestRoad() {
  const previousOwner = state.longestRoadOwner;
  state.players.forEach((player) => {
    player.longestRoad = calculateLongestRoad(player.id);
  });
  const contenders = state.players.filter((p) => p.longestRoad >= 5).sort((a, b) => b.longestRoad - a.longestRoad);
  if (!contenders.length) {
    state.longestRoadOwner = null;
    if (previousOwner !== null) log("최장 교역로 보유자가 없어졌습니다.");
    return;
  }
  if (contenders.length > 1 && contenders[0].longestRoad === contenders[1].longestRoad) {
    if (state.longestRoadOwner !== null && getPlayer(state.longestRoadOwner).longestRoad === contenders[0].longestRoad) return;
    state.longestRoadOwner = null;
    if (previousOwner !== null) log("최장 교역로가 동률이 되어 보유자가 없어졌습니다.");
    return;
  }
  state.longestRoadOwner = contenders[0].id;
  if (previousOwner !== state.longestRoadOwner) {
    log(`${getPlayer(state.longestRoadOwner).name}이 최장 교역로를 차지했습니다.`);
  }
}

function calculateLongestRoad(playerId) {
  const playerEdges = state.board.edges.filter((e) => e.owner === playerId);
  let best = 0;
  const dfs = (vertexId, usedEdges) => {
    best = Math.max(best, usedEdges.size);
    const vertex = getVertex(vertexId);
    if (usedEdges.size > 0 && vertex.building && vertex.building.owner !== playerId) return;
    vertex.edges.forEach((edgeId) => {
      const edge = getEdge(edgeId);
      if (edge.owner !== playerId || usedEdges.has(edgeId)) return;
      const next = edge.vertices.find((id) => id !== vertexId);
      usedEdges.add(edgeId);
      dfs(next, usedEdges);
      usedEdges.delete(edgeId);
    });
  };
  playerEdges.forEach((edge) => edge.vertices.forEach((vertexId) => dfs(vertexId, new Set())));
  return best;
}

function updateLargestArmy() {
  const previousOwner = state.largestArmyOwner;
  const contenders = state.players.filter((p) => p.playedKnights >= 3).sort((a, b) => b.playedKnights - a.playedKnights);
  if (!contenders.length) {
    state.largestArmyOwner = null;
    return;
  }
  if (contenders.length > 1 && contenders[0].playedKnights === contenders[1].playedKnights) return;
  state.largestArmyOwner = contenders[0].id;
  if (previousOwner !== state.largestArmyOwner) {
    log(`${getPlayer(state.largestArmyOwner).name}이 최대 기사력을 차지했습니다.`);
  }
}

function victoryPoints(player, includeHidden = false) {
  let points = player.settlements + player.cities * 2;
  if (state.longestRoadOwner === player.id) points += 2;
  if (state.largestArmyOwner === player.id) points += 2;
  if (includeHidden || player.isHuman) points += player.devCards.filter((c) => c.type === "victory").length;
  return points;
}

function checkWin() {
  const player = getPlayer();
  if (victoryPoints(player, true) >= (state.targetScore || 10)) {
    state.gameOver = true;
    state.phase = "gameOver";
    log(`${player.name} 승리!`);
  }
}

function resourceCount(player) {
  return RESOURCES.reduce((sum, res) => sum + player.resources[res], 0);
}

function remainingResourceCards(res) {
  if (!state) return RESOURCE_BANK_SIZE;
  const held = state.players.reduce((sum, player) => sum + player.resources[res], 0);
  return Math.max(0, RESOURCE_BANK_SIZE - held);
}

function log(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 80);
}

function flashStatus(message) {
  els.statusText.textContent = message;
}

function render() {
  renderCosts();
  renderBoard();
  renderPanels();
}

function renderBoard() {
  if (!state) return;
  els.board.innerHTML = "";
  const hexLayer = svg("g");
  const portLayer = svg("g");
  const edgeLayer = svg("g");
  const roadLayer = svg("g");
  const vertexLayer = svg("g");
  const robberLayer = svg("g");

  state.board.hexes.forEach((hex) => {
    const rollHit = state.setupDone && state.dice && hex.number === state.dice;
    const hexClasses = [
      "hex",
      state.phase === "robberMove" && !hex.robber ? "hex-target" : "",
      rollHit && !hex.robber ? "hex-roll-hit" : "",
      rollHit && hex.robber ? "hex-roll-blocked" : "",
    ].filter(Boolean).join(" ");
    const poly = svg("polygon", {
      points: hex.points.map((p) => `${p.x},${p.y}`).join(" "),
      fill: TERRAIN[hex.terrain].color,
      class: hexClasses,
    });
    poly.addEventListener("click", () => onHexClick(hex.id));
    hexLayer.append(poly);
    hexLayer.append(svg("text", { x: hex.center.x, y: hex.center.y - 22, class: "hex-label" }, terrainDisplayLabel(hex.terrain)));
    if (hex.number) {
      hexLayer.append(svg("circle", { cx: hex.center.x, cy: hex.center.y + 8, r: 18, class: "number-token" }));
      hexLayer.append(svg("text", {
        x: hex.center.x,
        y: hex.center.y + 9,
        class: `hex-label ${hex.number === 6 || hex.number === 8 ? "token-red" : ""}`,
      }, String(hex.number)));
    }
    if (hex.robber) robberLayer.append(svg("circle", { cx: hex.center.x + 28, cy: hex.center.y - 4, r: 13, class: "robber" }));
  });

  state.board.ports.forEach((port) => {
    renderPort(portLayer, port);
  });

  state.board.edges.forEach((edge) => {
    const [a, b] = edge.vertices.map(getVertex);
    const clickable = svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge" });
    clickable.addEventListener("click", () => onEdgeClick(edge.id));
    edgeLayer.append(clickable);
    if (edge.owner !== null) {
      roadLayer.append(svg("line", {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "road",
        stroke: getPlayer(edge.owner).color,
      }));
    }
  });

  state.board.vertices.forEach((vertex) => {
    const circle = svg("circle", { cx: vertex.x, cy: vertex.y, r: 11, class: "vertex" });
    circle.addEventListener("click", () => onVertexClick(vertex.id));
    vertexLayer.append(circle);
    if (vertex.building) {
      const owner = getPlayer(vertex.building.owner);
      const buildingHighlight = getBuildingRollHighlight(vertex);
      const upgradeHighlight = selectedBuild === "city" && canBuildCity(state.currentPlayer, vertex.id) ? "building-upgrade-target" : "";
      const buildingClass = ["settlement", buildingHighlight, upgradeHighlight].filter(Boolean).join(" ");
      if (vertex.building.type === "settlement") {
        vertexLayer.append(svg("rect", {
          x: vertex.x - 11,
          y: vertex.y - 11,
          width: 22,
          height: 22,
          rx: 3,
          fill: owner.color,
          class: buildingClass,
        }));
      } else {
        vertexLayer.append(svg("rect", {
          x: vertex.x - 14,
          y: vertex.y - 11,
          width: 28,
          height: 22,
          rx: 3,
          fill: owner.color,
          class: buildingClass,
        }));
        vertexLayer.append(svg("rect", {
          x: vertex.x + 1,
          y: vertex.y - 22,
          width: 14,
          height: 14,
          rx: 2,
          fill: owner.color,
          class: ["city-roof", buildingHighlight].filter(Boolean).join(" "),
        }));
      }
    }
  });

  els.board.append(portLayer, hexLayer, edgeLayer, roadLayer, vertexLayer, robberLayer);
}

function renderPort(layer, port) {
  const vertices = port.vertices.map(getVertex);
  vertices.forEach((vertex) => {
    layer.append(svg("line", {
      x1: port.x,
      y1: port.y,
      x2: vertex.x,
      y2: vertex.y,
      class: "port-line",
    }));
  });
  layer.append(svg("circle", {
    cx: port.x,
    cy: port.y,
    r: port.type === "generic" ? 23 : 27,
    class: "port-token",
  }));
  layer.append(svg("text", {
    x: port.x,
    y: port.y - (port.type === "generic" ? 1 : 6),
    class: "port-label",
  }, port.type === "generic" ? "3:1" : "2:1"));
  if (port.type !== "generic") {
    layer.append(svg("text", {
      x: port.x,
      y: port.y + 10,
      class: "port-resource",
    }, useEmoji() ? RESOURCE_EMOJI[port.type] : RESOURCE_LABEL[port.type]));
  }
}

function terrainDisplayLabel(terrain) {
  const info = TERRAIN[terrain];
  return info.resource && useEmoji() ? `${info.label}(${RESOURCE_EMOJI[info.resource]})` : info.label;
}

function getBuildingRollHighlight(vertex) {
  if (!state?.setupDone || !state.dice || !vertex.building) return "";
  const matchingHexes = vertex.hexes.map(getHex).filter((hex) => hex.number === state.dice);
  if (!matchingHexes.length) return "";
  return matchingHexes.every((hex) => hex.robber) ? "building-roll-blocked" : "building-roll-hit";
}

function renderPanels() {
  const player = state ? getPlayer() : null;
  const available = getHumanAvailableActions();
  const selectedTradeAvailable = isSelectedBankTradeAvailable();
  const rolling = Boolean(state?.rollAnimation);
  els.turnPlayer.textContent = player ? player.name : "대기 중";
  els.turnPhase.textContent = state?.gameOver ? "종료" : phaseLabel();
  els.diceDisplay.textContent = rolling ? "..." : (state?.setupDone ? (state?.dice || "--") : (state?.phase === "setupOrderRoll" ? `선 ${state?.dice || "--"}` : "배치"));
  els.diceDisplay.classList.toggle("rolling", rolling);
  const canHumanRoll = Boolean(state && !state.gameOver && !rolling && player?.isHuman && (state.phase === "roll" || state.phase === "setupOrderRoll"));
  els.rollBtn.disabled = !canHumanRoll;
  els.rollBtn.classList.toggle("available", canHumanRoll);
  els.endTurnBtn.disabled = !state || state.gameOver || !player?.isHuman || state.phase !== "build";
  document.querySelectorAll("[data-build]").forEach((btn) => {
    btn.disabled = !state || state.gameOver || !player?.isHuman || state.phase !== "build";
    btn.classList.toggle("primary", selectedBuild === btn.dataset.build);
    btn.classList.toggle("available", Boolean(available[btn.dataset.build]) && selectedBuild !== btn.dataset.build);
  });
  els.bankTradeBtn.disabled = !state || state.gameOver || !player?.isHuman || state.phase !== "build";
  els.bankTradeBtn.classList.toggle("available", selectedTradeAvailable);
  els.playerTradeBtn.disabled = !state || state.gameOver || !player?.isHuman || state.phase !== "build";
  els.playerTradeBtn.classList.toggle("available", Boolean(available.playerTrade));
  els.statusText.textContent = statusText();
  els.buildHint.textContent = selectedBuild ? els.buildHint.textContent : "건설 종류를 고른 뒤 보드에서 위치를 클릭하세요.";
  if (state && !state.setupDone) {
    if (state.phase === "setupOrderRoll") {
      els.buildHint.textContent = "각 참가자가 선 결정 주사위를 굴린 뒤 초기 배치를 시작합니다.";
    } else {
      els.buildHint.textContent = state.phase === "setupSettlement"
        ? "초기 마을을 놓을 교차점을 클릭하세요."
        : "방금 놓은 마을에 붙은 선을 클릭해 초기 도로를 놓으세요.";
    }
  }
  if (freeRoadsToPlace > 0) {
    els.buildHint.textContent = `도로 건설 카드: 무료 도로 ${freeRoadsToPlace}개를 배치하세요.`;
  }
  if (state?.phase === "robberMove") {
    els.buildHint.textContent = "도둑을 옮길 타일을 클릭하세요.";
  }
  if (state?.phase === "robberVictim") {
    els.buildHint.textContent = "도둑에게 강탈당할 상대를 선택하세요.";
  }
  renderTurnTracker();
  renderScoreboard();
  renderResources();
  renderTrades();
  renderDevCards();
  renderAwardCards();
  els.log.innerHTML = state.log.map((entry) => `<div class="log-entry">${escapeHtml(entry)}</div>`).join("");
}

function getHumanAvailableActions() {
  if (!state || state.gameOver || state.currentPlayer !== 0 || state.phase !== "build") {
    return { road: false, settlement: false, city: false, dev: false, bankTrade: false, playerTrade: false };
  }
  const playerId = 0;
  const player = state.players[0];
  const hasTradePartner = state.players.some((p) => !p.isHuman && RESOURCES.some((res) => p.resources[res] > 0));
  return {
    road: hasResources(player, COSTS.road) && state.board.edges.some((edge) => canBuildRoad(playerId, edge.id)),
    settlement: hasResources(player, COSTS.settlement) && state.board.vertices.some((vertex) => canBuildSettlement(playerId, vertex.id)),
    city: hasResources(player, COSTS.city) && state.board.vertices.some((vertex) => canBuildCity(playerId, vertex.id)),
    dev: state.devDeck.length > 0 && hasResources(player, COSTS.dev),
    bankTrade: RESOURCES.some((res) => player.resources[res] >= tradeRateFor(playerId, res)) && RESOURCES.some((res) => state.bank[res] > 0),
    playerTrade: RESOURCES.some((res) => player.resources[res] > 0) && hasTradePartner,
  };
}

function isSelectedBankTradeAvailable() {
  if (!state || state.gameOver || state.currentPlayer !== 0 || state.phase !== "build") return false;
  const give = els.giveResource.value || "wood";
  const take = els.takeResource.value || "brick";
  if (give === take) return false;
  return state.players[0].resources[give] >= tradeRateFor(0, give) && state.bank[take] > 0;
}

function renderTurnTracker() {
  if (!state) {
    els.turnTrack.innerHTML = "";
    els.playerDiceGrid.innerHTML = "";
    return;
  }
  const order = getTurnOrder();
  els.turnTrack.innerHTML = order.map((playerId, index) => {
    const player = getPlayer(playerId);
    const active = playerId === state.currentPlayer ? " active" : "";
    return `
      <div class="turn-node${active}" style="--player-color:${player.color}">
        <span>${index + 1}</span>
      </div>
    `;
  }).join("");

  els.playerDiceGrid.innerHTML = order.map((playerId) => {
    const player = getPlayer(playerId);
    const active = playerId === state.currentPlayer ? " active" : "";
    const rolling = state.rollAnimation?.playerId === playerId;
    const roll = rolling ? "..." : (state.setupDone ? (player.lastRoll || "--") : (state.setup?.rolls[playerId] || "--"));
    return `
      <div class="player-dice${active}${rolling ? " rolling" : ""}" style="--player-color:${player.color}">
        <span>${escapeHtml(player.name)}</span>
        <strong>${roll}</strong>
      </div>
    `;
  }).join("");
}

function getTurnOrder() {
  if (state?.phase === "setupOrderRoll") return state.players.map((player) => player.id);
  if (state?.setup?.order?.length) return state.setup.order;
  return state?.players?.map((player) => player.id) || [];
}

function phaseLabel() {
  if (!state) return "설정";
  if (state.phase === "setupOrderRoll") return "선 결정";
  if (state.phase === "setupSettlement") return "초기 마을";
  if (state.phase === "setupRoad") return "초기 도로";
  if (state.phase === "discard") return "자원 버림";
  if (state.phase === "robberMove") return "도둑 이동";
  if (state.phase === "robberVictim") return "강탈 선택";
  if (state.phase === "roll") return "주사위";
  if (state.phase === "build") return "건설";
  return "설정";
}

function statusText() {
  if (!state) return "게임을 시작하면 보드가 생성됩니다.";
  if (state.gameOver) return `${getPlayer().name} 승리로 게임이 끝났습니다.`;
  if (state.phase === "setupOrderRoll") {
    if (getPlayer().isHuman) return "선 결정 주사위를 직접 굴리세요.";
    return `${getPlayer().name}이 선 결정 주사위를 굴리고 있습니다.`;
  }
  if (state.phase === "discard") {
    return "자원 카드가 8장 이상이라 절반을 골라 버려야 합니다.";
  }
  if (!state.setupDone) {
    const step = state.setup.step + 1;
    const total = state.setup.placementQueue.length;
    if (getPlayer().isHuman) {
      return state.phase === "setupSettlement"
        ? `초기 배치 ${step}/${total}: 마을 하나를 직접 선택하세요.`
        : `초기 배치 ${step}/${total}: 그 마을에 붙은 도로 하나를 선택하세요.`;
    }
    return `초기 배치 ${step}/${total}: ${getPlayer().name}이 마을과 도로를 배치하고 있습니다.`;
  }
  if (state.phase === "robberMove") {
    return "도둑을 현재 위치가 아닌 다른 타일로 옮기세요. 인접한 상대가 자원을 갖고 있으면 무작위로 1장을 빼앗습니다.";
  }
  if (state.phase === "robberVictim") {
    return "도둑이 놓인 타일에 인접한 상대 중 강탈할 참가자를 선택하세요.";
  }
  if (getPlayer().isHuman) {
    return state.phase === "roll" ? "주사위를 굴려 생산을 시작하세요." : "건설, 교환, 발전 카드 구매를 하고 턴을 종료하세요.";
  }
  return `${getPlayer().name}이 행동을 선택하고 있습니다.`;
}

function renderScoreboard() {
  els.scoreboard.innerHTML = state.players.map((p) => {
    const visibleVp = victoryPoints(p, p.isHuman);
    const cards = p.devCards.length;
    const active = p.id === state.currentPlayer ? " active" : "";
    const production = state.lastProduction?.gains?.[p.id];
    const gainText = production ? formatResourceGain(production) : "";
    const badges = [
      state.longestRoadOwner === p.id ? "최장로" : "",
      state.largestArmyOwner === p.id ? "최대기사" : "",
    ].filter(Boolean);
    return `
      <div class="player-card${active}" style="color:${p.color}">
        <div class="player-name"><span>${escapeHtml(p.name)}</span><strong>${visibleVp}점</strong></div>
        <div class="player-meta">자원 ${resourceCount(p)}장 · 발전 ${cards}장<br>도로 ${p.longestRoad} · 기사 ${p.playedKnights}</div>
        ${badges.length ? `<div class="award-badges">${badges.map((badge) => `<span>${badge}</span>`).join("")}</div>` : ""}
        ${gainText ? `<div class="gain-badge">+ ${escapeHtml(gainText)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderAwardCards() {
  const longest = state.longestRoadOwner !== null ? getPlayer(state.longestRoadOwner) : null;
  const army = state.largestArmyOwner !== null ? getPlayer(state.largestArmyOwner) : null;
  els.awardCards.innerHTML = `
    ${renderAwardCard("최장 교역로", longest, longest ? `${longest.longestRoad}개` : "5개 이상", "도로 5개 이상 단독 최장")}
    ${renderAwardCard("최대 기사력", army, army ? `${army.playedKnights}장` : "3장 이상", "기사 3장 이상 단독 최다")}
  `;
}

function renderCosts() {
  const costText = (cost) => Object.entries(cost)
    .map(([res, amount]) => `${resourceText(res, useEmoji() ? "emoji" : "name")}${amount > 1 ? ` ${amount}` : ""}`)
    .join(" + ");
  els.costList.innerHTML = `
    <li>도로: ${costText(COSTS.road)}</li>
    <li>마을: ${costText(COSTS.settlement)}</li>
    <li>도시: ${costText(COSTS.city)}</li>
    <li>발전: ${costText(COSTS.dev)}</li>
  `;
}

function renderAwardCard(title, owner, value, note) {
  return `
    <div class="award-card ${owner ? "owned" : ""}" ${owner ? `style="--player-color:${owner.color}"` : ""}>
      <div>
        <strong>${title}</strong>
        <span>${note}</span>
      </div>
      <div class="award-owner">
        <b>${owner ? escapeHtml(owner.name) : "미보유"}</b>
        <em>${value}</em>
      </div>
    </div>
  `;
}

function formatResourceGain(resources) {
  if (!resources) return "";
  return RESOURCES
    .filter((res) => resources[res] > 0)
    .map((res) => `${resourceText(res, useEmoji() ? "emoji" : "name")} ${resources[res]}`)
    .join(", ");
}

function renderResources() {
  const player = state.players[0];
  els.resourceBar.innerHTML = RESOURCES.map((res) => `
    <div class="resource-pill ${useEmoji() ? "emoji-mode" : "name-mode"}" title="${RESOURCE_LABEL[res]}"><span>${resourceText(res, useEmoji() ? "emoji" : "name")}</span>${player.resources[res]}</div>
  `).join("");
  els.bankResourceBar.innerHTML = RESOURCES.map((res) => `
    <div class="bank-resource-item ${remainingResourceCards(res) === 0 ? "empty" : ""}" title="${RESOURCE_LABEL[res]} 분배 가능 ${remainingResourceCards(res)}장">
      <span>${resourceText(res, useEmoji() ? "emoji" : "name")}</span>
      <strong>${remainingResourceCards(res)}</strong>
    </div>
  `).join("");
}

function renderTrades() {
  const giveValue = els.giveResource.value || "wood";
  const takeValue = els.takeResource.value || "brick";
  const options = RESOURCES.map((res) => `<option value="${res}">${resourceText(res, "compact")}</option>`).join("");
  els.giveResource.innerHTML = options;
  els.takeResource.innerHTML = options;
  els.giveResource.value = giveValue;
  els.takeResource.value = takeValue;
  const give = els.giveResource.value || "wood";
  els.tradeRate.textContent = `현재 ${resourceText(give, useEmoji() ? "emoji" : "name")} ${tradeRateFor(0, give)}:1`;
  if (!els.playerTradeModal.hidden) updatePlayerTradeModal();
}

function renderDevCards() {
  const human = state.players[0];
  const counts = {};
  human.devCards.forEach((card) => {
    counts[card.type] = (counts[card.type] || 0) + 1;
  });
  const playable = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
  els.devCards.innerHTML = Object.entries(counts).map(([type, count]) => {
    const hasPlayableCopy = human.devCards.some((c) => c.type === type && c.turnBought !== state.turnCounter);
    const canPlayInPhase = state.phase === "roll" || state.phase === "build";
    const disabled = !playable.includes(type) || !hasPlayableCopy || state.devPlayedThisTurn || state.currentPlayer !== 0 || !canPlayInPhase || freeRoadsToPlace > 0;
    return `
      <div class="dev-card-row">
        <span>${DEV_LABEL[type]} x ${count}</span>
        <button data-dev="${type}" ${disabled ? "disabled" : ""}>사용</button>
      </div>
    `;
  }).join("") || "<div class=\"dev-card-row\"><span>보유 카드 없음</span></div>";
  els.devCards.querySelectorAll("[data-dev]").forEach((btn) => btn.addEventListener("click", () => playHumanDev(btn.dataset.dev)));
}

function playHumanDev(type) {
  const player = getPlayer(0);
  if (state.devPlayedThisTurn) return;
  const index = player.devCards.findIndex((c) => c.type === type && c.turnBought !== state.turnCounter);
  if (index < 0) return;
  player.devCards.splice(index, 1);
  state.devPlayedThisTurn = true;
  if (type === "knight") {
    player.playedKnights += 1;
    updateLargestArmy();
    startHumanRobberMove("knight");
  } else if (type === "roadBuilding") {
    freeRoadsToPlace = 2;
    selectedBuild = "road";
    log("도로 건설 카드로 무료 도로 2개를 배치합니다.");
  } else if (type === "yearOfPlenty") {
    gainResource(0, "wheat", 1);
    gainResource(0, "ore", 1);
    log("풍년 카드로 밀과 광석을 얻었습니다.");
  } else if (type === "monopoly") {
    openMonopolyModal(0);
    render();
    return;
  }
  checkWin();
  render();
}

function svg(name, attrs = {}, text = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([attr, value]) => node.setAttribute(attr, value));
  if (text) node.textContent = text;
  return node;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

els.playBtn.addEventListener("click", openNewGameModal);
els.closeNewGameBtn.addEventListener("click", closeNewGameModal);
els.newGameModal.addEventListener("click", (event) => {
  if (event.target === els.newGameModal) closeNewGameModal();
});
els.newGameBtn.addEventListener("click", newGame);
els.optionsBtn.addEventListener("click", openOptionsModal);
els.closeOptionsBtn.addEventListener("click", closeOptionsModal);
els.optionsModal.addEventListener("click", (event) => {
  if (event.target === els.optionsModal) closeOptionsModal();
});
els.devHelpBtn.addEventListener("click", openDevHelpModal);
els.closeDevHelpBtn.addEventListener("click", closeDevHelpModal);
els.devHelpModal.addEventListener("click", (event) => {
  if (event.target === els.devHelpModal) closeDevHelpModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.newGameModal.hidden) closeNewGameModal();
  if (event.key === "Escape" && !els.optionsModal.hidden) closeOptionsModal();
  if (event.key === "Escape" && !els.devHelpModal.hidden) closeDevHelpModal();
  if (event.key === "Escape" && !els.playerTradeModal.hidden) closePlayerTradeModal();
});
els.confirmDiscardBtn.addEventListener("click", confirmDiscard);
els.playerColorInputs.forEach((input) => {
  input.addEventListener("input", applyPlayerColorSettings);
});
els.npcTurnDelay.addEventListener("input", updateNpcDelayLabel);
els.emojiToggle.addEventListener("change", () => {
  if (state) render();
  else renderCosts();
});
els.rollBtn.addEventListener("click", rollDice);
els.endTurnBtn.addEventListener("click", endHumanTurn);
els.bankTradeBtn.addEventListener("click", performBankTrade);
els.giveResource.addEventListener("change", renderTrades);
els.takeResource.addEventListener("change", renderTrades);
els.playerTradeBtn.addEventListener("click", openPlayerTradeModal);
els.closePlayerTradeBtn.addEventListener("click", closePlayerTradeModal);
els.playerTradeModal.addEventListener("click", (event) => {
  if (event.target === els.playerTradeModal) closePlayerTradeModal();
});
[els.tradeOpponentSelect, els.tradeGiveResource, els.tradeGiveAmount, els.tradeTakeResource, els.tradeTakeAmount]
  .forEach((input) => input.addEventListener("input", updatePlayerTradeModal));
[els.tradeOpponentSelect, els.tradeGiveResource, els.tradeTakeResource]
  .forEach((input) => input.addEventListener("change", updatePlayerTradeModal));
els.submitPlayerTradeBtn.addEventListener("click", submitPlayerTradeOffer);
document.querySelectorAll("[data-build]").forEach((btn) => {
  btn.addEventListener("click", () => humanBuild(btn.dataset.build));
});

updateNpcDelayLabel();
renderCosts();
