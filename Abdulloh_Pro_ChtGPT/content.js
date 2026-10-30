// Content Script - AItest Pro V18 (MAIN + ISOLATED World God Mode + Closed Shadow DOM + Zero-Error Ghost Mode)

let isEnabled = false;
let isOverlayHidden = false;
let isShieldApplied = false;
let isSolving = false;
let lastValidAnswerShownAt = 0;

let stealthHost = null;
let shadowRoot = null;
let overlayEl = null;
let controlBarEl = null;
let wipeTimer = null;

const isTopFrame = (window === window.top);

function isAiProviderHost() {
    const h = (location.hostname || "").toLowerCase();
    return h.includes("gemini.google.com") ||
           h.includes("chatgpt.com") ||
           h.includes("openai.com") ||
           h.includes("accounts.google.com");
}

chrome.storage.local.get("enabled", (data) => {
    isEnabled = !!data.enabled;
    if (isEnabled && !isAiProviderHost()) {
        activateShieldV18();
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle") {
        isEnabled = !!msg.state;
        if (isEnabled && !isAiProviderHost()) {
            activateShieldV18();
        } else if (!isEnabled && !isAiProviderHost()) {
            location.reload();
        }
    } else if (msg.action === "show_answer" && isTopFrame) {
        if (msg.answer && msg.answer !== "-") {
            lastValidAnswerShownAt = Date.now();
        }
        displayAnswerWithAutoWipe(msg.answer);
    }
});

// ================= 1. NATIVE CODE SPOOFING (PROTOTYPE STEALTH) =================
const originalToString = Function.prototype.toString;
const mockedNativeFunctions = new Set();

function makeNative(fn, name = '') {
    mockedNativeFunctions.add(fn);
    try {
        Object.defineProperty(fn, 'name', { value: name, configurable: true });
    } catch(e) {}
    return fn;
}

try {
    Function.prototype.toString = makeNative(function() {
        if (mockedNativeFunctions.has(this)) {
            const name = this.name || '';
            return `function ${name}() { [native code] }`;
        }
        return originalToString.apply(this, arguments);
    }, 'toString');
} catch(e) {}

