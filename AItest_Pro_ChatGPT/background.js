// Background Service Worker - AItest Pro V15 (ChatGPT Ultra Edition: Zero-Error + Bounds-Safe + Triple Upload + MAIN World Shield)

const PROMPT_TEXT = `Sen barcha aniq, tabiiy va gumanitar fanlar (matematika, algebra, geometriya, fizika, kimyo, biologiya, ingliz tili, ona tili, tarix, informatika, mantiq) bo'yicha oliy toifali ekspertisan.
Ushbu rasmda berilgan test savoli va uning shartini diqqat bilan o'qib, qadam-baqadam aniq tahlil qil va yech.

ENG MUHIM QAT'IY TALABLAR:
1. To'g'ri javob berilgan variantlar (A, B, C, D yoki E) ichida ANIQ MAVJUD! Agar chiqargan natijang variantlarga mos kelmasa, hisob-kitobni yoki qoidani darhol qayta tekshirib, variantlar ichidagi 100% to'g'ri javobni top.
2. Yechim oxirida, eng so'nggi alohida qatorda FAQAT quyidagi formatda yakuniy variant harfini yoz:
JAVOB: A

(Variant sifatida faqat bitta harf: A, B, C, D yoki E).
3. Ushbu so'nggi "JAVOB:" qatoridan keyin boshqa hech qanday izoh, nuqta yoki so'z yozma!`;

const CHATGPT_URL_PATTERNS = [
    "*://chatgpt.com/*",
    "*://*.chatgpt.com/*",
    "*://chat.openai.com/*"
];

