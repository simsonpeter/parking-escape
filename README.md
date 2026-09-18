# Parking Escape

A premium, mobile-first HTML5 sliding-block puzzle. One car has to reach the exit. Everyone else is in the way.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

No build step, no backend, no image assets.

## How to play

- Tap a car's **front** or **back** to slide it automatically, or drag it.
- Horizontal cars move only left/right. Vertical cars move only up/down.
- Cars cannot overlap or leave the lot.
- Slide the red target car through the **EXIT**.
- Stars are awarded from your move count versus the level par.

## Progress

Level unlocks, best stars, and the sound setting are stored in `localStorage` under `parking-escape-v1`.

## Adding levels

Edit `levels.js`. Each level is an ASCII grid:

```js
L(31, 8, [
  "AA.B..",
  "...B..",
  "RR.B..",
  "......",
  "......",
  "......"
])
```

- `R` is the target car
- `A–Z` are other cars
- `.` is empty
- Cars must be straight blocks of length 2 or 3
- `par` is the shortest number of slides, including the final exit

## Files

| File | Role |
| --- | --- |
| `index.html` | Screens and markup |
| `style.css` | Layout, lot, cars, motion |
| `game.js` | Dragging, UI, sound, save data |
| `levels.js` | 50 handcrafted puzzles and solver |
