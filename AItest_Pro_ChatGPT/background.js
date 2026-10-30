// Background Service Worker - AItest Pro (ChatGPT Web Edition: Chain of Thought + Smart Answer Extractor + Slow Internet Adaptive)

const PROMPT_TEXT = `Algebra, geometriya, fizika va ingliz tili fanlari bo'yicha oliy toifali ekspertisan.
Ushbu rasmda berilgan test savoli va uning shartini diqqat bilan, mustaqil, qisqa formulalar va qoidalar asosida aniq tahlil qilib yech.

ENG MUHIM TALABLAR:
1. To'g'ri javob berilgan variantlar (A, B, C, D) ichida ANIQ MAVJUD! Agar sen chiqargan natija variantlarga mos kelmasa, demak hisob-kitobda yoki qoidada xato qilgansan — darhol qadamlarni qayta tekshirib, variantlardagi to'g'ri javobni aniqla.
2. Yechim oxirida, eng so'nggi alohida qatorda FAQAT quyidagi formatda yakuniy variantni yoz:
JAVOB: A

(Variantlar qat'iy ravishda: A, B, C yoki D).
3. Ushbu so'nggi "JAVOB:" qatoridan keyin boshqa hech qanday izoh, so'z yoki gap yozma!`;

const CHATGPT_URL_PATTERNS = [
    "*://chatgpt.com/*",
    "*://*.chatgpt.com/*",
    "*://chat.openai.com/*"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "cleanup_gemini" || request.action === "cleanup_chatgpt") {
        // 1. ChatGPT tablarini va alohida oynalarini (window) butunlay yopish
        chrome.tabs.query({ url: CHATGPT_URL_PATTERNS }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const winIds = new Set(tabs.map(t => t.windowId).filter(Boolean));
                winIds.forEach(wId => {
                    try { chrome.windows.remove(wId); } catch(e) {}
                });
                const tabIds = tabs.map(t => t.id);
                try { chrome.tabs.remove(tabIds); } catch(e) {}
            }
        });

        // 2. Brauzer tarixidan (History) ChatGPT havolalarini butunlay o'chirish
        if (chrome.history) {
            chrome.history.search({ text: "chatgpt", startTime: 0, maxResults: 1000 }, (items) => {
                if (items && items.length > 0) {
                    items.forEach(item => {
                        if (item.url && (item.url.includes("chatgpt.com") || item.url.includes("openai.com"))) {
                            chrome.history.deleteUrl({ url: item.url });
                        }
                    });
                }
            });
        }

        sendResponse({ success: true });
        return true;
    }

    // 3. Markaziy 2-tugma uchun: Fondagi ChatGPT-dan oxirgi javobni tortib olish va fokus berish
    if (request.action === "fetch_latest_answer") {
        (async () => {
            try {
                const answer = await getLatestAnswerFromChatGPT();
                sendResponse({ answer });
            } catch (error) {
                console.error("fetch_latest_answer xatosi:", error);
                sendResponse({ answer: null });
            }
        })();
        return true;
    }

    if (request.action !== "capture") return;

    (async () => {
        try {
            // Aniq joriy test oynasini rasmga olish (boshqa oyna bilan adashmasligi uchun)
            const currentWinId = sender.tab ? sender.tab.windowId : null;
            const dataUrl = await new Promise((resolve, reject) => {
                chrome.tabs.captureVisibleTab(
                    currentWinId,
                    { format: "png" },
                    (url) => {
                        if (chrome.runtime.lastError || !url) {
                            reject(new Error(
                                chrome.runtime.lastError?.message ||
                                "Screenshot olib bo‘lmadi"
                            ));
                        } else {
                            resolve(url);
                        }
                    }
                );
            });

            const answer = await askChatGPTWeb(dataUrl, currentWinId);
            sendResponse({ answer });
        } catch (error) {
            console.error("Screenshot/ChatGPT xatosi:", error);
            sendResponse({
                answer: "Xatolik: " + error.message
            });
        }
    })();

    return true;
});

