const TAG = '[IG-VIDEO]';
const SEEK_SECONDS = 10;

// --- Styles ---

const style = document.createElement('style');
style.textContent = `
    @keyframes ig-nudge-fade {
        0%   { opacity:1; transform:translate(-50%,-50%) scale(1)    }
        100% { opacity:0; transform:translate(-50%,-60%) scale(1.15) }
    }
    .ig-nudge {
        position:fixed; z-index:10000;
        background:rgba(0,0,0,0.55); color:#fff; font-size:18px; font-weight:600;
        padding:8px 18px; border-radius:8px; pointer-events:none;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:ig-nudge-fade 0.7s ease forwards;
        transform:translate(-50%,-50%);
    }
    .ig-video-overlay {
        position:fixed; z-index:9999; pointer-events:none;
        display:flex; flex-direction:column;
        opacity:0; transition:opacity 0.18s;
    }
    .ig-video-overlay.visible { opacity:1; }
    .ig-btn-row {
        flex:1; display:flex; align-items:center; justify-content:center; gap:14px;
        pointer-events:none;
    }
    .ig-btn {
        background:rgba(0,0,0,0.58); color:#fff; border:none; border-radius:50%;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-weight:600; transition:background 0.15s; flex-shrink:0;
    }
    .ig-btn:hover { background:rgba(0,0,0,0.78); }
    .ig-btn-seek   { width:42px; height:42px; font-size:13px; }
    .ig-btn-toggle { width:52px; height:52px; font-size:22px; }
    .ig-progress-section {
        padding:6px 10px 8px;
        background:linear-gradient(transparent, rgba(0,0,0,0.6));
        display:flex; align-items:center; gap:8px;
    }
    .ig-time {
        font-size:11px; color:#fff; white-space:nowrap; flex-shrink:0;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-variant-numeric:tabular-nums;
    }
    .ig-progress-track {
        flex:1; height:4px; background:rgba(255,255,255,0.35);
        border-radius:2px; cursor:pointer; position:relative;
        transition:height 0.12s;
    }
    .ig-progress-track:hover { height:6px; }
    .ig-progress-fill {
        height:100%; background:#fff; border-radius:2px; pointer-events:none; max-width:100%;
    }
    .ig-progress-handle {
        position:absolute; top:50%; transform:translate(-50%,-50%);
        width:13px; height:13px; background:#fff; border-radius:50%;
        opacity:0; transition:opacity 0.12s; pointer-events:none;
    }
    .ig-progress-track:hover .ig-progress-handle { opacity:1; }
    .ig-video-overlay.visible .ig-btn { pointer-events:auto; }
    .ig-video-overlay.visible .ig-progress-section { pointer-events:auto; }
`;
document.head.appendChild(style);

// --- Helpers ---

