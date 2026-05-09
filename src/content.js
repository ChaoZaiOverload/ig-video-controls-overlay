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
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.55); color:#fff; font-size:18px; font-weight:600;
        padding:8px 18px; border-radius:8px; pointer-events:none; z-index:9999;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:ig-nudge-fade 0.7s ease forwards;
    }
    .ig-video-overlay {
        position:absolute; inset:0; z-index:9998;
        display:flex; flex-direction:column;
        opacity:0; transition:opacity 0.18s; pointer-events:none;
    }
    .ig-video-overlay.visible { opacity:1; pointer-events:auto; }
    .ig-btn-row {
        flex:1; display:flex; align-items:center; justify-content:center; gap:14px;
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
        background:linear-gradient(transparent, rgba(0,0,0,0.55));
        display:flex; align-items:center; gap:8px;
    }
    .ig-time {
        font-size:11px; color:#fff; white-space:nowrap; flex-shrink:0;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-variant-numeric:tabular-nums;
    }
    .ig-progress-track {
        flex:1; height:4px; background:rgba(255,255,255,0.3);
        border-radius:2px; cursor:pointer; position:relative;
        transition:height 0.12s;
    }
    .ig-progress-track:hover { height:6px; }
    .ig-progress-fill {
        height:100%; background:#fff; border-radius:2px; pointer-events:none;
    }
    .ig-progress-handle {
        position:absolute; top:50%; transform:translate(-50%,-50%);
        width:13px; height:13px; background:#fff; border-radius:50%;
        opacity:0; transition:opacity 0.12s; pointer-events:none;
    }
    .ig-progress-track:hover .ig-progress-handle { opacity:1; }
`;
document.head.appendChild(style);

// --- Helpers ---

function ensurePositioned(el) {
    if (el && getComputedStyle(el).position === 'static') el.style.position = 'relative';
}

function formatTime(s) {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function showNudge(video, text) {
    video.parentElement?.querySelector('.ig-nudge')?.remove();
    const nudge = document.createElement('div');
    nudge.className = 'ig-nudge';
    nudge.textContent = text;
    ensurePositioned(video.parentElement);
    video.parentElement?.appendChild(nudge);
    setTimeout(() => nudge.remove(), 700);
}

function makeBtn(cls, text, title) {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.title = title;
    return btn;
}

// --- Active video (for keyboard shortcuts) ---

function getActiveVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;
    const vh = window.innerHeight, vw = window.innerWidth;
    let best = null, bestScore = -Infinity;
    for (const v of videos) {
        const r = v.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const dist = Math.abs((r.top + r.height / 2) - vh / 2)
                   + Math.abs((r.left + r.width / 2) - vw / 2);
        const score = (v.paused ? 0 : 1e6) - dist;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
}

// --- Overlay injection ---

const injected = new WeakSet();

function injectOverlay(video) {
    if (injected.has(video)) return;
    injected.add(video);

    const parent = video.parentElement;
    if (!parent) return;
    ensurePositioned(parent);

    // Root overlay
    const overlay = document.createElement('div');
    overlay.className = 'ig-video-overlay';

    // --- Button row ---
    const btnRow = document.createElement('div');
    btnRow.className = 'ig-btn-row';

    const btnBack   = makeBtn('ig-btn ig-btn-seek',   '−10', `J — back ${SEEK_SECONDS}s`);
    const btnToggle = makeBtn('ig-btn ig-btn-toggle',  '▶',  'K — play / pause');
    const btnFwd    = makeBtn('ig-btn ig-btn-seek',   '+10', `L — forward ${SEEK_SECONDS}s`);

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

    const timeEl = document.createElement('div');
    timeEl.className = 'ig-time';
    timeEl.textContent = '0:00 / 0:00';

    const track = document.createElement('div');
    track.className = 'ig-progress-track';

    const fill = document.createElement('div');
    fill.className = 'ig-progress-fill';

    const handle = document.createElement('div');
    handle.className = 'ig-progress-handle';

    track.append(fill, handle);
    progressSection.append(timeEl, track);

    overlay.append(btnRow, progressSection);
    parent.appendChild(overlay);

    // Sync progress bar with video
    const updateProgress = () => {
        const ratio = video.duration ? video.currentTime / video.duration : 0;
        const pct = (ratio * 100).toFixed(2) + '%';
        fill.style.width = pct;
        handle.style.left = pct;
        timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    };
    video.addEventListener('timeupdate',     updateProgress);
    video.addEventListener('loadedmetadata', updateProgress);
    updateProgress();

    // Drag-to-seek
    let isDragging = false;

    const seekToX = clientX => {
        const r = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        video.currentTime = ratio * (video.duration || 0);
    };

    track.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        isDragging = true;
        seekToX(e.clientX);
    });
    document.addEventListener('mousemove', e => { if (isDragging) seekToX(e.clientX); });
    document.addEventListener('mouseup',   () => { isDragging = false; });

    // Hover show / hide
    let hideTimer;
    const show = () => { clearTimeout(hideTimer); overlay.classList.add('visible'); };
    const hide = () => {
        hideTimer = setTimeout(() => {
            if (!isDragging) overlay.classList.remove('visible');
        }, 1200);
    };
    parent.addEventListener('mouseenter', show);
    parent.addEventListener('mousemove',  show);
    parent.addEventListener('mouseleave', hide);
    overlay.addEventListener('mouseenter', show);
    overlay.addEventListener('mouseleave', hide);
}

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

// --- Watch for dynamically added videos ---

new MutationObserver(mutations => {
    for (const m of mutations)
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'VIDEO') injectOverlay(node);
            node.querySelectorAll?.('video').forEach(injectOverlay);
        }
}).observe(document.body, { childList: true, subtree: true });

document.querySelectorAll('video').forEach(injectOverlay);
console.log(TAG, '✅ J/K/L + overlay + progress bar active');
