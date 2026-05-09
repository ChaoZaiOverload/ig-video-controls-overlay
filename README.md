# Instagram Video Controls Overlay

A Chrome extension that adds a YouTube-style video controls overlay to Instagram — seek buttons, a draggable progress bar, and keyboard shortcuts.

## Features

- **Hover overlay** — appears when your cursor is over any Instagram video: `−10s`, play/pause, `+10s` buttons and a full progress bar
- **Draggable progress bar** — click or drag to seek to any timestamp; shows `current / total` time
- **Keyboard shortcuts** — works on the video closest to the viewport center:
  - `J` — back 10 seconds
  - `K` — play / pause
  - `L` — forward 10 seconds
- Works on profile pages, Reels, and the main feed
- Instagram's own controls (mute, etc.) remain fully accessible

## Installation

Not on the Chrome Web Store. Load it manually:

1. Clone or download this repo
2. Go to `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the repo folder
4. Open any Instagram page with a video and hover over it

## How it works

The content script uses `querySelectorAll('video')` to find native HTML5 video elements — no Instagram-specific selectors that break on every deploy. The overlay is appended to `document.body` with `position: fixed`, positioned via `getBoundingClientRect()` and kept in sync with a `requestAnimationFrame` loop (only while visible). Hover detection uses a global `mousemove` listener checking cursor geometry against the video rect, since Instagram sets `pointer-events: none` on its video elements.

**Resilience measures:**
- `MutationObserver` on `document.body` detects dynamically added videos; removed videos are cleaned up with a 500 ms delay to skip React's temporary remove-reinsert during reconciliation
- `IntersectionObserver` stops the rAF sync when a video scrolls out of view
- `emptied` event resets the progress bar when Instagram loads a new video into the same element (e.g. scrolling between Reels)
- `setInterval` fallback scans for new videos every 2 seconds

## Compatibility

Targets `https://www.instagram.com/*`. Because the extension only touches native `<video>` elements and never reads Instagram's CSS class names, it is resilient to Instagram's frequent front-end deployments.
