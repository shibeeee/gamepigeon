/* Runs engine searches off the main thread so the page never freezes. */
importScripts(
  '../engines/common.js',
  '../engines/c4solver.js',
  '../../data/c4book.js',
  '../engines/connect4.js',
  '../engines/othello.js',
  '../engines/gomoku.js',
  '../engines/tictactoe.js',
  '../engines/mancala.js',
  '../engines/checkers.js',
  '../engines/dots.js',
  '../engines/filler.js'
);

self.onmessage = function (e) {
  const { id, engine, state, opts } = e.data;
  try {
    const res = self.GP.engines[engine].search(state, opts);
    self.postMessage({ id, res });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
