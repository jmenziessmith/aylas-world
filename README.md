# Ayla's World — Crocodile River

A web-first Phaser 4 prototype for Ayla's World.

## Run

Requires Node 22+ and pnpm.

```bash
corepack enable
pnpm install
pnpm dev
```

Vite is configured via the script to listen on `0.0.0.0`, so another device on the same Wi-Fi can open:

```text
http://YOUR-COMPUTER-LAN-IP:5173
```

On Windows, `ipconfig` will show the local IPv4 address. If Windows Firewall prompts, allow Node on the private network.

## Deployment

Pushes to `main` build and deploy the game to GitHub Pages through `.github/workflows/deploy-pages.yml`.

## Prototype flow

1. Watch the bicycle-basket clue to remember the next randomly ordered item.
2. Tap/click reachable rocks, gently moving logs, or crocodiles to jump across the river.
3. Safe landings become Ayla's return point; crocodiles bounce her back there.
4. Reach the far bank and choose an item. Ayla can carry correct or incorrect choices.
5. Carry it back to the bicycle, where it is placed in the basket and the next clue appears.
6. A wrong item returns to its far-bank position without advancing the task.
7. Deliver all four items to complete the crossing, then use **Play again** to reshuffle and restart.

## Level authoring

The first river is data-driven in `src/games/crocodile-river/levels/crocodileRiver.ts`.

Games are selected from the home page. Direct development URLs are:

- `/?game=crocodile-river`
- `/?game=jump-party`
- `/?game=cafe`

Ayla’s Café proves choosing an order, carrying a tilting tray for ten steps,
and serving a customer, including spill recovery. Desktop controls use mouse
dragging, arrows/WASD, and Space. See [the café prototype guide](docs/cafe-prototype.md)
for phone controls, tests, and scope, and [the artwork brief](docs/cafe-artwork.md)
for additional sprites to produce.

Jump Party's object layout is data-driven in `src/games/jump-party/level.ts`. Motion jump sensitivity and cooldown are exposed in `src/games/jump-party/MotionJumpInput.ts`.

Add/remove/move entries in `targets` to change length and difficulty. The movement code does not know the sequence; any destination inside `maxJumpDistance` is tappable, which also allows non-linear routes.

## Assets

Game art lives under `public/assets/`. The current prototype uses generated storybook assets as independent sprites rather than a baked level screenshot.
The river panorama supplies both scenery and water. It is scaled uniformly to cover the viewport, pinned to the screen, and explicitly panned from its left edge to its right edge across the crossing; it is never stretched or repeated.

## Codex / Superpowers

This repository intentionally does not use Superpowers. `.codex/config.toml` suppresses automatic skill-instruction injection and `AGENTS.md` explicitly tells repository agents not to invoke it.