// ================= FAQAT HARFNI AJRATIB OLISH (SMART PARSER - ENG OXIRGI QATORNI OLUVCHI) =================
function extractCleanAnswer(rawText) {
    if (!rawText) return "Javob yo'q";

    const clean = rawText.replace(/[*_`#]/g, "").trim();

    // 1. ENG ASOSIY: Matndagi ENG OXIRGI "JAVOB: [variant]" ni topish (Boshidagi chalg'ituvchi harflarga qaramaydi)
    const allStrictMatches = [...clean.matchAll(/(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*([A-DА-Я0-9\-\+\.\,\?]+(?:\s*\([A-D]\))?)/gi)];
    if (allStrictMatches.length > 0) {
        const lastMatch = allStrictMatches[allStrictMatches.length - 1];
        const ans = lastMatch[1].trim();
        const letterOnly = ans.match(/^([A-DА-Яa-dа-я]\??)/);
        if (letterOnly) return normalizeLetter(letterOnly[1]);
        return ans.slice(0, 5).trim();
    }

    // 2. Muqobil variantlarning ham ENG OXIRGISI:
    const allAltMatches = [...clean.matchAll(/(?:to['‘`]?g['‘`]?ri\s+javob|правильный\s+ответ|variant|to['‘`]?g['‘`]?ri\s+variant)\s*[:=\-—]?\s*(?:variant\s*)?([A-DА-Яa-dа-я0-9\?]+)/gi)];
    if (allAltMatches.length > 0) {
        const lastAlt = allAltMatches[allAltMatches.length - 1];
        return normalizeLetter(lastAlt[1]);
    }

    // 3. Matnning eng oxirgi satrlaridan (pastdan tepaga qarab) tekshirish:
    const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
        const line = lines[i];

        const lineMatch = line.match(/(?:javob|answer|ответ|variant)?\s*[:=\-—]?\s*\b([A-DА-Яa-dа-я]\??)\b/i);
        if (lineMatch && lineMatch[1]) {
            return normalizeLetter(lineMatch[1]);
        }

        const singleLetter = line.match(/^([A-DА-Яa-dа-я]\??)(?:\)|\.)?$/i);
        if (singleLetter) {
            return normalizeLetter(singleLetter[1]);
        }
    }

    // 4. Oxirgi harf:
    const allLetters = [...clean.matchAll(/\b([A-D]\??)\b/gi)];
    if (allLetters.length > 0) {
        return allLetters[allLetters.length - 1][1].toUpperCase();
    }

    const lastLine = lines[lines.length - 1] || "";
    return lastLine.slice(0, 10).trim();
}

function normalizeLetter(ch) {
    if (!ch) return "";
    let upper = ch.toUpperCase();
    if (upper.startsWith("А")) return "A" + upper.slice(1);
    if (upper.startsWith("В")) return "B" + upper.slice(1);
    if (upper.startsWith("С")) return "C" + upper.slice(1);
    if (upper.startsWith("Д")) return "D" + upper.slice(1);
    return upper;
}

// ChatGPT-dan oxirgi javobni to'g'ridan-to'g'ri o'qib olish funksiyasi
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
    });

    const rawText = results?.[0]?.result;
    if (!rawText) return null;
    return extractCleanAnswer(rawText);
}

async function getOrCreateChatGPTTab(currentWindowId) {
    const tabs = await chrome.tabs.query({
        url: CHATGPT_URL_PATTERNS
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

    // Foydalanuvchi talabi: Agar yo'q bo'lsa, tugma bosilgach 1 soniya kutib keyin yaratish
    await new Promise(resolve => setTimeout(resolve, 1000));

    // O'ng pastki burchakda kichik qilib ochish
    const win = await chrome.windows.create({
        url: "https://chatgpt.com/",
        focused: false,
        type: "normal",
        state: "normal",
        left: 1400,
        top: 600,
        width: 480,
        height: 480
    });

    // Dastlab test oynasiga fokusni qaytaramiz
    if (currentWindowId) {
        try {
            await chrome.windows.update(currentWindowId, { focused: true });
        } catch(e) {}
    }

    const chatgptTab = win.tabs ? win.tabs[0] : (await chrome.tabs.query({ windowId: win.id }))[0];

    await new Promise((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (isResolved) return;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 45000); // 45 soniya zaxira

        function listener(tabId, info) {
            if (tabId === chatgptTab.id && info.status === "complete") {
                isResolved = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });

    await new Promise(resolve => setTimeout(resolve, 2500));
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

        // Mutlaqo ovozsiz audio orqali Chrome fon tabini muzlatishining oldini olish
        try {
            if (!window._aitestAudioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    gain.gain.value = 0; // 0 ovoz
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    window._aitestAudioCtx = ctx;
                }
            }
        } catch(e) {}

        // Doimiy uyg'otuvchi puls (Heartbeat)
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

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: unfreezeBackgroundTab
        });
    } catch(e) {}

    // Noutbuk kuchsiz bo'lsa xabar to'xtab qolmasligi uchun 1-tugma bosilganda
    // bir lahzaga (0.25s) ChatGPT oynasiga o'tib (fokus berib), zudlik bilan asosiy oynaga qaytish
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
    });

    let answer = results?.[0]?.result;

    // 2-NUQTA USULI BILAN YAKUNIY KAFOLAT:
    try {
        await new Promise(r => setTimeout(r, 600));
        const verifiedAnswer = await getLatestAnswerFromChatGPT();
        if (verifiedAnswer && verifiedAnswer !== "Javob yo'q" && !verifiedAnswer.includes("Xatolik")) {
            answer = verifiedAnswer;
        }
    } catch(e) {}

    return answer || "ChatGPT'dan javob olinmadi.";
}

