const TAG = '[IG-VIDEO]';
const SEEK_SECONDS = 10;

// --- Active video selection ---

function getActiveVideo() {
    const videos = [...document.querySelectorAll('video')];
    if (!videos.length) return null;
    const vh = window.innerHeight, vw = window.innerWidth;
    let best = null, bestScore = -Infinity;
    for (const v of videos) {
        const r = v.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const distFromCenter = Math.abs((r.top + r.height / 2) - vh / 2)
                             + Math.abs((r.left + r.width / 2) - vw / 2);
        const score = (v.paused ? 0 : 1e6) - distFromCenter;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
}

// --- Nudge feedback ---

const style = document.createElement('style');
style.textContent = `
    @keyframes ig-nudge-fade {
        0%   { opacity:1; transform:translate(-50%,-50%) scale(1)   }
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
        position:absolute; inset:0; display:flex;
        align-items:center; justify-content:center; gap:14px;
        opacity:0; transition:opacity 0.18s; pointer-events:none; z-index:9998;
    }
    .ig-video-overlay.visible { opacity:1; pointer-events:auto; }
    .ig-btn {
        background:rgba(0,0,0,0.58); color:#fff; border:none; border-radius:50%;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-weight:600; transition:background 0.15s; flex-shrink:0;
    }
    .ig-btn:hover { background:rgba(0,0,0,0.78); }
    .ig-btn-seek { width:42px; height:42px; font-size:13px; }
    .ig-btn-toggle { width:52px; height:52px; font-size:22px; }
`;
document.head.appendChild(style);

function showNudge(video, text) {
    video.parentElement?.querySelector('.ig-nudge')?.remove();
    const nudge = document.createElement('div');
    nudge.className = 'ig-nudge';
    nudge.textContent = text;
    ensurePositioned(video.parentElement);
    video.parentElement?.appendChild(nudge);
    setTimeout(() => nudge.remove(), 700);
}

function ensurePositioned(el) {
    if (el && getComputedStyle(el).position === 'static') el.style.position = 'relative';
}

// --- Overlay buttons ---

const injected = new WeakSet();

function injectOverlay(video) {
    if (injected.has(video)) return;
    injected.add(video);

    const parent = video.parentElement;
    if (!parent) return;
    ensurePositioned(parent);

    const overlay = document.createElement('div');
    overlay.className = 'ig-video-overlay';

    const btnBack   = makeBtn('ig-btn ig-btn-seek',   '−10', `J — back ${SEEK_SECONDS}s`);
    const btnToggle = makeBtn('ig-btn ig-btn-toggle',  '▶',  'K — play/pause');
    const btnFwd    = makeBtn('ig-btn ig-btn-seek',   '+10', `L — forward ${SEEK_SECONDS}s`);

    function syncToggle() { btnToggle.textContent = video.paused ? '▶' : '⏸'; }
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

    overlay.append(btnBack, btnToggle, btnFwd);
    parent.appendChild(overlay);

    // Show on hover over parent or overlay
    let hideTimer;
    const show = () => { clearTimeout(hideTimer); overlay.classList.add('visible'); };
    const hide = () => { hideTimer = setTimeout(() => overlay.classList.remove('visible'), 1200); };
    parent.addEventListener('mouseenter', show);
    parent.addEventListener('mousemove',  show);
    parent.addEventListener('mouseleave', hide);
    overlay.addEventListener('mouseenter', show);
    overlay.addEventListener('mouseleave', hide);
}

function makeBtn(className, text, title) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.title = title;
    return btn;
}

// --- Keyboard shortcuts (capture phase, fires before Instagram's handlers) ---

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

// --- Watch for dynamically added videos (SPA) ---

function scanVideos() {
    document.querySelectorAll('video').forEach(injectOverlay);
}

new MutationObserver(mutations => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'VIDEO') injectOverlay(node);
            node.querySelectorAll?.('video').forEach(injectOverlay);
        }
    }
}).observe(document.body, { childList: true, subtree: true });

scanVideos();
console.log(TAG, '✅ J / K / L + overlay buttons active');