// Saytning asosiy (MAIN) JS muhitiga CSP-ni aylanib o'tib himoya o'rnatish
function applyMainWorldShield() {
    try {
        if (window.__aitestMainShieldV15) return;
        window.__aitestMainShieldV15 = true;

        const originalToString = Function.prototype.toString;
        const mockedSet = new WeakSet();
        const makeNative = (fn, name = '') => {
            try {
                mockedSet.add(fn);
                Object.defineProperty(fn, 'name', { value: name, configurable: true });
            } catch(e) {}
            return fn;
        };

        try {
            Function.prototype.toString = makeNative(function() {
                if (mockedSet.has(this)) {
                    return `function ${this.name || ''}() { [native code] }`;
                }
                return originalToString.apply(this, arguments);
            }, 'toString');
        } catch(e) {}

        const getVis = makeNative(() => 'visible', 'get visibilityState');
        const getHidden = makeNative(() => false, 'get hidden');
        const hasFocusMock = makeNative(() => true, 'hasFocus');

        [document, Document.prototype].forEach(t => {
            if (!t) return;
            try { Object.defineProperty(t, 'visibilityState', { get: getVis, configurable: true }); } catch(e) {}
            try { Object.defineProperty(t, 'webkitVisibilityState', { get: getVis, configurable: true }); } catch(e) {}
            try { Object.defineProperty(t, 'hidden', { get: getHidden, configurable: true }); } catch(e) {}
            try { Object.defineProperty(t, 'webkitHidden', { get: getHidden, configurable: true }); } catch(e) {}
            try { t.hasFocus = hasFocusMock; } catch(e) {}
        });

        try { Object.defineProperty(document, 'onvisibilitychange', { get: () => null, set: () => {}, configurable: true }); } catch(e) {}
        try { Object.defineProperty(window, 'onblur', { get: () => null, set: () => {}, configurable: true }); } catch(e) {}
        try { Object.defineProperty(window, 'onfocusout', { get: () => null, set: () => {}, configurable: true }); } catch(e) {}

        const fakeReqFs = makeNative(function() {
            setTimeout(() => {
                try {
                    document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
                    window.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
                } catch(e) {}
            }, 10);
            return Promise.resolve();
        }, 'requestFullscreen');

        const fakeExitFs = makeNative(() => Promise.resolve(), 'exitFullscreen');

        [Element.prototype, HTMLElement.prototype, document.documentElement].forEach(t => {
            if (!t) return;
            ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'mozRequestFullScreen', 'msRequestFullscreen'].forEach(m => {
                try { Object.defineProperty(t, m, { value: fakeReqFs, writable: true, configurable: true }); } catch(e) {}
            });
        });

        [document, Document.prototype].forEach(t => {
            if (!t) return;
            ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen'].forEach(m => {
                try { Object.defineProperty(t, m, { value: fakeExitFs, writable: true, configurable: true }); } catch(e) {}
            });
            ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement', 'msFullscreenElement'].forEach(p => {
                try { Object.defineProperty(t, p, { get: makeNative(() => document.documentElement, `get ${p}`), configurable: true }); } catch(e) {}
            });
            ['fullscreen', 'webkitIsFullScreen', 'mozFullScreen'].forEach(p => {
                try { Object.defineProperty(t, p, { get: makeNative(() => true, `get ${p}`), configurable: true }); } catch(e) {}
            });
        });

        try {
            Object.defineProperty(screen, 'availHeight', { get: makeNative(() => window.innerHeight, 'availHeight'), configurable: true });
            Object.defineProperty(screen, 'height', { get: makeNative(() => window.innerHeight, 'height'), configurable: true });
            Object.defineProperty(screen, 'availWidth', { get: makeNative(() => window.innerWidth, 'availWidth'), configurable: true });
            Object.defineProperty(screen, 'width', { get: makeNative(() => window.innerWidth, 'width'), configurable: true });
        } catch(e) {}

        const blockEvt = makeNative((e) => {
            e.stopImmediatePropagation();
        }, 'listener');

        ['blur', 'focusout', 'visibilitychange', 'webkitvisibilitychange', 'mouseleave', 'mouseout', 'contextmenu', 'copy', 'cut', 'selectstart'].forEach(evt => {
            window.addEventListener(evt, blockEvt, true);
            document.addEventListener(evt, blockEvt, true);
        });
    } catch(e) {}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "inject_main_shield") {
        if (sender.tab && sender.tab.id) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, allFrames: true },
                world: "MAIN",
                func: applyMainWorldShield,
                injectImmediately: true
            }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
    }

    if (request.action === "cleanup_gemini" || request.action === "cleanup_chatgpt") {
        chrome.tabs.query({ url: CHATGPT_URL_PATTERNS }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const winIds = new Set(tabs.map(t => t.windowId).filter(Boolean));
                winIds.forEach(wId => {
                    try { chrome.windows.remove(wId, () => { void chrome.runtime.lastError; }); } catch(e) {}
                });
                const tabIds = tabs.map(t => t.id).filter(Boolean);
                if (tabIds.length) {
                    try { chrome.tabs.remove(tabIds, () => { void chrome.runtime.lastError; }); } catch(e) {}
                }
            }
        });

        if (chrome.history) {
            ["chatgpt", "openai"].forEach(keyword => {
                chrome.history.search({ text: keyword, startTime: 0, maxResults: 1000 }, (items) => {
                    if (items && items.length > 0) {
                        items.forEach(item => {
                            if (item.url && (item.url.includes("chatgpt.com") || item.url.includes("openai.com"))) {
                                chrome.history.deleteUrl({ url: item.url });
                            }
                        });
                    }
                });
            });
        }

        sendResponse({ success: true });
        return true;
    }

    if (request.action === "fetch_latest_answer") {
        (async () => {
            try {
                const answer = await getLatestAnswerFromChatGPT();
                sendResponse({ answer: answer || "-" });
            } catch (error) {
                sendResponse({ answer: "-" });
            }
        })();
        return true;
    }

    if (request.action !== "capture") return false;

    (async () => {
        try {
            const currentWinId = sender.tab ? sender.tab.windowId : null;
            const senderTabId = sender.tab ? sender.tab.id : null;

            const dataUrl = await captureScreenSafely(currentWinId);
            if (!dataUrl) {
                sendResponse({ answer: "-" });
                return;
            }

            let answer = await askChatGPTWeb(dataUrl, currentWinId);
            // Agar birinchi urinishda javob chiqmasa, avtomatik qayta o'qib ko'ramiz
            if (!answer || answer === "-") {
                await new Promise(r => setTimeout(r, 1200));
                answer = (await getLatestAnswerFromChatGPT()) || "-";
            }

            if (senderTabId) {
                try {
                    chrome.tabs.sendMessage(senderTabId, { action: "show_answer", answer }, () => {
                        void chrome.runtime.lastError;
                    });
                } catch(e) {}
            }
            sendResponse({ answer });
        } catch (error) {
            sendResponse({ answer: "-" });
        }
    })();

    return true;
});

