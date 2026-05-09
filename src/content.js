const TAG = '[IG-VIDEO]';
const SEEK_SECONDS = 10;

function getActiveVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let best = null;
    let bestScore = -Infinity;

    for (const v of videos) {
        const r = v.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Prefer playing; among equals prefer closest to viewport center
        const distFromCenter = Math.abs((r.top + r.height / 2) - vh / 2)
                             + Math.abs((r.left + r.width / 2) - vw / 2);
        const score = (v.paused ? 0 : 1e6) - distFromCenter;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
}

function showNudge(video, text) {
    const existing = video.parentElement?.querySelector('.ig-video-nudge');
    if (existing) existing.remove();

    const nudge = document.createElement('div');
    nudge.className = 'ig-video-nudge';
    nudge.textContent = text;
    nudge.style.cssText = `
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.55); color:#fff; font-size:18px; font-weight:600;
        padding:8px 18px; border-radius:8px; pointer-events:none; z-index:9999;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:ig-nudge-fade 0.7s ease forwards;
    `;

    // Ensure parent is positioned
    const parent = video.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    parent?.appendChild(nudge);
    setTimeout(() => nudge.remove(), 700);
}

// Inject keyframe animation once
const style = document.createElement('style');
style.textContent = `@keyframes ig-nudge-fade { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-60%) scale(1.1)} }`;
document.head.appendChild(style);

document.addEventListener('keydown', e => {
    // Skip if typing in an input
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toLowerCase();
    if (!['j', 'k', 'l'].includes(key)) return;

    const video = getActiveVideo();
    if (!video) return;

    if (key === 'j') {
        video.currentTime = Math.max(0, video.currentTime - SEEK_SECONDS);
        showNudge(video, `-${SEEK_SECONDS}s`);
    } else if (key === 'l') {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK_SECONDS);
        showNudge(video, `+${SEEK_SECONDS}s`);
    } else if (key === 'k') {
        video.paused ? video.play() : video.pause();
        showNudge(video, video.paused ? '▶' : '⏸');
    }

    e.stopPropagation();
    e.preventDefault();
}, true); // capture phase: fires before Instagram's own handlers

console.log(TAG, '✅ J / K / L controls active');
