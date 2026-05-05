importScripts("engine.js");

function actionKey(result) {
  return `${result.type}:${result.index ?? ""}:${result.label}`;
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