async function captureScreenSafely(windowId) {
    const tryCapture = (winId) => new Promise((resolve) => {
        try {
            chrome.tabs.captureVisibleTab(winId, { format: "png" }, (url) => {
                if (chrome.runtime.lastError || !url) {
                    resolve(null);
                } else {
                    resolve(url);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });

    let url = await tryCapture(windowId);
    if (!url) {
        url = await tryCapture(null);
    }
    return url;
}

// ================= FAQAT HARFNI AJRATIB OLISH (SMART PARSER) =================
function extractCleanAnswer(rawText) {
    if (!rawText) return "-";

    const clean = rawText.replace(/[*_`#]/g, "").trim();
    if (!clean) return "-";

    // 1. ENG OXIRGI "JAVOB: [variant]" ni topish
    const allStrictMatches = [...clean.matchAll(/(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*([A-FА-Я0-9\-\+\.\,\?]+(?:\s*\([A-F]\))?)/gi)];
    if (allStrictMatches.length > 0) {
        const lastMatch = allStrictMatches[allStrictMatches.length - 1];
        const ans = lastMatch[1].trim();
        const letterOnly = ans.match(/^([A-FА-Яa-fа-я]\??)/);
        if (letterOnly) return normalizeLetter(letterOnly[1]);
        return ans.slice(0, 5).trim();
    }

    // 2. Muqobil iboralar
    const allAltMatches = [...clean.matchAll(/(?:to['‘`]?g['‘`]?ri\s+javob|правильный\s+ответ|correct\s+answer|variant|to['‘`]?g['‘`]?ri\s+variant)\s*[:=\-—]?\s*(?:variant\s*)?([A-FА-Яa-fа-я0-9\?]+)/gi)];
    if (allAltMatches.length > 0) {
        const lastAlt = allAltMatches[allAltMatches.length - 1];
        return normalizeLetter(lastAlt[1]);
    }

    // 3. Oxirgi satrlardan tekshirish
    const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
        const line = lines[i];

        const lineMatch = line.match(/(?:javob|answer|ответ|variant)?\s*[:=\-—]?\s*\b([A-EА-Дa-eа-д]\??)\b/i);
        if (lineMatch && lineMatch[1]) {
            return normalizeLetter(lineMatch[1]);
        }

        const singleLetter = line.match(/^([A-EА-Дa-eа-д]\??)(?:\)|\.)?$/i);
        if (singleLetter) {
            return normalizeLetter(singleLetter[1]);
        }
    }

    // 4. Matndagi oxirgi alohida A-D harfi
    const allLetters = [...clean.matchAll(/\b([A-D]\??)\b/g)];
    if (allLetters.length > 0) {
        return allLetters[allLetters.length - 1][1].toUpperCase();
    }

    return "-";
}

function normalizeLetter(ch) {
    if (!ch) return "-";
    let upper = ch.toUpperCase();
    if (upper.startsWith("А")) return "A" + upper.slice(1);
    if (upper.startsWith("В")) return "B" + upper.slice(1);
    if (upper.startsWith("С")) return "C" + upper.slice(1);
    if (upper.startsWith("Д")) return "D" + upper.slice(1);
    if (upper.startsWith("Е")) return "E" + upper.slice(1);
    return upper;
}

async function getLatestAnswerFromChatGPT() {
    const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS });
    if (!tabs || tabs.length === 0) return null;
    const tab = tabs[0];

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
                window.dispatchEvent(new Event('focus'));
                document.dispatchEvent(new Event('visibilitychange'));
            } catch(e) {}

            const selector = '[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"] .markdown, .agent-turn';
            const responses = [...document.querySelectorAll(selector)]
                .filter(el => !el.hasAttribute("data-aitest-old"));

            const targetResponses = responses.length > 0 ? responses :
                [...document.querySelectorAll(selector)];

            if (!targetResponses.length) return null;
            const latest = targetResponses[targetResponses.length - 1];
            return (latest.innerText || latest.textContent || "").trim();
        }
    }).catch(() => null);

    const rawText = results?.[0]?.result;
    if (!rawText) return null;
    return extractCleanAnswer(rawText);
}