// ================= 2. GOD MODE HIMOYASI =================
function activateShieldV18() {
    if (isShieldApplied || isAiProviderHost()) return;
    isShieldApplied = true;

    try {
        chrome.runtime.sendMessage({ action: "inject_main_shield" }, () => {
            void chrome.runtime.lastError;
        });
    } catch(e) {}

    if (isTopFrame) {
        if (document.documentElement || document.body) {
            createStealthControlBar();
        } else {
            document.addEventListener("DOMContentLoaded", () => createStealthControlBar(), { once: true });
        }
    }

    try { console.clear = makeNative(() => {}, 'clear'); } catch(e) {}

    const getVis = makeNative(() => 'visible', 'get visibilityState');
    const getHidden = makeNative(() => false, 'get hidden');
    const hasFocusMock = makeNative(() => true, 'hasFocus');

    try { Object.defineProperty(document, 'visibilityState', { get: getVis, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'hidden', { get: getHidden, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Document.prototype, 'visibilityState', { get: getVis, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Document.prototype, 'hidden', { get: getHidden, configurable: true }); } catch(e) {}
    try { document.hasFocus = hasFocusMock; } catch(e) {}
    try { Document.prototype.hasFocus = hasFocusMock; } catch(e) {}

    // ================= FULLSCREEN BLOKLASH VA MUKAMMAL ALDOVI =================
    const fakeRequestFullscreen = makeNative(function() {
        setTimeout(() => {
            try {
                const evt = new Event('fullscreenchange', { bubbles: true, cancelable: true });
                document.dispatchEvent(evt);
                window.dispatchEvent(evt);
            } catch(e) {}
        }, 10);
        return Promise.resolve();
    }, 'requestFullscreen');

    const fakeExitFullscreen = makeNative(function() {
        return Promise.resolve();
    }, 'exitFullscreen');

    const fsTargets = [Element.prototype, HTMLElement.prototype];
    if (typeof document !== 'undefined' && document.documentElement) {
        fsTargets.push(document.documentElement);
    }
    fsTargets.forEach(target => {
        if (!target) return;
        ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'mozRequestFullScreen', 'msRequestFullscreen'].forEach(method => {
            try {
                Object.defineProperty(target, method, {
                    value: fakeRequestFullscreen,
                    writable: true,
                    configurable: true
                });
            } catch(e) {}
        });
    });

    [document, Document.prototype].forEach(target => {
        if (!target) return;
        ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen'].forEach(method => {
            try {
                Object.defineProperty(target, method, {
                    value: fakeExitFullscreen,
                    writable: true,
                    configurable: true
                });
            } catch(e) {}
        });
    });

    const getFullscreenEl = makeNative(() => document.documentElement, 'get fullscreenElement');
    const getFullscreenTrue = makeNative(() => true, 'get fullscreen');

    ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement', 'msFullscreenElement'].forEach(prop => {
        try { Object.defineProperty(document, prop, { get: getFullscreenEl, configurable: true }); } catch(e) {}
        try { Object.defineProperty(Document.prototype, prop, { get: getFullscreenEl, configurable: true }); } catch(e) {}
    });

    ['fullscreen', 'webkitIsFullScreen', 'mozFullScreen'].forEach(prop => {
        try { Object.defineProperty(document, prop, { get: getFullscreenTrue, configurable: true }); } catch(e) {}
        try { Object.defineProperty(Document.prototype, prop, { get: getFullscreenTrue, configurable: true }); } catch(e) {}
    });

    try {
        Object.defineProperty(screen, 'availHeight', { get: makeNative(() => window.innerHeight, 'availHeight'), configurable: true });
        Object.defineProperty(screen, 'height', { get: makeNative(() => window.innerHeight, 'height'), configurable: true });
        Object.defineProperty(screen, 'availWidth', { get: makeNative(() => window.innerWidth, 'availWidth'), configurable: true });
        Object.defineProperty(screen, 'width', { get: makeNative(() => window.innerWidth, 'width'), configurable: true });
    } catch(e) {}

    const stopEvent = makeNative((e) => {
        if (isEnabled) {
            e.stopImmediatePropagation();
            return false;
        }
    }, 'stopEvent');

    const blockedEvents = [
        'blur', 'focusout', 'visibilitychange', 'webkitvisibilitychange',
        'mouseleave', 'mouseout', 'resize', 'fullscreenchange', 'webkitfullscreenchange',
        'contextmenu', 'copy', 'paste', 'cut', 'selectstart'
    ];

    blockedEvents.forEach(evt => {
        window.addEventListener(evt, stopEvent, true);
        document.addEventListener(evt, stopEvent, true);
    });

    window.addEventListener('keydown', (e) => {
        if (!isEnabled) return;

        if (e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            captureAndSolve();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            fetchAnswerNow();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            toggleOverlay();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            closeAndCleanAI();
            return;
        }

        if (e.altKey || e.ctrlKey || e.metaKey || e.key === 'PrintScreen' || e.key === 'F12') {
            e.stopImmediatePropagation();
        }
    }, true);

    window.addEventListener('keyup', (e) => {
        if (!isEnabled) return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta' || e.key === 'PrintScreen') {
            e.stopImmediatePropagation();
        }
    }, true);
}

// ================= 3. CLOSED SHADOW DOM (DOM SKANERLARIDAN 100% YASHIRISH) =================
function getStealthRoot() {
    if (shadowRoot && stealthHost && stealthHost.isConnected) return shadowRoot;

    stealthHost = document.createElement("div");
    stealthHost.style.cssText = "all: initial !important; position: static !important; display: contents !important;";
    shadowRoot = stealthHost.attachShadow({ mode: "closed" });

    const parent = document.documentElement || document.body;
    if (parent) {
        parent.appendChild(stealthHost);
    }
    return shadowRoot;
}

function getOrCreateOverlay() {
    const root = getStealthRoot();
    if (overlayEl && overlayEl.isConnected) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.style.cssText = `
        position: fixed;
        bottom: 5px;
        left: 5px;
        z-index: 2147483647;
        padding: 4px 7px;
        background: rgba(255, 255, 255, 0.01);
        color: rgba(140, 140, 140, 0.6);
        border-radius: 3px;
        font-size: 10px;
        font-family: monospace;
        pointer-events: none;
        max-width: 340px;
        max-height: 80px;
        overflow: hidden;
        transition: opacity 0.3s;
    `;
    root.appendChild(overlayEl);
    return overlayEl;
}

