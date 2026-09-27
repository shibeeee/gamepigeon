# Pigeon Pal

**Play it: https://shibeeee.github.io/gamepigeon/**

A friendly coach for GamePigeon games. Type in what you see on your phone and
Pigeon Pal shows you the best move, finds every word, or tells you where the
enemy ships are hiding. You can also practice against a strong computer
opponent.

It runs in any web browser (phone, tablet or computer), needs nothing
installed, works offline once loaded, and saves everything automatically.

## Games

| Game | What it does |
| --- | --- |
| **Word Hunt** | Finds every word on 4×4, 5×5, Donut and Cross boards and draws the swipe path. Step through words one at a time and tick them off as you go. |
| **Anagrams** | Every word from your 6 or 7 letters, longest first, with the tiles to use highlighted. |
| **Word Bites** | Every word you can build from single, across and down pieces, with a diagram of how to arrange them. |
| **Sea Battle** | A live heat map of where ships can be, the best next shot, and automatic rules (no touching ships, sunk ship tracking) for 8×8, 9×9 and 10×10 fleets. |
| **Four in a Row** | Connect 4 AI that shows whether each column wins, loses, or how good it is. |
| **Reversi** | Othello AI with legal-move dots, flip previews and a live disc count. |
| **Gomoku** | Five-in-a-row AI on 11 to 19 sized boards. |
| **Mancala Capture / Avalanche** | Search-based AI for both GamePigeon modes, including long avalanche chains. |
| **Tic Tac Toe** | Perfect play, with every square labeled Win, Draw or Lose. |

## Features

- **Two ways to play.** *Real person* mode coaches you through a live
  GamePigeon match: enter your opponent's moves and follow the highlighted
  suggestion. *Computer* mode lets you practice against the AI at four
  strengths, and keeps your win/loss record.
- **Undo, redo and a clickable move list** in every board game.
- **Board editor** to copy a game that is already in progress.
- **Autosave.** Close the tab mid-game and pick up exactly where you left off.
  Back up and restore everything from Settings.
- **Light and dark themes**, accent colors, a color-blind palette, sound
  effects, vibration and animations (all can be turned off).
- **Keyboard shortcuts**: `H` hint, `A` AI move, `E` edit, `←`/`→` undo/redo,
  number keys for columns or pits, `?` for help.
- **Installable.** On iPhone: Share → *Add to Home Screen*. It opens full
  screen like a real app and works without internet.

## Running it

**Online:** https://shibeeee.github.io/gamepigeon/

Every push to the default branch runs the tests and republishes the site
(the `Test and publish website` workflow copies the app to the `gh-pages`
branch, which GitHub Pages serves). To publish a release with a downloadable
zip, open the **Actions** tab, pick **Release**, click **Run workflow** and
type a version like `v1.0.1` (or push a tag with that name).

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

Plain HTML, CSS and JavaScript with no build step and no dependencies.

```
index.html            page shell
css/style.css         all styling (light/dark themes, responsive layout)
data/words.js         ENABLE word list (public domain)
js/engines/           game rules and AI, shared by the page, a Web Worker and the tests
  common.js           negamax search: alpha-beta, iterative deepening, transposition table, time limit
  connect4.js othello.js gomoku.js tictactoe.js mancala.js
  words.js            Word Hunt / Anagrams / Word Bites solvers
  seabattle.js        ship placement probabilities
js/ai/worker.js       runs searches in the background so the page never freezes
js/core/              app shell, shared board game controller, UI helpers, card artwork
js/games/             one file per game screen
tests/run.js          engine and solver tests (Node)
```

Adding a game means writing an engine (rules plus a small adapter for the
search) and a screen that registers itself with `GP.registerGame`.

## Credits

Inspired by [Kyle Gerner's Game Pigeon Solvers](https://github.com/k-gerner/Game-Pigeon-Solvers),
a set of command-line tools for the same games. Pigeon Pal is a separate,
from-scratch implementation with a graphical interface; it does not contain
code from that project.

The dictionary is the public-domain ENABLE word list. GamePigeon's own
dictionary is slightly different, so a rare word may occasionally be rejected
in the game.

Not affiliated with or endorsed by GamePigeon.