// Har qanday ekran o'lchami (Mac/Windows/Fullscreen) uchun 100% xatoliksiz oyna yaratish
async function createSafeAIWindow(targetUrl, currentWindowId) {
    const w = 420;
    const h = 420;

    // 1-urinish: Joriy oyna o'lchamiga moslab o'ng-pastki burchakda ochish
    if (currentWindowId) {
        try {
            const curWin = await chrome.windows.get(currentWindowId);
            if (curWin && curWin.state !== "fullscreen" && curWin.state !== "minimized" &&
                typeof curWin.left === "number" && typeof curWin.top === "number" &&
                typeof curWin.width === "number" && typeof curWin.height === "number") {
                const safeLeft = Math.max(20, curWin.left + curWin.width - w - 30);
                const safeTop = Math.max(20, curWin.top + curWin.height - h - 50);
                const win = await chrome.windows.create({
                    url: targetUrl,
                    focused: false,
                    type: "normal",
                    width: w,
                    height: h,
                    left: safeLeft,
                    top: safeTop
                });
                if (win) return win;
            }
        } catch (e) {}
    }

    // 2-urinish: Koordinatalarsiz (left/top berilmasa Chrome o'zi ekran ichiga sig'dirib joylaydi — Bounds xatosi hech qachon chiqmaydi!)
    try {
        const win = await chrome.windows.create({
            url: targetUrl,
            focused: false,
            type: "normal",
            width: w,
            height: h
        });
        if (win) return win;
    } catch (e) {}

    // 3-urinish: Oddiy fokuslanmagan oyna (hatto width/height cheklovi bo'lsa ham)
    try {
        const win = await chrome.windows.create({
            url: targetUrl,
            focused: false
        });
        if (win) return win;
    } catch (e) {}

    // 4-urinish: Agar OS oynaga ruxsat bermasa (masalan Fullscreen kiosk), fon tab sifatida ochish
    const fallbackTab = await chrome.tabs.create({
        url: targetUrl,
        active: false
    });
    return { id: fallbackTab.windowId, tabs: [fallbackTab] };
}

async function getOrCreateChatGPTTab(currentWindowId) {
    const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS });

    if (tabs.length) {
        for (const tab of tabs) {
            if (tab.discarded) {
                try { await chrome.tabs.remove(tab.id); } catch(e) {}
                continue;
            }
            return tab;
        }
    }

    await new Promise(resolve => setTimeout(resolve, 600));

    const win = await createSafeAIWindow("https://chatgpt.com/", currentWindowId);

    if (currentWindowId) {
        try {
            await chrome.windows.update(currentWindowId, { focused: true });
        } catch(e) {}
    }

    const chatgptTab = (win.tabs && win.tabs[0]) ? win.tabs[0] : (await chrome.tabs.query({ windowId: win.id }))[0];

    await new Promise((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (isResolved) return;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 40000);

        function listener(tabId, info) {
            if (chatgptTab && tabId === chatgptTab.id && info.status === "complete") {
                isResolved = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });

    await new Promise(resolve => setTimeout(resolve, 2200));
    return chatgptTab;
}

// Orqa fonda muzlashdan saqlash (Unfreezer & Keep-Alive)
function unfreezeBackgroundTab() {
    try {
        try { Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true }); } catch(e) {}
        try { Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true }); } catch(e) {}
        try { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); } catch(e) {}
        try { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); } catch(e) {}
        try { Document.prototype.hasFocus = () => true; } catch(e) {}
        try { document.hasFocus = () => true; } catch(e) {}

        window.requestAnimationFrame = function(callback) {
            return setTimeout(() => callback(performance.now()), 16);
        };
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };

        try {
            if (!window._aitestAudioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    gain.gain.value = 0;
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    window._aitestAudioCtx = ctx;
                }
            }
        } catch(e) {}

        if (!window._aitestKeepAlive) {
            window._aitestKeepAlive = setInterval(() => {
                try {
                    window.dispatchEvent(new Event('focus'));
                    document.dispatchEvent(new Event('visibilitychange'));
                } catch(e) {}
            }, 500);
        }

        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
    } catch(e) {}
}

async function askChatGPTWeb(dataUrl, currentWinId) {
    const tab = await getOrCreateChatGPTTab(currentWinId);
    if (!tab || !tab.id) return "-";

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: unfreezeBackgroundTab
        });
    } catch(e) {}

    if (tab && tab.windowId && currentWinId && tab.windowId !== currentWinId) {
        try {
            await chrome.windows.update(tab.windowId, { focused: true });
        } catch(e) {}

        setTimeout(() => {
            try { chrome.windows.update(currentWinId, { focused: true }); } catch(e) {}
        }, 250);

        setTimeout(() => {
            try { chrome.windows.update(currentWinId, { focused: true }); } catch(e) {}
        }, 700);
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: attachImageAndAskChatGPT,
        args: [dataUrl, PROMPT_TEXT]
    }).catch(() => null);

    let answer = results?.[0]?.result;

    try {
        await new Promise(r => setTimeout(r, 600));
        const verifiedAnswer = await getLatestAnswerFromChatGPT();
        if (verifiedAnswer && verifiedAnswer !== "-") {
            answer = verifiedAnswer;
        }
    } catch(e) {}

    return answer || "-";
}