// ChatGPT sahifasida bajariladigan asosiy funksiya
async function attachImageAndAskChatGPT(dataUrl, prompt) {
    try {
        try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.hasFocus = () => true;
        } catch(e) {}

        // 1. Eski javoblarni tamg'alab chiqish (adashmaslik uchun)
        document.querySelectorAll('[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"] .markdown, .agent-turn')
            .forEach(el => el.setAttribute("data-aitest-old", "true"));

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "screen.png", {
            type: "image/png"
        });

        // 0. Xush kelibsiz / modal dialoglarni va eski biriktirilgan fayllarni tozalash
        try {
            const dismissBtns = [...document.querySelectorAll('[role="dialog"] button, button')].filter(btn => {
                const t = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + btn.innerText).toLowerCase();
                return /stay logged out|maybe later|got it|dismiss|close modal|not now/i.test(t);
            });
            dismissBtns.forEach(b => b.click());

            const removeAttached = document.querySelectorAll(
                'form button[aria-label*="Remove" i], form button[aria-label*="Delete" i], form button[aria-label*="O‘chirish" i], form button[aria-label*="Удалить" i]'
            );
            removeAttached.forEach(btn => btn.click());
        } catch(e) {}

        // 1. Chat maydoni (#prompt-textarea) to'liq yuklanguncha 14 soniyagacha kutamiz:
        let inputField = null;
        for (let i = 0; i < 35; i++) {
            inputField = document.querySelector('#prompt-textarea') ||
                         document.querySelector('form div[contenteditable="true"]') ||
                         document.querySelector('div[contenteditable="true"]') ||
                         document.querySelector('[role="textbox"]') ||
                         document.querySelector('textarea');
            if (inputField) break;
            await new Promise(r => setTimeout(r, 400));
        }

        if (!inputField) {
            return "ChatGPT chat maydoni yuklanmadi. Tabni qayta oching (Alt+X) va urinib ko'ring.";
        }

        const inputContainer = inputField.closest('form') || inputField.closest('main') || document.body;

        // 2. Rasmni biriktirish (File Input + Clipboard Paste zaxirasi bilan)
        const transfer = new DataTransfer();
        transfer.items.add(file);

        let imageAttached = false;

        // Usul A: Sahifadagi input[type="file"] orqali yuborish
        let fileInputs = [...document.querySelectorAll('input[type="file"]')];
        if (fileInputs.length === 0) {
            // Agar input[type="file"] ko'rinmasa, "+" / "Attach files" tugmasini bosib ko'ramiz
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
                await new Promise(r => setTimeout(r, 300));
                fileInputs = [...document.querySelectorAll('input[type="file"]')];
            }
        }

        if (fileInputs.length > 0) {
            // Rasm qabul qiladigan inputni yoki oxirgi file inputni tanlaymiz
            const targetFileInput = fileInputs.find(el => (el.accept || "").includes("image")) || fileInputs[fileInputs.length - 1];
            try {
                targetFileInput.disabled = false;
                targetFileInput.value = "";
                targetFileInput.files = transfer.files;
                targetFileInput.dispatchEvent(new Event("input", { bubbles: true }));
                targetFileInput.dispatchEvent(new Event("change", { bubbles: true }));
                imageAttached = true;
            } catch(e) {}
        }

        // Usul B: Agar input[type="file"] ishlamagan bo'lsa, to'g'ridan-to'g'ri #prompt-textarea ga Paste hodisasini yuboramiz
        if (!imageAttached) {
            try {
                inputField.focus();
                const pasteEvent = new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer
                });
                inputField.dispatchEvent(pasteEvent);
                imageAttached = true;
            } catch(e) {}
        }

        await new Promise(r => setTimeout(r, 400));

        // 3. Promptni kiritish va fokuslash (ProseMirror va Textarea uchun)
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

        // 4. Rasm serverga to'liq yuklanib, Send tugmasi aktiv bo'lguncha kutish (21 soniyagacha)
        let sendButton = null;
        for (let i = 0; i < 70; i++) { // 70 * 300ms = 21 soniya zaxira
            await new Promise(resolve => setTimeout(resolve, 300));

            const btn = document.querySelector('button[data-testid="send-button"]') ||
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

            // Rasm yuklanib bo'lgach ChatGPT send-button'ni disabled holatdan chiqaradi
            if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                sendButton = btn;
                break;
            }
        }

        // 5. Yuborish tugmasini bosish
        if (sendButton) {
            sendButton.click();
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

        // ================= FAQAT HARFNI AJRATIB OLISH (SMART PARSER - ENG OXIRGI QATORNI OLUVCHI) =================
        function extractCleanAnswer(rawText) {
            if (!rawText) return "Javob yo'q";

            const clean = rawText.replace(/[*_`#]/g, "").trim();

            const allStrictMatches = [...clean.matchAll(/(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*([A-DА-Я0-9\-\+\.\,\?]+(?:\s*\([A-D]\))?)/gi)];
            if (allStrictMatches.length > 0) {
                const lastMatch = allStrictMatches[allStrictMatches.length - 1];
                const ans = lastMatch[1].trim();
                const letterOnly = ans.match(/^([A-DА-Яa-dа-я]\??)/);
                if (letterOnly) return normalizeLetter(letterOnly[1]);
                return ans.slice(0, 5).trim();
            }

            const allAltMatches = [...clean.matchAll(/(?:to['‘`]?g['‘`]?ri\s+javob|правильный\s+ответ|variant|to['‘`]?g['‘`]?ri\s+variant)\s*[:=\-—]?\s*(?:variant\s*)?([A-DА-Яa-dа-я0-9\?]+)/gi)];
            if (allAltMatches.length > 0) {
                const lastAlt = allAltMatches[allAltMatches.length - 1];
                return normalizeLetter(lastAlt[1]);
            }

            const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
            for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
                const line = lines[i];

                const lineMatch = line.match(/(?:javob|answer|ответ|variant)?\s*[:=\-—]?\s*\b([A-DА-Яa-dа-я]\??)\b/i);
                if (lineMatch && lineMatch[1]) {
                    return normalizeLetter(lineMatch[1]);
                }

                const singleLetter = line.match(/^([A-DА-Яa-dа-я]\??)(?:\)|\.)?$/i);
                if (singleLetter) {
                    return normalizeLetter(singleLetter[1]);
                }
            }

            const allLetters = [...clean.matchAll(/\b([A-D]\??)\b/gi)];
            if (allLetters.length > 0) {
                return allLetters[allLetters.length - 1][1].toUpperCase();
            }

            const lastLine = lines[lines.length - 1] || "";
            return lastLine.slice(0, 10).trim();
        }

        function normalizeLetter(ch) {
            if (!ch) return "";
            let upper = ch.toUpperCase();
            if (upper.startsWith("А")) return "A" + upper.slice(1);
            if (upper.startsWith("В")) return "B" + upper.slice(1);
            if (upper.startsWith("С")) return "C" + upper.slice(1);
            if (upper.startsWith("Д")) return "D" + upper.slice(1);
            return upper;
        }

        // 6. Yangi javobni kutish (Sekin internet uchun 54 soniyagacha zaxira)
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

                    const hasAnswerTag = /(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*[A-DА-Я]/i.test(text);

                    // ChatGPT hali yozayotganini tekshirish (stop-button yoki streaming klassi)
                    const isStillGenerating = !!document.querySelector(
                        'button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="To‘xtat" i], button[aria-label*="Остановить" i], .result-streaming'
                    );

                    // Javob tugagach chiqadigan Copy tugmasi bormi?
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

                    // 1. Agar JAVOB: [A-D] tegi paydo bo'lsa:
                    if (hasAnswerTag && ((!isStillGenerating && stable >= 4) || hasActionButtons || stable >= 7)) {
                        clearInterval(timer);
                        const cleanAnswer = extractCleanAnswer(text);
                        resolve(cleanAnswer);
                        return;
                    }

                    // 2. Agar JAVOB tegi bo'lmasa, generatsiya to'xtab, kamida 8 sikl (~3.2 soniya) o'zgarmasa:
                    if (!isStillGenerating && (hasActionButtons || stable >= 8) && text.length > 20) {
                        clearInterval(timer);
                        const cleanAnswer = extractCleanAnswer(text);
                        resolve(cleanAnswer);
                        return;
                    }
                }

                // 135 tsikl * 400ms = ~54 soniya maksimal sabr
                if (attempts >= 135) {
                    clearInterval(timer);
                    resolve(previousText ? extractCleanAnswer(previousText) : "Javob kelmadi (Internet sekin)");
                }
            }, 400);
        });
    } catch (error) {
        return "Xatolik: " + error.message;
    }
}
