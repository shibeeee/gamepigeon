# Pigeon Pal

**Play it: https://shibeeee.github.io/pidgeon-pal/**

A friendly coach for GamePigeon games. Type in what you see on your phone and
Pigeon Pal shows you the best move, finds every word, or tells you where the
enemy ships are hiding. You can also practice against a strong computer
opponent.

It runs in any web browser (phone, tablet or computer), needs nothing
installed, works offline once loaded, and saves everything automatically.

## Games

| Game | What the bot does |
| --- | --- |
| **Word Hunt** | Finds every word on 4×4, 5×5, Donut and Cross boards and draws the swipe path. Read the board from a screenshot, step through words one at a time, or follow a "smooth route" that keeps your finger moving. |
| **Anagrams** | Every word from your 6 or 7 letters, with the tiles to use highlighted. Screenshot reading too. |
| **Word Bites** | Every word you can build from single, across and down pieces, with a diagram of how to arrange them. |
| **Sea Battle** | Simulates thousands of possible enemy fleets to show the real chance each cell hides a ship, and the best next shot. |
| **Chess** | Stockfish 18, one of the strongest chess engines in the world, running on your device. |
| **Checkers** | Deep search with forced (or optional) jumps and multi-jump paths. |
| **Four in a Row** | An exact solver: once the position is solved, it plays perfectly and labels every column Win, Draw or Lose. An opening book covers the hardest early moves. |
| **Reversi** | Othello AI that plays the endgame perfectly, with legal-move dots and flip previews. |
| **Gomoku** | Finds forced wins by continuous fours and never walks into one. |
| **Mancala Capture / Avalanche** | Deep search that follows extra turns and captures to the end, with a step-by-step move preview. Random boards: type in the pebbles from your game. |
| **Dots and Boxes** | Takes free boxes, avoids handing any over, and searches the endgame exactly. |
| **Filler** | Looks about 20 turns ahead; read the board from a screenshot. |
| **Tic Tac Toe** | Perfect play, with every square labeled Win, Draw or Lose. |

## Features

- **Bot mode for real matches.** Choose *A friend*, tap the move your friend
  made (the app suggests their likely moves, so it's usually one tap) and the
  bot shows your best reply. Turn on **Bot moves for me** and it plays your
  side on its own; you just copy its move into GamePigeon.
- **Coach bar** under every board: the best move, why it's good ("blocks
  their win", "takes a corner, flips 5 discs", "lands in the store for
  another turn") and a **Play it** button.
- **Game review.** After a game, *Review game* marks blunders (??), mistakes
  (?) and inaccuracies (?!) and shows the better move.
- **Practice mode** against the computer at four strengths, with your record
  saved.
- **Undo, redo, a clickable move list, and swipe left/right** on phones.
- **Chess pieces drag** (or tap, then tap the square).
- **Board editor** to copy a game that is already in progress (chess also
  takes a FEN).
- **Screenshot reading** for Word Hunt, Anagrams and Filler. Everything runs
  on your device; nothing is uploaded.
- **Word game helpers**: an 80-second round timer, a search box that tells you
  whether any word is valid, one-tap copy of the word list, a single box to
  type all the letters at once, and Undo after clearing a board.
- **Mancala upright view** that matches GamePigeon's phone layout, plus a
  move preview that sows the pebbles step by step.
- **Autosave**, backup and restore, light and dark themes, accent colors, a
  color-blind palette, larger text, high contrast, sound, vibration and a
  few small tips you can close.
- **Installable.** On iPhone: Share, then *Add to Home Screen*. It opens full
  screen and works offline.

### How good are the bots?

- **Perfect:** Tic Tac Toe always; Four in a Row whenever the solver finishes
  (from about the 8th move on, and earlier where the opening book has the
  answer); Reversi in the last ~12 moves; Dots and Boxes and Filler near the
  end of the game.
- **Superhuman:** Chess (Stockfish).
- **Very strong, not proven perfect:** Checkers, Gomoku, Mancala and the rest
  of Reversi, Dots and Boxes and Filler. These games are too big to solve
  completely on a phone, so the bot searches as deep as it can in the time
  you give it (Bot level: Easy to Best).

## Running it

**Online:** https://shibeeee.github.io/pidgeon-pal/

Every push to the default branch runs the tests and republishes the site
(the `Test and publish website` workflow copies the app to the `gh-pages`
branch, which GitHub Pages serves). To publish a release with a downloadable
zip, open the **Actions** tab, pick **Release**, click **Run workflow** and
type a version like `v1.0.1` (or push a tag with that name).

**Connect 4 opening book:** `node tools/c4book.js 7 1200 0` and
`node tools/c4book.js 7 1200 1` build the two halves (they can run at the
same time and be stopped and resumed); `node tools/c4book.js merge` combines
them into `data/c4book.js`.

**On your computer:**

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly also works, but the AI then runs on the main
thread, so the page can pause briefly while it thinks.

**Tests:**

```sh
node tests/run.js
```

## How it's built

Plain HTML, CSS and JavaScript with no build step. Third-party engines are
vendored in `vendor/` (see `THIRD_PARTY.md`).

```
index.html            page shell
css/style.css         all styling (light/dark themes, responsive layout)
data/words.js         ENABLE word list (public domain)
js/engines/           game rules and AI, shared by the page, a Web Worker and the tests
  common.js           negamax search: alpha-beta, iterative deepening, transposition table, time limit
  connect4.js c4solver.js othello.js gomoku.js tictactoe.js mancala.js
  checkers.js dots.js filler.js chess.js (rules via chess.js; AI via Stockfish)
  words.js            Word Hunt / Anagrams / Word Bites solvers
  seabattle.js        ship placement probabilities
js/ai/worker.js       runs searches in the background so the page never freezes
js/core/stockfish.js  talks to the Stockfish worker (UCI)
js/core/imagegrid.js  screenshot reading: grid alignment, colors, letters (Tesseract)
tools/c4book.js       builds the Connect 4 opening book with the exact solver
vendor/               Stockfish, chess.js, Tesseract
js/core/              app shell, shared board game controller, UI helpers, card artwork
js/games/             one file per game screen
tests/run.js          engine and solver tests (Node)
```

Adding a game means writing an engine (rules plus a small adapter for the
search) and a screen that registers itself with `GP.registerGame`.

## Credits and license

Inspired by [Kyle Gerner's Game Pigeon Solvers](https://github.com/k-gerner/Game-Pigeon-Solvers),
a set of command-line tools for the same games. Pigeon Pal is a separate,
from-scratch implementation with a graphical interface; it does not contain
code from that project.

The dictionary is the public-domain ENABLE word list. GamePigeon's own
dictionary is slightly different, so a rare word may occasionally be rejected
in the game.

Chess analysis by [Stockfish](https://stockfishchess.org/) via
[Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0). Chess rules
by [chess.js](https://github.com/jhlywa/chess.js). Screenshot reading by
[Tesseract.js](https://github.com/naptha/tesseract.js). Because Stockfish is
GPL-3.0, Pigeon Pal is released under the GPL-3.0 license (`LICENSE`); see
`THIRD_PARTY.md` for each component.

Not affiliated with or endorsed by GamePigeon.