// ChatGPT sahifasida bajariladigan asosiy funksiya (3 bosqichli rasm yuklash + ProseMirror/Textarea + Auto-Retry Send)
async function attachImageAndAskChatGPT(dataUrl, prompt) {
    try {
        try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.hasFocus = () => true;
        } catch(e) {}

        // 1. Eski javoblarni tamg'alab chiqish
        const assistantSelector = '[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"] .markdown, .agent-turn';
        document.querySelectorAll(assistantSelector).forEach(el => el.setAttribute("data-aitest-old", "true"));

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "screen.png", { type: "image/png" });

        // 0. Xush kelibsiz / modal dialoglarni va eski biriktirilgan fayllarni tozalash
        try {
            const dismissBtns = [...document.querySelectorAll('[role="dialog"] button, button')].filter(btn => {
                const t = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + btn.innerText).toLowerCase();
                return /stay logged out|maybe later|got it|dismiss|close modal|not now|continue/i.test(t);
            });
            dismissBtns.forEach(b => b.click());

            const removeAttached = document.querySelectorAll(
                'form button[aria-label*="Remove" i], form button[aria-label*="Delete" i], form button[aria-label*="O‘chirish" i], form button[aria-label*="Удалить" i]'
            );
            removeAttached.forEach(btn => btn.click());
        } catch(e) {}

        // 1. Chat maydoni (#prompt-textarea) to'liq yuklanguncha kutamiz:
        let inputField = null;
        for (let i = 0; i < 40; i++) {
            inputField = document.querySelector('#prompt-textarea') ||
                         document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
                         document.querySelector('form div[contenteditable="true"]') ||
                         document.querySelector('div[contenteditable="true"]') ||
                         document.querySelector('[role="textbox"]') ||
                         document.querySelector('textarea');
            if (inputField) break;
            await new Promise(r => setTimeout(r, 350));
        }

        if (!inputField) return "-";

        const inputContainer = inputField.closest('form') || inputField.closest('main') || document.body;

        function hasAttachmentPreview() {
            return !!inputContainer.querySelector(
                'img, [style*="background-image"], [data-testid*="attachment"], [class*="attachment"], button[aria-label*="Remove" i], button[aria-label*="Delete" i], button[aria-label*="O‘chirish" i], button[aria-label*="Удалить" i], [role="progressbar"], svg.animate-spin'
            );
        }

        const transfer = new DataTransfer();
        transfer.items.add(file);

        // 2-A USUL: To'g'ridan-to'g'ri #prompt-textarea ga Clipboard Paste hodisasi (ChatGPT ProseMirror uchun eng ishonchli usul)
        try {
            inputField.focus();
            const pasteEvt = new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: transfer
            });
            inputField.dispatchEvent(pasteEvt);
        } catch(e) {}

        await new Promise(r => setTimeout(r, 500));

        // 2-B USUL: Agar Paste orqali rasm chiqmagan bo'lsa, input[type="file"] orqali biriktirish
        if (!hasAttachmentPreview()) {
            let fileInputs = [...document.querySelectorAll('input[type="file"]')];
            if (fileInputs.length === 0) {
                const buttons = [...inputContainer.querySelectorAll("button")];
                const uploadBtn = buttons.find(btn => {
                    const label = [
                        btn.getAttribute("aria-label"),
                        btn.getAttribute("data-testid"),
                        btn.getAttribute("title"),
                        btn.innerText
                    ].filter(Boolean).join(" ").toLowerCase();
                    return /attach|upload|plus|add files|fayl|rasm/i.test(label) && !/send|voice|stop/i.test(label);
                });
                if (uploadBtn) {
                    uploadBtn.click();
                    await new Promise(r => setTimeout(r, 350));
                    fileInputs = [...document.querySelectorAll('input[type="file"]')];
                }
            }

            if (fileInputs.length > 0) {
                const imageInput = fileInputs.find(el => (el.accept || "").includes("image")) || fileInputs[fileInputs.length - 1];
                try {
                    imageInput.disabled = false;
                    imageInput.value = "";
                    const nativeFilesSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
                    if (nativeFilesSetter) {
                        nativeFilesSetter.call(imageInput, transfer.files);
                    } else {
                        imageInput.files = transfer.files;
                    }
                    imageInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
                    imageInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
                } catch(e) {}
            }
            await new Promise(r => setTimeout(r, 500));
        }

        // 2-C USUL: Agar hali ham rasm ko'rinmasa, Drag & Drop hodisasini yuborish
        if (!hasAttachmentPreview()) {
            try {
                ["dragenter", "dragover", "drop"].forEach(type => {
                    const dragEvt = new DragEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        dataTransfer: transfer
                    });
                    inputField.dispatchEvent(dragEvt);
                });
            } catch(e) {}
            await new Promise(r => setTimeout(r, 400));
        }

        // 3. Promptni kiritish va fokuslash
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new FocusEvent('focus'));
        inputField.focus();
        inputField.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

        if (inputField.tagName === "TEXTAREA") {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            if (nativeSetter) {
                nativeSetter.call(inputField, prompt);
            } else {
                inputField.value = prompt;
            }
            inputField.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            try {
                document.execCommand("selectAll", false, null);
                document.execCommand("insertText", false, prompt);
            } catch(e) {}

            if (!inputField.textContent || !inputField.textContent.includes("JAVOB:")) {
                inputField.innerHTML = "";
                const p = document.createElement("p");
                p.textContent = prompt;
                inputField.appendChild(p);
                inputField.dispatchEvent(new InputEvent("input", {
                    bubbles: true,
                    composed: true,
                    inputType: "insertText",
                    data: prompt
                }));
            }
        }

        // 4. Rasm serverga to'liq yuklanib, Send tugmasi aktiv bo'lishini kutish
        await new Promise(r => setTimeout(r, 700));

        let sendButton = null;
        for (let i = 0; i < 75; i++) { // ~22.5 soniya
            await new Promise(resolve => setTimeout(resolve, 300));

            const isUploading = !!inputContainer.querySelector('[role="progressbar"], svg.animate-spin, [class*="animate-spin"]');

            const btn = document.querySelector('button[data-testid="send-button"]') ||
                        inputContainer.querySelector('button[type="submit"]') ||
                        [...inputContainer.querySelectorAll("button")].find(button => {
                            const label = [
                                button.getAttribute("aria-label"),
                                button.getAttribute("data-testid"),
                                button.getAttribute("title"),
                                button.innerText
                            ].filter(Boolean).join(" ").toLowerCase();

                            if (/stop|voice|ovoz|attach|plus|remove|delete|close/i.test(label)) {
                                return false;
                            }
                            return /send|yuborish|отправить|submit/i.test(label);
                        });

            if (!isUploading && btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                sendButton = btn;
                break;
            }
        }

        // 5. Yuborish tugmasini bosish (va yuborilganini tasdiqlash)
        const triggerSend = () => {
            if (sendButton && !sendButton.disabled) {
                sendButton.click();
            } else {
                const fallbackBtn = document.querySelector('button[data-testid="send-button"]');
                if (fallbackBtn && !fallbackBtn.disabled) {
                    fallbackBtn.click();
                } else {
                    inputField.dispatchEvent(new KeyboardEvent("keydown", {
                        key: "Enter",
                        code: "Enter",
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }));
                }
            }
        };

        triggerSend();
        await new Promise(r => setTimeout(r, 600));

        // Agar hali ham matn inputda turgan bo'lsa va stop-button chiqmagan bo'lsa, qayta bosamiz
        if (inputField.textContent && inputField.textContent.includes("JAVOB:") && !document.querySelector('button[data-testid="stop-button"]')) {
            triggerSend();
        }

        function extractCleanAnswer(rawText) {
            if (!rawText) return "-";
            const clean = rawText.replace(/[*_`#]/g, "").trim();
            if (!clean) return "-";

            const allStrictMatches = [...clean.matchAll(/(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*([A-FА-Я0-9\-\+\.\,\?]+(?:\s*\([A-F]\))?)/gi)];
            if (allStrictMatches.length > 0) {
                const lastMatch = allStrictMatches[allStrictMatches.length - 1];
                const ans = lastMatch[1].trim();
                const letterOnly = ans.match(/^([A-FА-Яa-fа-я]\??)/);
                if (letterOnly) return normalizeLetter(letterOnly[1]);
                return ans.slice(0, 5).trim();
            }

            const allAltMatches = [...clean.matchAll(/(?:to['‘`]?g['‘`]?ri\s+javob|правильный\s+ответ|correct\s+answer|variant|to['‘`]?g['‘`]?ri\s+variant)\s*[:=\-—]?\s*(?:variant\s*)?([A-FА-Яa-fа-я0-9\?]+)/gi)];
            if (allAltMatches.length > 0) {
                const lastAlt = allAltMatches[allAltMatches.length - 1];
                return normalizeLetter(lastAlt[1]);
            }

            const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
            for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
                const line = lines[i];
                const lineMatch = line.match(/(?:javob|answer|ответ|variant)?\s*[:=\-—]?\s*\b([A-EА-Дa-eа-д]\??)\b/i);
                if (lineMatch && lineMatch[1]) return normalizeLetter(lineMatch[1]);

                const singleLetter = line.match(/^([A-EА-Дa-eа-д]\??)(?:\)|\.)?$/i);
                if (singleLetter) return normalizeLetter(singleLetter[1]);
            }

            const allLetters = [...clean.matchAll(/\b([A-D]\??)\b/g)];
            if (allLetters.length > 0) {
                return allLetters[allLetters.length - 1][1].toUpperCase();
            }

            return "-";
        }

        function normalizeLetter(ch) {
            if (!ch) return "-";
            let upper = ch.toUpperCase();
            if (upper.startsWith("А")) return "A" + upper.slice(1);
            if (upper.startsWith("В")) return "B" + upper.slice(1);
            if (upper.startsWith("С")) return "C" + upper.slice(1);
            if (upper.startsWith("Д")) return "D" + upper.slice(1);
            if (upper.startsWith("Е")) return "E" + upper.slice(1);
            return upper;
        }

        // 6. Yangi javobni kutish (Sekin internet uchun 54 soniyagacha)
        return await new Promise(resolve => {
            let attempts = 0;
            let previousText = "";
            let stable = 0;

            const timer = setInterval(() => {
                attempts++;

                try {
                    window.dispatchEvent(new Event('focus'));
                    document.dispatchEvent(new Event('visibilitychange'));
                } catch(e) {}

                const newAssistantNodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')]
                    .filter(el => !el.hasAttribute("data-aitest-old"));

                const newResponses = newAssistantNodes.length > 0 ? newAssistantNodes :
                    [...document.querySelectorAll('article[data-testid^="conversation-turn-"] .markdown, .agent-turn')]
                        .filter(el => !el.hasAttribute("data-aitest-old"));

                if (newResponses.length > 0) {
                    const latestNewResponse = newResponses[newResponses.length - 1];
                    const text = (latestNewResponse.innerText || latestNewResponse.textContent || "").trim();

                    const hasAnswerTag = /(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*[A-FА-Я]/i.test(text);

                    const isStillGenerating = !!document.querySelector(
                        'button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="To‘xtat" i], button[aria-label*="Остановить" i], .result-streaming'
                    );

                    const turnContainer = latestNewResponse.closest('article') || latestNewResponse.parentElement;
                    const hasActionButtons = !!turnContainer?.querySelector(
                        'button[data-testid="copy-turn-action-button"], button[aria-label*="Copy" i], button[aria-label*="Nusxa" i], button[aria-label*="Копировать" i]'
                    );

                    if (text && text === previousText) {
                        stable++;
                    } else {
                        previousText = text;
                        stable = 0;
                    }

                    if (hasAnswerTag && ((!isStillGenerating && stable >= 4) || hasActionButtons || stable >= 7)) {
                        clearInterval(timer);
                        resolve(extractCleanAnswer(text));
                        return;
                    }

                    if (!isStillGenerating && (hasActionButtons || stable >= 8) && text.length > 15) {
                        clearInterval(timer);
                        resolve(extractCleanAnswer(text));
                        return;
                    }
                }

                if (attempts >= 135) {
                    clearInterval(timer);
                    resolve(previousText ? extractCleanAnswer(previousText) : "-");
                }
            }, 400);
        });
    } catch (error) {
        return "-";
    }
}
