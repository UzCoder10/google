// Content Script - AItest Pro (God Mode + Closed Shadow DOM + Native Code Masking + Ghost Auto-Wipe)

let isEnabled = false;
let isOverlayHidden = false;
let isShieldApplied = false;

let stealthHost = null;
let shadowRoot = null;
let overlayEl = null;
let controlBarEl = null;
let wipeTimer = null;

chrome.storage.local.get("enabled", (data) => {
    isEnabled = data.enabled;
    if (isEnabled) activateShieldV14();
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle") {
        isEnabled = msg.state;
        if (isEnabled) activateShieldV14();
        else location.reload();
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
function activateShieldV14() {
    if (isShieldApplied) return; 
    if (location.hostname.includes("chatgpt.com") || location.hostname.includes("openai.com")) return;
    isShieldApplied = true;
    createStealthControlBar();

    console.clear = makeNative(() => {}, 'clear');

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
    // Sayt to'liq ekranga kirishga urinsa (requestFullscreen) YO'L QO'YMAYMIZ, lekin saytga "Kirding" deb aldaymiz
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

    // Barcha elementlarning requestFullscreen funksiyasini zararsizlantirish
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

    // Ekran o'lchamlari tekshiruviga qarshi (window.innerHeight === screen.height har doim true chiqishi uchun)
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
        'blur', 'focusout', 'visibilitychange', 'mouseleave', 'mouseout', 'resize',
        'contextmenu', 'copy', 'paste', 'cut', 'selectstart'
    ];

    blockedEvents.forEach(evt => {
        window.addEventListener(evt, stopEvent, true);
        document.addEventListener(evt, stopEvent, true);
    });

    window.addEventListener('keydown', (e) => {
        if (!isEnabled) return;

        if (e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
            e.stopImmediatePropagation(); e.preventDefault();
            captureAndSolve();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
            e.stopImmediatePropagation(); e.preventDefault();
            fetchAnswerNow();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
            e.stopImmediatePropagation(); e.preventDefault();
            toggleOverlay();
            return;
        }
        if (e.altKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
            e.stopImmediatePropagation(); e.preventDefault();
            closeAndCleanGemini();
            return;
        }

        const allowed = ['0','1','2','3','4','5','6','7','8','9','Enter','Backspace','Tab','Escape','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
        
        if (allowed.includes(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
            return; 
        }

        e.stopImmediatePropagation();
        e.preventDefault();
    }, true);

    window.addEventListener('keyup', stopEvent, true);
    window.addEventListener('keypress', stopEvent, true);
}

// ================= 3. CLOSED SHADOW DOM (DOM SKANERLARIDAN 100% YASHIRISH) =================
function getStealthRoot() {
    if (shadowRoot) return shadowRoot;

    stealthHost = document.createElement("div");
    stealthHost.style.cssText = "all: initial !important; position: static !important; display: contents !important;";
    
    // mode: 'closed' orqali sayt skriptlari (querySelectorAll, getElementById) uchun elementlar umuman mavjud emas
    shadowRoot = stealthHost.attachShadow({ mode: "closed" });
    
    (document.documentElement || document.body).appendChild(stealthHost);
    return shadowRoot;
}

function getOrCreateOverlay() {
    if (overlayEl) return overlayEl;
    const root = getStealthRoot();
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
        max-width: 280px;
        max-height: 80px;
        overflow: hidden;
        transition: opacity 0.3s;
    `;
    root.appendChild(overlayEl);
    return overlayEl;
}

// ================= 4. GHOST MODE (AVTOMATIK TOZALANISH - EKRAN YOZUVIGA QARSHI) =================
function displayAnswerWithAutoWipe(text) {
    const overlay = getOrCreateOverlay();
    overlay.innerText = text;
    overlay.style.display = isOverlayHidden ? "none" : "block";

    if (wipeTimer) clearTimeout(wipeTimer);
    // Javob tayyor bo'lgach (masalan "A" yoki "B"), 4 soniya ko'rinib, keyin o'z-o'zidan tozalanish
    if (text && text !== "..") {
        wipeTimer = setTimeout(() => {
            overlay.innerText = "";
        }, 4000); // 4 soniya yetarli
    }
}

function toggleOverlay() {
    isOverlayHidden = !isOverlayHidden;
    const el = getOrCreateOverlay();
    el.style.display = isOverlayHidden ? "none" : "block";
}

async function captureAndSolve() {
    if (!isEnabled) return;
    displayAnswerWithAutoWipe("..");
    
    chrome.runtime.sendMessage({ action: "capture" }, (response) => {
        if (response && response.answer) {
            displayAnswerWithAutoWipe(response.answer);
        }
    });
}

async function fetchAnswerNow() {
    if (!isEnabled) return;
    displayAnswerWithAutoWipe("..");

    chrome.runtime.sendMessage({ action: "fetch_latest_answer" }, (response) => {
        if (response && response.answer) {
            displayAnswerWithAutoWipe(response.answer);
        }
    });
}

function closeAndCleanGemini() {
    if (wipeTimer) clearTimeout(wipeTimer);
    const el = getOrCreateOverlay();
    el.innerText = "";
    chrome.runtime.sendMessage({ action: "cleanup_gemini" });
}

function createStealthControlBar() {
    if (controlBarEl) return;
    const root = getStealthRoot();

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

    // 1. Solve (Rasmga olib yechish - Alt + S)
    const btnSolve = createStealthBtn("·", () => {
        captureAndSolve();
    });

    // 2. Fetch (Javobni olish / Qayta tekshirish - Alt + A)
    const btnFetch = createStealthBtn("·", () => {
        fetchAnswerNow();
    });

    // 3. Toggle (Yashirish / Ko'rsatish - Alt + D)
    const btnToggle = createStealthBtn("·", () => {
        toggleOverlay();
    });

    // 4. Clean (Yopish va tozalash - Alt + X)
    const btnClean = createStealthBtn("·", () => {
        closeAndCleanGemini();
    });

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