// ================= 4. GHOST MODE (XATOLIKSIZ VA AVTOMATIK TOZALANUVCHI) =================
function sanitizeDisplayText(text) {
    if (!text) return "";
    const str = String(text).trim();
    if (!str) return "";
    if (/^(xatolik|error|invalid|cannot|failed|javob yo'q|javob kelmadi|gemini|chatgpt)/i.test(str)) {
        return "-";
    }
    return str;
}

let lastValidAnswer = "";

function displayAnswerWithAutoWipe(text) {
    if (!isTopFrame) return;
    const cleanText = sanitizeDisplayText(text);
    if (cleanText && cleanText !== ".." && cleanText !== "-") {
        lastValidAnswer = cleanText;
        lastValidAnswerShownAt = Date.now();
    }
    // Agar hozirgina haqiqiy javob ko'rsatilgan bo'lsa (yoki avvalgi javob mavjud bo'lsa), uni "-" bilan ustidan yozib yubormaymiz!
    if (cleanText === "-" && (Date.now() - lastValidAnswerShownAt < 8000)) {
        if (lastValidAnswer) {
            getOrCreateOverlay().innerText = lastValidAnswer;
        }
        return;
    }

    const overlay = getOrCreateOverlay();
    overlay.innerText = cleanText;
    overlay.style.display = isOverlayHidden ? "none" : "block";

    if (wipeTimer) clearTimeout(wipeTimer);
    if (cleanText && cleanText !== "..") {
        wipeTimer = setTimeout(() => {
            overlay.innerText = "";
        }, 7000);
    }
}

function toggleOverlay() {
    if (!isTopFrame) return;
    isOverlayHidden = !isOverlayHidden;
    const el = getOrCreateOverlay();
    el.style.display = isOverlayHidden ? "none" : "block";
}

async function captureAndSolve() {
    if (!isEnabled || isSolving) return;
    isSolving = true;
    displayAnswerWithAutoWipe("..");

    const safetyUnlock = setTimeout(() => { isSolving = false; }, 65000);

    try {
        chrome.runtime.sendMessage({ action: "capture" }, (response) => {
            clearTimeout(safetyUnlock);
            isSolving = false;
            void chrome.runtime.lastError;
            if (response && response.answer) {
                displayAnswerWithAutoWipe(response.answer);
            }
        });
    } catch (e) {
        clearTimeout(safetyUnlock);
        isSolving = false;
    }
}

async function fetchAnswerNow() {
    if (!isEnabled) return;
    displayAnswerWithAutoWipe("..");

    try {
        chrome.runtime.sendMessage({ action: "fetch_latest_answer" }, (response) => {
            void chrome.runtime.lastError;
            if (response && response.answer && response.answer !== "-") {
                displayAnswerWithAutoWipe(response.answer);
            } else if (lastValidAnswer) {
                displayAnswerWithAutoWipe(lastValidAnswer);
            } else {
                displayAnswerWithAutoWipe("-");
            }
        });
    } catch (e) {
        if (lastValidAnswer) {
            displayAnswerWithAutoWipe(lastValidAnswer);
        } else {
            displayAnswerWithAutoWipe("-");
        }
    }
}

function closeAndCleanAI() {
    if (wipeTimer) clearTimeout(wipeTimer);
    if (isTopFrame) {
        const el = getOrCreateOverlay();
        el.innerText = "";
    }
    try {
        chrome.runtime.sendMessage({ action: "cleanup_gemini" }, () => {
            void chrome.runtime.lastError;
        });
    } catch (e) {}
}

function createStealthControlBar() {
    if (!isTopFrame) return;
    const root = getStealthRoot();
    if (controlBarEl && controlBarEl.isConnected) return;

    controlBarEl = document.createElement("div");
    controlBarEl.style.cssText = `
        position: fixed;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        gap: 5px;
        user-select: none;
        background: transparent;
    `;

    const btnSolve = createStealthBtn("·", () => captureAndSolve());
    const btnFetch = createStealthBtn("·", () => fetchAnswerNow());
    const btnToggle = createStealthBtn("·", () => toggleOverlay());
    const btnClean = createStealthBtn("·", () => closeAndCleanAI());

    controlBarEl.appendChild(btnSolve);
    controlBarEl.appendChild(btnFetch);
    controlBarEl.appendChild(btnToggle);
    controlBarEl.appendChild(btnClean);

    root.appendChild(controlBarEl);
}

function createStealthBtn(dotChar, onClick) {
    const btn = document.createElement("div");
    btn.style.cssText = `
        width: 38px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.001);
        color: rgba(140, 140, 140, 0.08);
        font-size: 16px;
        font-family: monospace;
        transition: color 0.15s, background 0.15s;
        border-radius: 3px;
    `;
    btn.innerText = dotChar;

    btn.addEventListener("mouseenter", () => {
        btn.style.color = "rgba(140, 140, 140, 0.4)";
        btn.style.background = "rgba(255, 255, 255, 0.05)";
    });

    btn.addEventListener("mouseleave", () => {
        btn.style.color = "rgba(140, 140, 140, 0.08)";
        btn.style.background = "rgba(255, 255, 255, 0.001)";
    });

    btn.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClick();
    });

    return btn;
}
