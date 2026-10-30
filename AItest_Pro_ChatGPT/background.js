// Background Service Worker - AItest Pro V18 (ChatGPT Service-Worker-Driven Polling + StudyMode Proof + Precision Answer Extractor)

const PROMPT_TEXT = `Men o'qituvchiman, o'zim tuzgan savollar bazasining javob kalitlarini tekshiryapman (Study Mode / o'quv menyusini yoqma, to'g'ridan-to'g'ri javobni ber). Rasmda berilgan savol va variantlarni barcha fanlar qoidalari asosida aniq tahlil qil. QAT'IY QOIDALAR: 1) Rasmda berilgan variantlar orasidan 100% to'g'risini top (agar variantlarda A, B, C, D harflari yozilmagan bo'lsa, ularni tepadan pastga A, B, C, D deb hisobla). 2) Javobning eng oxirgi qatorida FAQAT quyidagi formatda to'g'ri variant harfi va qisqa javob matnini yoz: JAVOB: B) to'g'ri javob matni`;

const CHATGPT_URL_PATTERNS = [
    "*://chatgpt.com/*",
    "*://*.chatgpt.com/*",
    "*://chat.openai.com/*"
];

// Saytning asosiy (MAIN) JS muhitiga CSP-ni aylanib o'tib himoya o'rnatish
function applyMainWorldShield() {
    try {
        if (window.__aitestMainShieldV18) return;
        window.__aitestMainShieldV18 = true;

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
            if (!answer || answer === "-") {
                await new Promise(r => setTimeout(r, 1000));
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

// Matn hali javob berilmagan Study Mode menyusi ekanini tekshirish
function isPendingStudyModeText(text) {
    if (!text) return false;
    // Agar matnda JAVOB: yoki To'g'ri javob iborasi bo'lsa, demak javob allaqachon chiqqan!
    if (/(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|CORRECT\s+ANSWER|ОТВЕТ|ПРАВИЛЬНЫЙ\s+ОТВЕТ)\s*[:=\-—]/i.test(text)) {
        return false;
    }
    const tail = text.slice(-400);
    return /work through it together|show me the answer|quiz me on similar|talk through it using voice|yordam turini tanlang/i.test(tail);
}

// ================= YUQORI ANIQLIKDAGI JAVOB AJRATIB OLUVCHI (PRECISION PARSER V18) =================
function extractCleanAnswer(rawText) {
    if (!rawText) return "-";

    // Study Mode tugmalari matnini tozalab tashlaymiz (agar javob shu turn ichida ulardan keyin chiqqan bo'lsa, xalaqit bermasligi uchun!)
    const clean = rawText
        .replace(/\r/g, "")
        .replace(/[*_`~#]/g, "")
        .replace(/^(?:work through it together|show me the answer|quiz me on similar questions|talk through it using voice mode|submit|.*quyidagi yordam turini tanlang.*)$/gim, "")
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

    // 1-BOSQICH: "JAVOB: ..." qatorlarini qidirish (eng oxirgisini olamiz)
    const strictRegex = /(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|CORRECT\s+ANSWER|ОТВЕТ|ПРАВИЛЬНЫЙ\s+ОТВЕТ)\s*[:=\-—]+\s*([^\n]+)/gi;
    const strictMatches = [...clean.matchAll(strictRegex)];
    if (strictMatches.length > 0) {
        const lastLine = strictMatches[strictMatches.length - 1][1].trim();

        // a) Boshida A-E harfi turgan bo'lsa
        const startLetter = lastLine.match(/^[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+|\s+[\-\—\)]*\s*|$)(.*)$/i);
        if (startLetter) {
            const candidateLetter = startLetter[1];
            const remainder = (startLetter[2] || "").trim();
            return formatResult(candidateLetter, remainder);
        }

        // b) "B variant" yoki "variant B"
        const varMatch = lastLine.match(/(?:variant\s*([A-EАБВГДЕС])\b|\b([A-EАБВГДЕС])\s*[\-\—]?\s*variant)(?:[\s\:\-\—\)]+(.*))?/i);
        if (varMatch) {
            const l = varMatch[1] || varMatch[2];
            return formatResult(l, varMatch[3] || "");
        }

        // c) Oxirida qavs ichida "(B)" bo'lsa: "1096-1099-yillar (B)"
        const endParen = lastLine.match(/^(.*?)\s*[\(\[]([A-EАБВГДЕС])[\)\]]\s*\.?$/i);
        if (endParen) {
            return formatResult(endParen[2], endParen[1]);
        }

        // d) Harfsiz aniq javob qiymati
        if (lastLine.length > 0) {
            return lastLine.slice(0, 36);
        }
    }

    // Agar hali Study Mode menyusidan o'tmagan bo'lsa (JAVOB: tegi yo'q va oxiri Study Mode bo'lsa), "-" qaytaramiz
    if (isPendingStudyModeText(rawText)) {
        return "-";
    }

    // 2-BOSQICH: Matn ichida "To'g'ri javob B) ..." / "Correct answer is C"
    const altRegex = /(?:to['‘`]?g['‘`]?ri\s+javob|to['‘`]?g['‘`]?ri\s+variant|правильный\s+ответ|correct\s+answer(?:\s+is)?)(?:\s*[:=\-—]+|\s+bu\s+|\s+)[\[\(\"]?([A-EАБВГДЕС])(?:[\]\)\.\:\-\—]+\s*([^\n\.]+)|\s+variant|\b)/gi;
    const altMatches = [...clean.matchAll(altRegex)];
    if (altMatches.length > 0) {
        const lastAlt = altMatches[altMatches.length - 1];
        return formatResult(lastAlt[1], lastAlt[2] || "");
    }

    // 3-BOSQICH: Oxirgi 5 qatordan yakuniy variantni qidirish
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

    // 4-BOSQICH: Oxirgi 3 qatorda katta harfda (case-sensitive!) A, B, C, D qavs yoki nuqta bilan kelsa
    const lastFew = lines.slice(-3).join(" ");
    const capMatches = [...lastFew.matchAll(/(?:^|[\s\(\[])([A-DАБВГДС])(?:[\)\]\.]|\s+variant)/g)];
    if (capMatches.length > 0) {
        return normLetter(capMatches[capMatches.length - 1][1]);
    }

    return lines.length > 0 ? lines[lines.length - 1].slice(0, 34) : "-";
}

// ChatGPT sahifasidan eng oxirgi javobni hech qanday cheklovsiz (data-aitest-old ga qaramasdan) tortib olish
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

            // Barcha assistant bloklari va turnlarini yig'amiz (eng oxirgisidan tepaga qarab tekshirish uchun)
            const candidates = [];

            const articles = [...document.querySelectorAll('article[data-testid^="conversation-turn-"]')];
            for (const art of articles) {
                if (art.querySelector('[data-message-author-role="assistant"], .markdown, .agent-turn') || !art.querySelector('[data-message-author-role="user"]')) {
                    const t = (art.textContent || art.innerText || "").trim();
                    if (t) candidates.push(t);
                }
            }

            const assistantEls = [...document.querySelectorAll('[data-message-author-role="assistant"], .markdown, .agent-turn')];
            for (const el of assistantEls) {
                const t = (el.textContent || el.innerText || "").trim();
                if (t) candidates.push(t);
            }

            return candidates;
        }
    }).catch(() => null);

    const candidates = results?.[0]?.result;
    if (!candidates || !candidates.length) return null;

    // 1. Avval oxiridan boshlab "JAVOB:" tegi bor xabarni qidiramiz
    for (let i = candidates.length - 1; i >= 0; i--) {
        const raw = candidates[i];
        if (/(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]/i.test(raw)) {
            const parsed = extractCleanAnswer(raw);
            if (parsed && parsed !== "-") return parsed;
        }
    }

    // 2. Agar teg topilmasa, eng oxirgi nomzoddan javobni ajratib olamiz
    for (let i = candidates.length - 1; i >= Math.max(0, candidates.length - 4); i--) {
        const parsed = extractCleanAnswer(candidates[i]);
        if (parsed && parsed !== "-") return parsed;
    }

    return null;
}

// YANGI OYNA EMAS, HECH QACHON FOKUSNI O'ZGARTIRMAYDIGAN ORQA FON TABI (active: false) OCHISH!
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

    const createProps = {
        url: "https://chatgpt.com/",
        active: false
    };
    if (currentWindowId) {
        createProps.windowId = currentWindowId;
    }

    let chatgptTab = null;
    try {
        chatgptTab = await chrome.tabs.create(createProps);
    } catch (e) {
        chatgptTab = await chrome.tabs.create({
            url: "https://chatgpt.com/",
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
            if (chatgptTab && tabId === chatgptTab.id && info.status === "complete") {
                isResolved = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    return chatgptTab;
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

        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
    } catch(e) {}
}

// ASOSIY BOSHQARUV: Service Worker o'zida (hech qachon muzlamaydigan muhitda!) kutish va tekshirish
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

    // 1-QADAM: Sahifani tayyorlash, eski javoblar snapshotini olish, rasm va promptni kiritish
    const prepResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: prepareAndAttachChatGPT,
        args: [dataUrl, PROMPT_TEXT]
    }).catch(() => null);

    const baselineCount = prepResult?.[0]?.result?.baselineCount ?? 0;
    const baselineLastText = prepResult?.[0]?.result?.baselineLastText ?? "";

    // 2-QADAM: Rasm yuklanib bo'lib, Send tugmasi bosilguncha Service Worker orqali tekshiramiz (20 soniyagacha)
    let isSent = false;
    for (let i = 0; i < 55; i++) {
        await new Promise(r => setTimeout(r, 350));
        const sendRes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: tryClickSendChatGPT,
            args: [PROMPT_TEXT]
        }).catch(() => null);

        if (sendRes?.[0]?.result?.sent) {
            isSent = true;
            break;
        }
    }

    if (!isSent) {
        // Oxirgi majburiy yuborish urinishi
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: forceSendChatGPT
        }).catch(() => null);
    }

    // 3-QADAM: Javob chiqishini Service Worker taymeri orqali (muzlamasdan!) 60 soniyagacha kuzatib boramiz
    let previousText = "";
    let stableTicks = 0;
    let studyBypassAttempts = 0;

    for (let attempt = 0; attempt < 130; attempt++) {
        await new Promise(r => setTimeout(r, 450));

        const pollRes = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: pollChatGPTDomState,
            args: [baselineCount, baselineLastText]
        }).catch(() => null);

        const state = pollRes?.[0]?.result;
        if (!state) continue;

        const { latestText, isStillGenerating, clickedStudyMode } = state;

        if (clickedStudyMode) {
            studyBypassAttempts++;
            previousText = "";
            stableTicks = 0;

            // Agar Study Mode tugmasi 2 marta bosilsa ham ketmasa, chatdan to'g'ridan-to'g'ri yozib yuboramiz
            if (studyBypassAttempts === 3) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: sendStudyModeFallbackMessage
                }).catch(() => null);
            }
            continue;
        }

        if (!latestText) continue;

        if (latestText === previousText) {
            stableTicks++;
        } else {
            previousText = latestText;
            stableTicks = 0;
        }

        const hasStrictAnswerTag = /(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|ОТВЕТ)\s*[:=\-—]/i.test(latestText);

        // A) Agar matnda "JAVOB:" tegi chiqqan bo'lsa va generatsiya tugagan (yoki 2 soniya o'zgarmagan) bo'lsa:
        if (hasStrictAnswerTag && ((!isStillGenerating && stableTicks >= 1) || stableTicks >= 4)) {
            const parsed = extractCleanAnswer(latestText);
            if (parsed && parsed !== "-") {
                return parsed;
            }
        }

        // B) Agar generatsiya to'liq tugagan bo'lsa va Study Mode kutish holatida bo'lmasa:
        if (!isStillGenerating && stableTicks >= 4 && latestText.length > 5 && !isPendingStudyModeText(latestText)) {
            const parsed = extractCleanAnswer(latestText);
            if (parsed && parsed !== "-") {
                return parsed;
            }
        }
    }

    if (previousText && !isPendingStudyModeText(previousText)) {
        const finalParsed = extractCleanAnswer(previousText);
        if (finalParsed && finalParsed !== "-") return finalParsed;
    }

    return (await getLatestAnswerFromChatGPT()) || "-";
}

