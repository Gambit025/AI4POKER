# AI4POKER

AI-powered Texas Hold'em poker trainer with real-time coaching.

## Features

- **AI Coach** — Real-time win probability, EHS analysis, and natural language betting suggestions at every street (Preflop / Flop / Turn / River)
- **2–8 Players** — Configurable table size with intelligent seat layout
- **9 AI Personalities** — TAG, LAG, Tight Passive, Loose Passive, GTO, Maniac, Nit, Shark, Fish
- **Hand Recap** — Post-hand analysis grading each decision with poker terminology (Pot Odds, Fold Equity, EV, SPR, etc.)
- **Sound Effects** — Synthesized audio for deals, bets, folds, and wins via Web Audio API
- **Mobile-First UI** — Dark glassmorphism design optimized for phone screens
- **Debt System** — Players can go negative, keeping the game running without forced eliminations

## Tech Stack

- Vanilla HTML / CSS / JavaScript (zero dependencies)
- Monte Carlo simulation for win probability
- Web Worker for non-blocking computation
- Web Audio API for synthesized sound effects

## Quick Start

```bash
cd AI4POKER
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

Or simply open `index.html` directly — no build step required.

## Project Structure

```
AI4POKER/
├── index.html          # Main HTML entry
├── style.css           # Dark glassmorphism styles
├── js/
│   ├── game.js         # Core poker engine, AI logic, hand evaluation
│   ├── app.js          # UI rendering, animations, event handling
│   ├── seatPositions.js # Table seat layout for 2-8 players
│   ├── sounds.js       # Web Audio API sound synthesis
│   └── mcWorker.js     # Web Worker for Monte Carlo simulation
└── README.md
```

## License

MIT