function formatTime(s) {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function makeBtn(cls, text, title) {
    const btn = document.createElement('button');
    btn.className = cls; btn.textContent = text; btn.title = title;
    return btn;
}

function showNudge(video, text) {
    document.querySelector('.ig-nudge')?.remove();
    const r = video.getBoundingClientRect();
    const nudge = document.createElement('div');
    nudge.className = 'ig-nudge';
    nudge.textContent = text;
    nudge.style.left = (r.left + r.width  / 2) + 'px';
    nudge.style.top  = (r.top  + r.height / 2) + 'px';
    document.body.appendChild(nudge);
    setTimeout(() => nudge.remove(), 700);
}

function getActiveVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;
    const vh = window.innerHeight, vw = window.innerWidth;
    let best = null, bestScore = -Infinity;
    for (const v of videos) {
        const r = v.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const dist  = Math.abs((r.top  + r.height / 2) - vh / 2)
                    + Math.abs((r.left + r.width  / 2) - vw / 2);
        const score = (v.paused ? 0 : 1e6) - dist;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
}

// --- Per-video state ---
// Map<HTMLVideoElement, { overlay, rafId, hideTimer, isDragging, io }>
const videoMap = new Map();

function cleanupVideo(video) {
    const state = videoMap.get(video);
    if (!state) return;
    if (state.rafId)    { cancelAnimationFrame(state.rafId); }
    if (state.hideTimer){ clearTimeout(state.hideTimer); }
    if (state.io)       { state.io.disconnect(); }
    state.overlay.remove();
    videoMap.delete(video);
}

function injectOverlay(video) {
    if (videoMap.has(video)) return;

    const overlay = document.createElement('div');
    overlay.className = 'ig-video-overlay';
    document.body.appendChild(overlay);

    const state = { overlay, rafId: null, hideTimer: null, isDragging: false, io: null };
    videoMap.set(video, state);

    // --- Buttons ---
    const btnRow    = document.createElement('div');
    btnRow.className = 'ig-btn-row';
    const btnBack   = makeBtn('ig-btn ig-btn-seek',  '−10', `J — back ${SEEK_SECONDS}s`);
    const btnToggle = makeBtn('ig-btn ig-btn-toggle', '▶',  'K — play / pause');
    const btnFwd    = makeBtn('ig-btn ig-btn-seek',  '+10', `L — forward ${SEEK_SECONDS}s`);

    const syncToggle = () => { btnToggle.textContent = video.paused ? '▶' : '⏸'; };
    syncToggle();
    video.addEventListener('play',  syncToggle);
    video.addEventListener('pause', syncToggle);

    btnBack.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - SEEK_SECONDS);
        showNudge(video, `−${SEEK_SECONDS}s`);
    });
    btnToggle.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        video.paused ? video.play() : video.pause();
    });
    btnFwd.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK_SECONDS);
        showNudge(video, `+${SEEK_SECONDS}s`);
    });
    btnRow.append(btnBack, btnToggle, btnFwd);

    // --- Progress bar ---
    const progressSection = document.createElement('div');
    progressSection.className = 'ig-progress-section';
    const timeEl = document.createElement('span');
    timeEl.className = 'ig-time';
    timeEl.textContent = '0:00 / 0:00';
    const track  = document.createElement('div');
    track.className = 'ig-progress-track';
    const fill   = document.createElement('div');
    fill.className = 'ig-progress-fill';
    const handle = document.createElement('div');
    handle.className = 'ig-progress-handle';
    track.append(fill, handle);
    progressSection.append(timeEl, track);
    overlay.append(btnRow, progressSection);

    const resetProgress = () => {
        fill.style.width  = '0%';
        handle.style.left = '0%';
        timeEl.textContent = '0:00 / 0:00';
    };
    const updateProgress = () => {
        const pct = video.duration ? (video.currentTime / video.duration * 100).toFixed(2) + '%' : '0%';
        fill.style.width   = pct;
        handle.style.left  = pct;
        timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    };
    // emptied fires when Instagram loads a new video into the same element (e.g. next reel)
    video.addEventListener('emptied',        resetProgress);
    video.addEventListener('loadedmetadata', updateProgress);
    video.addEventListener('timeupdate',     updateProgress);
    updateProgress();

    // --- Drag to seek ---
    track.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        state.isDragging = true;
        const r = track.getBoundingClientRect();
        video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (video.duration || 0);
    });
    document.addEventListener('mousemove', e => {
        if (!state.isDragging) return;
        const r = track.getBoundingClientRect();
        video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (video.duration || 0);
    });
    document.addEventListener('mouseup', () => { state.isDragging = false; });

    // --- Position sync via rAF (only while overlay is visible) ---
    const syncPosition = () => {
        const r = video.getBoundingClientRect();
        overlay.style.top    = r.top    + 'px';
        overlay.style.left   = r.left   + 'px';
        overlay.style.width  = r.width  + 'px';
        overlay.style.height = r.height + 'px';
    };
    const startSync = () => {
        if (state.rafId) return;
        const loop = () => {
            if (!document.contains(video)) { cleanupVideo(video); return; }
            syncPosition();
            state.rafId = requestAnimationFrame(loop);
        };
        state.rafId = requestAnimationFrame(loop);
    };
    const stopSync = () => {
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    };

    state.show = () => {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
        overlay.classList.add('visible');
        startSync();
    };
    state.hide = () => {
        state.hideTimer = setTimeout(() => {
            if (!state.isDragging) { overlay.classList.remove('visible'); stopSync(); }
        }, 1200);
    };

    // --- IntersectionObserver: stop sync when video scrolls out of view ---
    state.io = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) {
            overlay.classList.remove('visible');
            stopSync();
        }
    }, { threshold: 0.1 });
    state.io.observe(video);
}

// --- Global mousemove: show/hide based on cursor position (works even with pointer-events:none on video) ---
document.addEventListener('mousemove', e => {
    for (const [video, state] of videoMap) {
        const r = video.getBoundingClientRect();
        const overVideo = r.width > 0 && r.height > 0
            && e.clientX >= r.left && e.clientX <= r.right
            && e.clientY >= r.top  && e.clientY <= r.bottom;
        const or = state.overlay.getBoundingClientRect();
        const overOverlay = e.clientX >= or.left && e.clientX <= or.right
                         && e.clientY >= or.top  && e.clientY <= or.bottom;

        if (overVideo || overOverlay) {
            if (state.hideTimer) { clearTimeout(state.hideTimer); state.hideTimer = null; }
            state.show();
        } else if (!state.hideTimer && !state.isDragging) {
            state.hide();
        }
    }
});

// --- Keyboard shortcuts ---
document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (!['j', 'k', 'l'].includes(key)) return;

    const video = getActiveVideo();
    if (!video) return;

    if (key === 'j') {
        video.currentTime = Math.max(0, video.currentTime - SEEK_SECONDS);
        showNudge(video, `−${SEEK_SECONDS}s`);
    } else if (key === 'l') {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK_SECONDS);
        showNudge(video, `+${SEEK_SECONDS}s`);
    } else if (key === 'k') {
        video.paused ? video.play() : video.pause();
        showNudge(video, video.paused ? '▶' : '⏸');
    }
    e.stopPropagation();
    e.preventDefault();
}, true);

// --- Video discovery ---
function scanVideos() {
    document.querySelectorAll('video').forEach(injectOverlay);
}

const domObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'VIDEO') injectOverlay(node);
            node.querySelectorAll?.('video').forEach(injectOverlay);
        }
        // Clean up overlays for removed videos (with a short delay to ignore React's
        // temporary remove-then-reinsert during reconciliation)
        for (const node of m.removedNodes) {
            if (node.nodeType !== 1) continue;
            const check = v => setTimeout(() => { if (!document.contains(v)) cleanupVideo(v); }, 500);
            if (node.tagName === 'VIDEO') check(node);
            node.querySelectorAll?.('video').forEach(check);
        }
    }
});
domObserver.observe(document.body, { childList: true, subtree: true });

scanVideos();
setInterval(scanVideos, 2000); // fallback for videos that slip past MutationObserver
console.log(TAG, '✅ active');