// 1-Funksiyasi: Rasm va Promptni ChatGPT sahifasiga joylashtirish
async function prepareAndAttachChatGPT(dataUrl, prompt) {
    try {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));

        // Mavjud xabarlar holatini eslab qolamiz (lekin ularni hech qachon yaroqsiz qilib bloklamaymiz!)
        const getBlocks = () => [...document.querySelectorAll('article[data-testid^="conversation-turn-"], [data-message-author-role="assistant"], .markdown')];
        const blocks = getBlocks();
        const baselineCount = blocks.length;
        const baselineLastText = blocks.length > 0 ? (blocks[blocks.length - 1].textContent || "").trim() : "";

        // Eski markdown bloklarini belgilab qo'yamiz
        document.querySelectorAll('[data-message-author-role="assistant"], .markdown, .agent-turn')
            .forEach(el => el.setAttribute("data-aitest-prev", "1"));

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "screen.png", { type: "image/png" });

        // Modal dialoglarni va eski biriktirilgan rasmlarni tozalash
        try {
            const dismissBtns = [...document.querySelectorAll('[role="dialog"] button, button')].filter(btn => {
                const t = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.textContent || '')).toLowerCase();
                return /stay logged out|maybe later|got it|dismiss|close modal|not now|continue/i.test(t);
            });
            dismissBtns.forEach(b => b.click());

            const removeAttached = document.querySelectorAll(
                'form button[aria-label*="Remove" i], form button[aria-label*="Delete" i], form button[aria-label*="O‘chirish" i], form button[aria-label*="Удалить" i]'
            );
            removeAttached.forEach(btn => btn.click());
        } catch(e) {}

        let inputField = null;
        for (let i = 0; i < 30; i++) {
            inputField = document.querySelector('#prompt-textarea') ||
                         document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
                         document.querySelector('form div[contenteditable="true"]') ||
                         document.querySelector('div[contenteditable="true"]') ||
                         document.querySelector('[role="textbox"]') ||
                         document.querySelector('textarea');
            if (inputField) break;
            await new Promise(r => setTimeout(r, 250));
        }

        if (!inputField) return { baselineCount, baselineLastText, ok: false };

        const inputContainer = inputField.closest('form') || inputField.closest('main') || document.body;

        function hasAttachmentPreview() {
            return !!inputContainer.querySelector(
                'img, [style*="background-image"], [data-testid*="attachment"], [class*="attachment"], button[aria-label*="Remove" i], button[aria-label*="Delete" i], button[aria-label*="O‘chirish" i], button[aria-label*="Удалить" i], [role="progressbar"], svg.animate-spin'
            );
        }

        const transfer = new DataTransfer();
        transfer.items.add(file);

        // Rasmni input[type="file"] orqali biriktirish
        const fileInputs = [...document.querySelectorAll('input[type="file"]')];
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
            await new Promise(r => setTimeout(r, 300));
        }

        // Agar input[type="file"] ishlamasa, Paste orqali biriktirish
        if (!hasAttachmentPreview()) {
            try {
                inputField.focus();
                inputField.dispatchEvent(new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clipboardData: transfer
                }));
            } catch(e) {}
            await new Promise(r => setTimeout(r, 300));
        }

        // Prompt matnini ProseMirror-ga joylash
        inputField.focus();
        if (inputField.tagName === "TEXTAREA") {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            if (nativeSetter) nativeSetter.call(inputField, prompt);
            else inputField.value = prompt;
            inputField.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            try {
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(inputField);
                sel.removeAllRanges();
                sel.addRange(range);

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
                let p = inputField.querySelector("p");
                if (!p) {
                    p = document.createElement("p");
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
        }

        return { baselineCount, baselineLastText, ok: true };
    } catch (e) {
        return { baselineCount: 0, baselineLastText: "", ok: false };
    }
}

