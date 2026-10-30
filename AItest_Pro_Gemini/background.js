// Background Service Worker - AItest Pro V17 (Gemini Silent Background Tab + Precision Answer Extractor)

const PROMPT_TEXT = `Sen barcha fanlar (matematika, algebra, geometriya, fizika, kimyo, biologiya, tarix, geografiya, ingliz tili, ona tili, informatika, huquq, mantiq) bo'yicha oliy toifali ekspertisan. Rasmda berilgan savolni, barcha shartlarni va variantlarni diqqat bilan o'qib, aniq tahlil qil. QAT'IY QOIDALAR: 1) Rasmda berilgan variantlar orasidan 100% to'g'risini top (agar variantlarda A, B, C, D harflari yozilmagan bo'lsa, ularni tepadan pastga yoki chapdan o'ngga A, B, C, D deb hisobla). 2) Yechimning eng oxirgi qatorida FAQAT quyidagi qat'iy formatda to'g'ri variant harfi va qisqa javob qiymatini yoz: JAVOB: B) to'g'ri javob matni`;

// Saytning asosiy (MAIN) JS muhitiga CSP-ni aylanib o'tib himoya o'rnatish
function applyMainWorldShield() {
    try {
        if (window.__aitestMainShieldV17) return;
        window.__aitestMainShieldV17 = true;

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

    if (request.action === "cleanup_gemini") {
        chrome.tabs.query({ url: "*://gemini.google.com/*" }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const tabIds = tabs.map(t => t.id).filter(Boolean);
                if (tabIds.length) {
                    try { chrome.tabs.remove(tabIds, () => { void chrome.runtime.lastError; }); } catch(e) {}
                }
            }
        });

        if (chrome.history) {
            chrome.history.search({ text: "gemini", startTime: 0, maxResults: 1000 }, (items) => {
                if (items && items.length > 0) {
                    items.forEach(item => {
                        if (item.url && item.url.includes("gemini.google.com")) {
                            chrome.history.deleteUrl({ url: item.url });
                        }
                    });
                }
            });
        }

        sendResponse({ success: true });
        return true;
    }

    if (request.action === "fetch_latest_answer") {
        (async () => {
            try {
                const answer = await getLatestAnswerFromGemini();
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

            let answer = await askGeminiWeb(dataUrl, currentWinId);
            if (!answer || answer === "-") {
                await new Promise(r => setTimeout(r, 1200));
                answer = (await getLatestAnswerFromGemini()) || "-";
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

// ================= YUQORI ANIQLIKDAGI JAVOB AJRATIB OLUVCHI (PRECISION PARSER V17) =================
function extractCleanAnswer(rawText) {
    if (!rawText) return "-";

    const clean = rawText
        .replace(/\r/g, "")
        .replace(/[*_`~#]/g, "")
        .trim();
    if (!clean) return "-";

    function normLetter(ch) {
        if (!ch) return "";
        const map = { "А": "A", "Б": "B", "В": "B", "С": "C", "Д": "D", "Е": "E" };
        const u = ch.toUpperCase();
        return map[u] || u;
    }

    function formatResult(letter, restText) {
        const L = normLetter(letter);
        if (!restText) return L;
        const cleanedRest = restText
            .replace(/^[\s\)\]\.\:\-\—\=]+/, "")
            .replace(/[\.\s]+$/, "")
            .replace(/\s+/g, " ")
            .trim();
        if (!cleanedRest || cleanedRest.toUpperCase() === L || /^(variant|javob|answer|ответ)$/i.test(cleanedRest)) {
            return L;
        }
        return `${L}) ${cleanedRest.slice(0, 34)}`;
    }

    const strictRegex = /(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|CORRECT\s+ANSWER|ОТВЕТ|ПРАВИЛЬНЫЙ\s+ОТВЕТ)\s*[:=\-—]+\s*([^\n]+)/gi;
    const strictMatches = [...clean.matchAll(strictRegex)];
    if (strictMatches.length > 0) {
        const lastLine = strictMatches[strictMatches.length - 1][1].trim();

        const startLetter = lastLine.match(/^[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+|\s+[\-\—\)]*\s*|$)(.*)$/i);
        if (startLetter) {
            return formatResult(startLetter[1], (startLetter[2] || "").trim());
        }

        const varMatch = lastLine.match(/(?:variant\s*([A-EАБВГДЕС])\b|\b([A-EАБВГДЕС])\s*[\-\—]?\s*variant)(?:[\s\:\-\—\)]+(.*))?/i);
        if (varMatch) {
            return formatResult(varMatch[1] || varMatch[2], varMatch[3] || "");
        }

        const endParen = lastLine.match(/^(.*?)\s*[\(\[]([A-EАБВГДЕС])[\)\]]\s*\.?$/i);
        if (endParen) {
            return formatResult(endParen[2], endParen[1]);
        }

        if (lastLine.length > 0) {
            return lastLine.slice(0, 36);
        }
    }

    const altRegex = /(?:to['‘`]?g['‘`]?ri\s+javob|to['‘`]?g['‘`]?ri\s+variant|правильный\s+ответ|correct\s+answer(?:\s+is)?)(?:\s*[:=\-—]+|\s+bu\s+|\s+)[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+\s*([^\n\.]+)|\s+variant|\b)/gi;
    const altMatches = [...clean.matchAll(altRegex)];
    if (altMatches.length > 0) {
        const lastAlt = altMatches[altMatches.length - 1];
        return formatResult(lastAlt[1], lastAlt[2] || "");
    }

    const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
        const line = lines[i];

        const solo = line.match(/^[\[\(]?([A-EАБВГДЕС])[\]\)\.]?$/i);
        if (solo) {
            return normLetter(solo[1]);
        }

        const optLine = line.match(/^[\[\(]?([A-EАБВГДЕС])[\]\)\.]\s+(.+)$/i);
        if (optLine && i === lines.length - 1) {
            return formatResult(optLine[1], optLine[2]);
        }

        const inLine = line.match(/\b([A-EАБВГДЕС])\s*[\-\—]?\s*variant\s+to['‘`]?g['‘`]?ri/i);
        if (inLine) {
            return normLetter(inLine[1]);
        }
    }

    const lastFew = lines.slice(-3).join(" ");
    const capMatches = [...lastFew.matchAll(/(?:^|[\s\(\[])([A-DАБВГДС])(?:[\)\]\.]|\s+variant)/g)];
    if (capMatches.length > 0) {
        return normLetter(capMatches[capMatches.length - 1][1]);
    }

    return lines.length > 0 ? lines[lines.length - 1].slice(0, 34) : "-";
}

async function getLatestAnswerFromGemini() {
    const tabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
    if (!tabs || tabs.length === 0) return null;
    const tab = tabs[0];

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
                window.dispatchEvent(new Event('focus'));
                document.dispatchEvent(new Event('visibilitychange'));
            } catch(e) {}

            const responses = [...document.querySelectorAll("model-response, message-content, .model-response-text")]
                .filter(el => !el.hasAttribute("data-aitest-old"));

            const targetResponses = responses.length > 0 ? responses :
                [...document.querySelectorAll("model-response, message-content, .model-response-text")];

            if (!targetResponses.length) return null;
            const latest = targetResponses[targetResponses.length - 1];
            return (latest.textContent || latest.innerText || "").trim();
        }
    }).catch(() => null);

    const rawText = results?.[0]?.result;
    if (!rawText) return null;
    return extractCleanAnswer(rawText);
}

// YANGI OYNA EMAS, HECH QACHON FOKUSNI O'ZGARTIRMAYDIGAN ORQA FON TABI (active: false) OCHISH!
async function getOrCreateGeminiTab(currentWindowId) {
    const tabs = await chrome.tabs.query({
        url: "*://gemini.google.com/*"
    });

    if (tabs.length) {
        for (const tab of tabs) {
            if (tab.discarded) {
                try { await chrome.tabs.remove(tab.id); } catch(e) {}
                continue;
            }
            return tab;
        }
    }

    const createProps = {
        url: "https://gemini.google.com/app",
        active: false
    };
    if (currentWindowId) {
        createProps.windowId = currentWindowId;
    }

    let geminiTab = null;
    try {
        geminiTab = await chrome.tabs.create(createProps);
    } catch (e) {
        geminiTab = await chrome.tabs.create({
            url: "https://gemini.google.com/app",
            active: false
        });
    }

    await new Promise((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (isResolved) return;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 40000);

        function listener(tabId, info) {
            if (geminiTab && tabId === geminiTab.id && info.status === "complete") {
                isResolved = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    return geminiTab;
}

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
            }, 400);
        }

        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
    } catch(e) {}
}

async function askGeminiWeb(dataUrl, currentWinId) {
    const tab = await getOrCreateGeminiTab(currentWinId);
    if (!tab || !tab.id) return "-";

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: unfreezeBackgroundTab
        });
    } catch(e) {}

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: attachImageAndAsk,
        args: [dataUrl, PROMPT_TEXT]
    }).catch(() => null);

    let answer = results?.[0]?.result;

    try {
        await new Promise(r => setTimeout(r, 500));
        const verifiedAnswer = await getLatestAnswerFromGemini();
        if (verifiedAnswer && verifiedAnswer !== "-") {
            answer = verifiedAnswer;
        }
    } catch(e) {}

    return answer || "-";
}

async function attachImageAndAsk(dataUrl, prompt) {
    try {
        try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.hasFocus = () => true;
        } catch(e) {}

        document.querySelectorAll("model-response, message-content, .model-response-text")
            .forEach(el => el.setAttribute("data-aitest-old", "true"));

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "screen.png", {
            type: "image/png"
        });

        try {
            const closeButtons = [...document.querySelectorAll('button')].filter(btn => {
                const t = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.textContent || '')).toLowerCase();
                return /got it|tushundim|boshlash|dismiss|close|yopish|davom etish|continue/i.test(t);
            });
            closeButtons.forEach(b => b.click());

            const removeChips = document.querySelectorAll('button[aria-label*="remove" i], button[aria-label*="o‘chirish" i], button[aria-label*="delete" i], .delete-button, button[aria-label*="clear" i]');
            removeChips.forEach(btn => btn.click());
        } catch(e) {}

        let inputField = null;
        for (let i = 0; i < 35; i++) {
            try {
                const dismissBtn = document.querySelector('button[aria-label*="close" i], button[aria-label*="yopish" i], .mat-dialog-actions button');
                if (dismissBtn) dismissBtn.click();
            } catch(e) {}

            inputField = document.querySelector('rich-textarea [contenteditable="true"]') ||
                         document.querySelector('div[contenteditable="true"]') ||
                         document.querySelector('[role="textbox"]') ||
                         document.querySelector("textarea");
            if (inputField) break;
            await new Promise(r => setTimeout(r, 400));
        }

        if (!inputField) return "-";

        let fileInput = null;
        const promptBox = inputField.closest('.input-area-container, .bottom-container, .chat-window, .input-area, main') || document.body;
        const inputContainer = promptBox;

        for (let attempt = 0; attempt < 20; attempt++) {
            fileInput = document.querySelector('input[type="file"]');
            if (fileInput) break;

            if (attempt === 0 || attempt === 4) {
                const buttons = [...promptBox.querySelectorAll("button")];
                const uploadButton = buttons.find(btn => {
                    const label = [
                        btn.getAttribute("aria-label"),
                        btn.getAttribute("data-tooltip"),
                        btn.getAttribute("title"),
                        btn.textContent
                    ].filter(Boolean).join(" ").toLowerCase();

                    if (/feedback|fikr|отзыв|send|yuborish|отправить|mic|ovoz|микрофон|more options|boshqa/i.test(label)) {
                        return false;
                    }

                    const iconTxt = (btn.querySelector('mat-icon')?.textContent || '').trim().toLowerCase();

                    return /attach|upload|file|fayl|biriktir|rasm|add|qo[‘'`]?sh|plus/i.test(label) ||
                           (iconTxt === 'add' || iconTxt === 'attach_file' || iconTxt === 'upload');
                });

                if (uploadButton) {
                    uploadButton.click();
                }
            }

            const menuItems = [...document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, .mat-menu-item, mat-list-item')];
            if (menuItems.length > 0) {
                const computerUploadItem = menuItems.find(item => {
                    const txt = ((item.getAttribute("aria-label") || "") + " " + (item.textContent || "")).toLowerCase();
                    return /kompyuter|computer|yuklash|upload|fayl|file|rasm|image/i.test(txt);
                });

                if (computerUploadItem) {
                    computerUploadItem.click();
                }
            }

            await new Promise(r => setTimeout(r, 300));
        }

        const transfer = new DataTransfer();
        transfer.items.add(file);

        if (fileInput) {
            try {
                fileInput.disabled = false;
                fileInput.value = "";
                fileInput.files = transfer.files;
                fileInput.dispatchEvent(new Event("input", { bubbles: true }));
                fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            } catch(e) {}
        } else {
            try {
                inputField.focus();
                inputField.dispatchEvent(new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer
                }));
            } catch(e) {}
        }

        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new FocusEvent('focus'));
        inputField.focus();
        inputField.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

        try {
            const dt = new DataTransfer();
            dt.setData("text/plain", prompt);
            inputField.dispatchEvent(new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: dt
            }));
        } catch(e) {}

        if (!inputField.textContent || !inputField.textContent.includes("JAVOB:")) {
            let p = inputField.querySelector('p');
            if (!p) {
                p = document.createElement('p');
                inputField.appendChild(p);
            }
            p.textContent = prompt;
            inputField.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                composed: true,
                inputType: "insertText",
                data: prompt
            }));
        }

        let sendButton = null;
        for (let i = 0; i < 70; i++) {
            await new Promise(resolve => setTimeout(resolve, 300));

            const buttons = [...inputContainer.querySelectorAll("button")];
            const btn = buttons.find(button => {
                const label = [
                    button.getAttribute("aria-label"),
                    button.getAttribute("data-tooltip"),
                    button.getAttribute("title"),
                    button.textContent
                ].filter(Boolean).join(" ").toLowerCase();

                if (/feedback|отзыв|fikr|more|options|qo‘shimcha/i.test(label)) {
                    return false;
                }

                return /send message|xabarni yuborish|отправить сообщение|send-button/i.test(label) ||
                       (label.includes('send') && !label.includes('feedback')) ||
                       (label.includes('yuborish') && !label.includes('fikr')) ||
                       (label.includes('отправить') && !label.includes('отзыв')) ||
                       button.classList.contains('send-button');
            });

            if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                sendButton = btn;
                break;
            }
        }

        if (sendButton) {
            sendButton.click();
        } else {
            const anySend = inputContainer.querySelector('button.send-button, button[aria-label*="send" i], button[aria-label*="yuborish" i]');
            if (anySend && !anySend.disabled) {
                anySend.click();
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

        function extractCleanAnswer(rawText) {
            if (!rawText) return "-";

            const clean = rawText
                .replace(/\r/g, "")
                .replace(/[*_`~#]/g, "")
                .trim();
            if (!clean) return "-";

            function normLetter(ch) {
                if (!ch) return "";
                const map = { "А": "A", "Б": "B", "В": "B", "С": "C", "Д": "D", "Е": "E" };
                const u = ch.toUpperCase();
                return map[u] || u;
            }

            function formatResult(letter, restText) {
                const L = normLetter(letter);
                if (!restText) return L;
                const cleanedRest = restText
                    .replace(/^[\s\)\]\.\:\-\—\=]+/, "")
                    .replace(/[\.\s]+$/, "")
                    .replace(/\s+/g, " ")
                    .trim();
                if (!cleanedRest || cleanedRest.toUpperCase() === L || /^(variant|javob|answer|ответ)$/i.test(cleanedRest)) {
                    return L;
                }
                return `${L}) ${cleanedRest.slice(0, 34)}`;
            }

            const strictRegex = /(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|CORRECT\s+ANSWER|ОТВЕТ|ПРАВИЛЬНЫЙ\s+ОТВЕТ)\s*[:=\-—]+\s*([^\n]+)/gi;
            const strictMatches = [...clean.matchAll(strictRegex)];
            if (strictMatches.length > 0) {
                const lastLine = strictMatches[strictMatches.length - 1][1].trim();

                const startLetter = lastLine.match(/^[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+|\s+[\-\—\)]*\s*|$)(.*)$/i);
                if (startLetter) {
                    return formatResult(startLetter[1], (startLetter[2] || "").trim());
                }

                const varMatch = lastLine.match(/(?:variant\s*([A-EАБВГДЕС])\b|\b([A-EАБВГДЕС])\s*[\-\—]?\s*variant)(?:[\s\:\-\—\)]+(.*))?/i);
                if (varMatch) {
                    return formatResult(varMatch[1] || varMatch[2], varMatch[3] || "");
                }

                const endParen = lastLine.match(/^(.*?)\s*[\(\[]([A-EАБВГДЕС])[\)\]]\s*\.?$/i);
                if (endParen) {
                    return formatResult(endParen[2], endParen[1]);
                }

                if (lastLine.length > 0) {
                    return lastLine.slice(0, 36);
                }
            }

            const altRegex = /(?:to['‘`]?g['‘`]?ri\s+javob|to['‘`]?g['‘`]?ri\s+variant|правильный\s+ответ|correct\s+answer(?:\s+is)?)(?:\s*[:=\-—]+|\s+bu\s+|\s+)[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+\s*([^\n\.]+)|\s+variant|\b)/gi;
            const altMatches = [...clean.matchAll(altRegex)];
            if (altMatches.length > 0) {
                const lastAlt = altMatches[altMatches.length - 1];
                return formatResult(lastAlt[1], lastAlt[2] || "");
            }

            const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
            for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
                const line = lines[i];

                const solo = line.match(/^[\[\(]?([A-EАБВГДЕС])[\]\)\.]?$/i);
                if (solo) {
                    return normLetter(solo[1]);
                }

                const optLine = line.match(/^[\[\(]?([A-EАБВГДЕС])[\]\)\.]\s+(.+)$/i);
                if (optLine && i === lines.length - 1) {
                    return formatResult(optLine[1], optLine[2]);
                }

                const inLine = line.match(/\b([A-EАБВГДЕС])\s*[\-\—]?\s*variant\s+to['‘`]?g['‘`]?ri/i);
                if (inLine) {
                    return normLetter(inLine[1]);
                }
            }

            const lastFew = lines.slice(-3).join(" ");
            const capMatches = [...lastFew.matchAll(/(?:^|[\s\(\[])([A-DАБВГДС])(?:[\)\]\.]|\s+variant)/g)];
            if (capMatches.length > 0) {
                return normLetter(capMatches[capMatches.length - 1][1]);
            }

            return lines.length > 0 ? lines[lines.length - 1].slice(0, 34) : "-";
        }

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

                const newModelResponses = [...document.querySelectorAll("model-response")]
                    .filter(el => !el.hasAttribute("data-aitest-old"));

                const newResponses = newModelResponses.length > 0 ? newModelResponses :
                    [...document.querySelectorAll("message-content")].filter(el => !el.hasAttribute("data-aitest-old"));

                if (newResponses.length > 0) {
                    const latestNewResponse = newResponses[newResponses.length - 1];
                    const text = (latestNewResponse.textContent || latestNewResponse.innerText || "").trim();

                    const hasAnswerTag = /(?:JAVOB|YAKUNIY\s+JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]/i.test(text);

                    const isStillGenerating = !!document.querySelector(
                        'button[aria-label*="Stop" i], button[aria-label*="to‘xtat" i], button[aria-label*="to\'xtat" i], button[aria-label*="toxtat" i], button[aria-label*="Остановить" i], button.stop-button, mat-progress-bar'
                    );

                    const hasActionButtons = !!latestNewResponse.parentElement?.querySelector(
                        'button[aria-label*="Copy" i], button[aria-label*="Nusxa" i], button[aria-label*="Копировать" i]'
                    );

                    if (text && text === previousText) {
                        stable++;
                    } else {
                        previousText = text;
                        stable = 0;
                    }

                    if (hasAnswerTag && ((!isStillGenerating && stable >= 2) || stable >= 6)) {
                        clearInterval(timer);
                        resolve(extractCleanAnswer(text));
                        return;
                    }

                    if (!isStillGenerating && (hasActionButtons || stable >= 6) && text.length > 10) {
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
