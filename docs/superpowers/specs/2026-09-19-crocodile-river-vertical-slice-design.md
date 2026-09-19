# Crocodile River Vertical Slice Design

## Goal

Prove that Ayla can cross a horizontally scrolling, illustrated river by tapping explicit landing targets, with a gentle camera and a funny, recoverable crocodile failure.

## Scope

This slice contains one landscape crossing, at least four configured destinations, reusable scene pieces, pointer-driven jumps, safe-location tracking, crocodile failure, parallax, and responsive resizing. It does not contain retrieval missions, dialogue, inventory, lives, physics, manual movement, a backend, or progression systems.

## Architecture

The game uses one Phaser scene. A small level module exports landing targets shaped as `{ type, x, y, variant? }` plus the starting and ending positions. Adding an entry changes the world content and derived camera bounds without changing movement code.

The scene composes separate background layers, repeating water, start and end banks, rocks, crocodiles, Ayla, and simple shadows. Assets are grouped under `src/assets` by their intended role. Supplied artwork is reused where practical; unavailable crossing pieces use deliberately simple storybook-style placeholders.

## Interaction and Movement

Each destination is an interactive Phaser image. Mouse and touch both arrive through Phaser's pointer events. Clicking elsewhere does nothing. Input is ignored while Ayla is moving.

A jump uses a Phaser tween timeline: a short anticipation squash, horizontal travel with an authored upward-and-downward arc, then a landing squash and recovery. No physics system is enabled.

After a rock landing, the destination becomes Ayla's previous safe position. After a crocodile landing, Ayla and the crocodile perform a visible comic bounce before Ayla returns to the stored safe position. A crocodile never updates safe progress.

## Camera and Rendering

The logical game size is 960 x 540 and Phaser scales it to fit the available landscape viewport while preserving aspect ratio. This avoids excessive internal rendering resolution on the Fire HD 8 while remaining crisp enough on an iPhone 15.

The main camera follows Ayla using lerp and stays inside level-derived horizontal bounds, so the complete crossing is not visible at once. Background layers adjust their scroll position at small independent factors. Water repeats horizontally instead of using a full-level image.

## Testing and Verification

Small unit tests cover the pure state transition for safe and crocodile landings and the level-width calculation. Browser verification covers pointer interaction, jump timing, crocodile recovery, camera travel, parallax, and responsive landscape resizing. Final checks run the test suite and production build.

## Constraints

Use Phaser 4, TypeScript, Vite, and pnpm only. Keep gameplay code direct and scene-specific. Do not add a generic engine, plugin framework, state library, physics, shaders, or speculative abstractions.