// 2-Funksiya: Rasm yuklanib bo'lgach Send tugmasini bosish
function tryClickSendChatGPT(prompt) {
    try {
        const inputField = document.querySelector('#prompt-textarea') ||
                           document.querySelector('form div[contenteditable="true"]') ||
                           document.querySelector('textarea');
        const inputContainer = inputField?.closest('form') || document.body;

        // Agar prompt o'chib qolgan bo'lsa va hali yuborilmagan bo'lsa, tiklaymiz
        if (inputField && (!inputField.textContent || !inputField.textContent.includes("JAVOB:")) && !document.querySelector('button[data-testid="stop-button"]')) {
            let p = inputField.querySelector("p");
            if (!p) {
                p = document.createElement("p");
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

        const isUploading = !!inputContainer.querySelector('[role="progressbar"], svg.animate-spin, [class*="animate-spin"]');
        if (isUploading) return { sent: false };

        const btn = document.querySelector('button[data-testid="send-button"]') ||
                    inputContainer.querySelector('button[type="submit"]') ||
                    [...inputContainer.querySelectorAll("button")].find(button => {
                        const label = [
                            button.getAttribute("aria-label"),
                            button.getAttribute("data-testid"),
                            button.getAttribute("title"),
                            button.textContent
                        ].filter(Boolean).join(" ").toLowerCase();

                        if (/stop|voice|ovoz|attach|plus|remove|delete|close/i.test(label)) return false;
                        return /send|yuborish|отправить|submit/i.test(label);
                    });

        if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
            btn.click();
            return { sent: true };
        }

        // Agar stop-button allaqachon chiqqan bo'lsa, demak xabar ketgan!
        if (document.querySelector('button[data-testid="stop-button"]')) {
            return { sent: true };
        }

        return { sent: false };
    } catch (e) {
        return { sent: false };
    }
}

function forceSendChatGPT() {
    try {
        const btn = document.querySelector('button[data-testid="send-button"]') || document.querySelector('form button[type="submit"]');
        if (btn && !btn.disabled) {
            btn.click();
            return;
        }
        const inputField = document.querySelector('#prompt-textarea') || document.querySelector('form div[contenteditable="true"]');
        if (inputField) {
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
    } catch (e) {}
}

// 3-Funksiya: Har 450ms da ChatGPT DOM holatini tekshirish va Study Mode chiqsa avtomatik bosish
function pollChatGPTDomState(baselineCount, baselineLastText) {
    try {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));

        const isStillGenerating = !!document.querySelector(
            'button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="To‘xtat" i], button[aria-label*="Остановить" i], .result-streaming'
        );

        // Yangi chiqqan assistant matnini topamiz
        const newMdNodes = [...document.querySelectorAll('[data-message-author-role="assistant"], .markdown, .agent-turn')]
            .filter(el => !el.hasAttribute("data-aitest-prev"));

        let latestText = "";
        let activeTurnEl = null;

        if (newMdNodes.length > 0) {
            const lastNode = newMdNodes[newMdNodes.length - 1];
            activeTurnEl = lastNode.closest('article') || lastNode.parentElement || lastNode;
            // Agar bitta turn ichida bir nechta yangi markdown bo'lsa (masalan Study Mode dan keyin javob chiqsa), eng oxirgi markdown va butun turnni birlashtiramiz
            const nodeText = (lastNode.textContent || lastNode.innerText || "").trim();
            const turnText = (activeTurnEl.textContent || activeTurnEl.innerText || "").trim();
            latestText = nodeText.includes("JAVOB") ? nodeText : (turnText || nodeText);
        } else {
            // Zaxira: Agar ChatGPT mavjud turn ichini yangilagan bo'lsa
            const articles = [...document.querySelectorAll('article[data-testid^="conversation-turn-"]')];
            if (articles.length > 0) {
                const lastArt = articles[articles.length - 1];
                if (!lastArt.querySelector('[data-message-author-role="user"]')) {
                    const t = (lastArt.textContent || lastArt.innerText || "").trim();
                    if (t && t !== baselineLastText) {
                        latestText = t;
                        activeTurnEl = lastArt;
                    }
                }
            }
        }

        // Tekshiramiz: Hozir javob berilmagan Study Mode menyusi ("Show me the answer" + "Submit") turibdimi?
        const hasAnswerAlready = /(?:JAVOB|YAKUNIY\s+JAVOB|TO['‘`]?G['‘`]?RI\s+JAVOB|ANSWER|FINAL\s+ANSWER|ОТВЕТ)\s*[:=\-—]/i.test(latestText);
        const tailText = latestText.slice(-400);
        const isPendingStudyCard = !hasAnswerAlready && /work through it together|show me the answer|quiz me on similar|talk through it using voice|yordam turini tanlang/i.test(tailText);

        let clickedStudyMode = false;
        if (isPendingStudyCard && !isStillGenerating) {
            const searchRoot = activeTurnEl || document;
            const allEls = [...searchRoot.querySelectorAll('button, label, [role="radio"], [role="option"], [role="button"], li, div, span')];

            const showAnsEls = allEls.filter(el => {
                const txt = (el.textContent || "").trim();
                return /^(show me the answer|javobni ko['‘`]?rsat(?:ish)?|показать ответ)$/i.test(txt);
            });

            for (const item of showAnsEls) {
                try {
                    const clickable = item.closest('button, label, [role="radio"], [role="option"], [role="button"], li') || item;
                    clickable.click();
                    const radio = clickable.querySelector('input[type="radio"], input[type="checkbox"]');
                    if (radio) {
                        radio.checked = true;
                        radio.click();
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    item.click();
                    clickedStudyMode = true;
                } catch (e) {}
            }

            const submitBtns = [...searchRoot.querySelectorAll('button, [role="button"], input[type="submit"]')].filter(btn => {
                const txt = ((btn.textContent || "") + " " + (btn.getAttribute("aria-label") || "")).trim();
                return /\b(submit|yuborish|tasdiqlash|отправить)\b/i.test(txt) && !btn.disabled;
            });

            for (const subBtn of submitBtns) {
                try {
                    subBtn.click();
                    clickedStudyMode = true;
                } catch (e) {}
            }
        }

        return {
            latestText,
            isStillGenerating,
            clickedStudyMode
        };
    } catch (e) {
        return { latestText: "", isStillGenerating: false, clickedStudyMode: false };
    }
}

function sendStudyModeFallbackMessage() {
    try {
        const box = document.querySelector('#prompt-textarea') || document.querySelector('form div[contenteditable="true"]');
        if (!box) return;
        const msg = "Show me the answer. Oxirgi qatorda faqat JAVOB: B) to'g'ri javob matni ko'rinishida yoz!";
        let p = box.querySelector("p");
        if (!p) {
            p = document.createElement("p");
            box.appendChild(p);
        }
        p.textContent = msg;
        box.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
            data: msg
        }));
        setTimeout(() => {
            const btn = document.querySelector('button[data-testid="send-button"]') || document.querySelector('form button[type="submit"]');
            if (btn && !btn.disabled) btn.click();
        }, 250);
    } catch (e) {}
}
