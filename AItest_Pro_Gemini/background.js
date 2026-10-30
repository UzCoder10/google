// Background Service Worker - AItest Pro (Chain of Thought + Smart Answer Extractor + Slow Internet Adaptive)

const PROMPT_TEXT = `Algebra, geometriya, fizika va ingliz tili fanlari bo'yicha oliy toifali ekspertisan.
Ushbu rasmda berilgan test savoli va uning shartini diqqat bilan, mustaqil, qisqa formulalar va qoidalar asosida aniq tahlil qilib yech.

ENG MUHIM TALABLAR:
1. To'g'ri javob berilgan variantlar (A, B, C, D) ichida ANIQ MAVJUD! Agar sen chiqargan natija variantlarga mos kelmasa, demak hisob-kitobda yoki qoidada xato qilgansan — darhol qadamlarni qayta tekshirib, variantlardagi to'g'ri javobni aniqla.
2. Yechim oxirida, eng so'nggi alohida qatorda FAQAT quyidagi formatda yakuniy variantni yoz:
JAVOB: A

(Variantlar qat'iy ravishda: A, B, C yoki D).
3. Ushbu so'nggi "JAVOB:" qatoridan keyin boshqa hech qanday izoh, so'z yoki gap yozma!`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "cleanup_gemini") {
        // 1. Gemini tablarini va alohida oynalarini (window) butunlay yopish
        chrome.tabs.query({ url: "*://gemini.google.com/*" }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const winIds = new Set(tabs.map(t => t.windowId).filter(Boolean));
                winIds.forEach(wId => {
                    try { chrome.windows.remove(wId); } catch(e) {}
                });
                const tabIds = tabs.map(t => t.id);
                try { chrome.tabs.remove(tabIds); } catch(e) {}
            }
        });

        // 2. Brauzer tarixidan (History) Gemini havolalarini butunlay o'chirish
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

    // 3. Markaziy 2-tugma uchun: Fondagi Gemini-dan oxirgi javobni tortib olish va fokus berish
    if (request.action === "fetch_latest_answer") {
        (async () => {
            try {
                const answer = await getLatestAnswerFromGemini();
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

            const answer = await askGeminiWeb(dataUrl, currentWinId);
            sendResponse({ answer });
        } catch (error) {
            console.error("Screenshot/Gemini xatosi:", error);
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

// Gemini-dan oxirgi javobni to'g'ridan-to'g'ri o'qib olish funksiyasi
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
            return (latest.innerText || latest.textContent || "").trim();
        }
    });

    const rawText = results?.[0]?.result;
    if (!rawText) return null;
    return extractCleanAnswer(rawText);
}

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

    // Foydalanuvchi talabi: Agar yo'q bo'lsa, tugma bosilgach 1 soniya kutib keyin yaratish (foydalanuvchi ulgurishi uchun)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // O'ng pastki burchakda kichik qilib ochish (Windows Chrome uchun)
    const win = await chrome.windows.create({
        url: "https://gemini.google.com/app",
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

    const geminiTab = win.tabs ? win.tabs[0] : (await chrome.tabs.query({ windowId: win.id }))[0];

    await new Promise((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (isResolved) return;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 45000); // 45 soniya zaxira

        function listener(tabId, info) {
            if (tabId === geminiTab.id && info.status === "complete") {
                isResolved = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });

    await new Promise(resolve => setTimeout(resolve, 2500));
    return geminiTab;
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

async function askGeminiWeb(dataUrl, currentWinId) {
    const tab = await getOrCreateGeminiTab(currentWinId);

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: unfreezeBackgroundTab
        });
    } catch(e) {}

    // Foydalanuvchi talabi: Noutbuk kuchsiz bo'lsa xabar to'xtab qolmasligi uchun 1-tugma bosilganda
    // ochilgandagidek bir lahzaga (0.25s) Gemini oynasiga o'tib (fokus berib), zudlik bilan test oynasiga qaytish
    if (tab && tab.windowId && currentWinId && tab.windowId !== currentWinId) {
        try {
            await chrome.windows.update(tab.windowId, { focused: true });
        } catch(e) {}

        // 250ms dan so'ng test oynasini yana fokusga qaytaramiz (ko'z ochib yumguncha)
        setTimeout(() => {
            try { chrome.windows.update(currentWinId, { focused: true }); } catch(e) {}
        }, 250);

        // Zaxira: 700ms dan so'ng test oynasini yana bir bor qat'iy fokusda mustahkamlaymiz
        setTimeout(() => {
            try { chrome.windows.update(currentWinId, { focused: true }); } catch(e) {}
        }, 700);
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: attachImageAndAsk,
        args: [dataUrl, PROMPT_TEXT]
    });

    let answer = results?.[0]?.result;

    // 2-NUQTA USULI BILAN YAKUNIY KAFOLAT:
    // Javobni uzatishdan oldin xuddi 2-nuqta kabi eng so'nggi to'liq yangilangan matnni qayta tekshiramiz
    try {
        await new Promise(r => setTimeout(r, 600));
        const verifiedAnswer = await getLatestAnswerFromGemini();
        if (verifiedAnswer && verifiedAnswer !== "Javob yo'q" && !verifiedAnswer.includes("Xatolik")) {
            answer = verifiedAnswer;
        }
    } catch(e) {}

    return answer || "Gemini'dan javob olinmadi.";
}

// Gemini sahifasida bajariladigan asosiy funksiya
async function attachImageAndAsk(dataUrl, prompt) {
    try {
        try {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            document.hasFocus = () => true;
        } catch(e) {}

        // 1. Eski javoblarni tamg'alab chiqish (adashmaslik uchun)
        document.querySelectorAll("model-response, message-content, .model-response-text")
            .forEach(el => el.setAttribute("data-aitest-old", "true"));

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "screen.png", {
            type: "image/png"
        });

        // 0. Gemini Advanced / Pro xush kelibsiz dialoglarini va eski chala chiplarni tozalash
        try {
            const closeButtons = [...document.querySelectorAll('button')].filter(btn => {
                const t = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + btn.innerText).toLowerCase();
                return /got it|tushundim|boshlash|dismiss|close|yopish|davom etish|continue/i.test(t);
            });
            closeButtons.forEach(b => b.click());

            const removeChips = document.querySelectorAll('button[aria-label*="remove" i], button[aria-label*="o‘chirish" i], button[aria-label*="delete" i], .delete-button, button[aria-label*="clear" i]');
            removeChips.forEach(btn => btn.click());
        } catch(e) {}

        // 1. Chat maydoni (rich-textarea) to'liq yuklanguncha 14 soniyagacha kutamiz:
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

        if (!inputField) {
            return "Gemini chat maydoni yuklanmadi. Tabni qayta oching (Alt+X) va urinib ko'ring.";
        }

        // 2. Fayl inputini topish va rasmni biriktirish (Gemini va Gemini Pro uchun moslashuvchan zaxira bilan)
        let fileInput = null;
        const promptBox = inputField.closest('.input-area-container, .bottom-container, .chat-window, .input-area, main') || document.body;
        const inputContainer = promptBox;

        for (let attempt = 0; attempt < 20; attempt++) {
            fileInput = document.querySelector('input[type="file"]');
            if (fileInput) break;

            // Agar fayl inputi hali ochilmagan bo'lsa, "+" (biriktirish) tugmasini bosamiz
            if (attempt === 0 || attempt === 4) {
                const buttons = [...promptBox.querySelectorAll("button")];
                const uploadButton = buttons.find(btn => {
                    const label = [
                        btn.getAttribute("aria-label"),
                        btn.getAttribute("data-tooltip"),
                        btn.getAttribute("title"),
                        btn.innerText
                    ].filter(Boolean).join(" ").toLowerCase();

                    if (/feedback|fikr|отзыв|send|yuborish|отправить|mic|ovoz|микрофон|more options|boshqa/i.test(label)) {
                        return false;
                    }

                    const iconTxt = (btn.querySelector('mat-icon')?.innerText || '').trim().toLowerCase();

                    return /attach|upload|file|fayl|biriktir|rasm|add|qo[‘'`]?sh|plus/i.test(label) ||
                           (iconTxt === 'add' || iconTxt === 'attach_file' || iconTxt === 'upload');
                });

                if (uploadButton) {
                    uploadButton.click();
                }
            }

            // Gemini Pro-da menyu ochilgan bo'lsa ("Kompyuterdan yuklash" / "Upload from computer")
            const menuItems = [...document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, .mat-menu-item, mat-list-item')];
            if (menuItems.length > 0) {
                const computerUploadItem = menuItems.find(item => {
                    const txt = ((item.getAttribute("aria-label") || "") + " " + item.innerText).toLowerCase();
                    return /kompyuter|computer|yuklash|upload|fayl|file|rasm|image/i.test(txt);
                });

                if (computerUploadItem) {
                    computerUploadItem.click();
                }
            }

            await new Promise(r => setTimeout(r, 300));
        }

        if (!fileInput) {
            return "Gemini fayl yuklash maydoni topilmadi.";
        }

        try {
            fileInput.disabled = false;
            fileInput.value = ""; // Har bir yangi rasm to'liq yangilanishi uchun avvalgisini tozalaymiz
        } catch(e) {}

        const transfer = new DataTransfer();
        transfer.items.add(file);

        try {
            fileInput.files = transfer.files;
            fileInput.dispatchEvent(new Event("input", { bubbles: true }));
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        } catch(e) {}

        // 3. Promptni kiritish va fokuslash
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new FocusEvent('focus'));
        inputField.focus();
        inputField.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

        try {
            document.execCommand("insertText", false, prompt);
        } catch(e) {}

        if (!inputField.textContent.includes("JAVOB:")) {
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

        // 4. Rasm to'liq yuklangach Send tugmasini qidirish (Sekin internet uchun 21 soniyagacha sabr qiladi)
        let sendButton = null;
        for (let i = 0; i < 70; i++) { // 70 * 300ms = 21 soniya zaxira
            await new Promise(resolve => setTimeout(resolve, 300));

            const buttons = [...inputContainer.querySelectorAll("button")];
            const btn = buttons.find(button => {
                const label = [
                    button.getAttribute("aria-label"),
                    button.getAttribute("data-tooltip"),
                    button.getAttribute("title"),
                    button.innerText
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

            // Rasm serverga yetib borgach Send tugmasi aktiv bo'lishi bilan loop to'xtaydi
            if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                sendButton = btn;
                break;
            }
        }

        // 5. Yuborish tugmasini bosish
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

        // 6. Yangi javobni kutish (Sekin internet uchun 54 soniyagacha zaxira)
        return await new Promise(resolve => {
            let attempts = 0;
            let previousText = "";
            let stable = 0;

            const timer = setInterval(() => {
                attempts++;

                // Orqa fonda muzlab qolmasligi uchun har bir tekshirishda uyg'otib turamiz
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
                    // innerText orqa fonda bo'sh qolishi mumkinligi sababli textContent ham tekshiriladi
                    const text = (latestNewResponse.innerText || latestNewResponse.textContent || "").trim();

                    const hasAnswerTag = /(?:JAVOB|ANSWER|ОТВЕТ)\s*[:=\-—]\s*[A-DА-Я]/i.test(text);

                    // Gemini hali yozayotganini tekshirish (Stop/To'xtatish tugmasi yoki progress bar bormi?)
                    const isStillGenerating = !!document.querySelector(
                        'button[aria-label*="Stop" i], button[aria-label*="to‘xtat" i], button[aria-label*="to\'xtat" i], button[aria-label*="toxtat" i], button[aria-label*="Остановить" i], button.stop-button, mat-progress-bar'
                    );

                    // Javob oxiridagi yakuniy amallar (Nusxalash/Copy tugmasi chiqqanmi?)
                    const hasActionButtons = !!latestNewResponse.parentElement?.querySelector(
                        'button[aria-label*="Copy" i], button[aria-label*="Nusxa" i], button[aria-label*="Копировать" i]'
                    );

                    if (text && text === previousText) {
                        stable++;
                    } else {
                        previousText = text;
                        stable = 0;
                    }

                    // 1. Agar JAVOB: [A-D] tegi paydo bo'lsa:
                    // Sekin internetda soxta to'xtab qolishlarga aldanmaslik uchun kamida 4 sikl (1.6s) o'zgarmasligi
                    // yoki Stop tugmasi butunlay yo'qolgan bo'lishi shart!
                    if (hasAnswerTag && ((!isStillGenerating && stable >= 4) || hasActionButtons || stable >= 7)) {
                        clearInterval(timer);
                        const cleanAnswer = extractCleanAnswer(text);
                        resolve(cleanAnswer);
                        return;
                    }

                    // 2. Agar JAVOB tegi bo'lmasa, FAQAT generatsiya butunlay to'xtab, kamida 8 sikl (~3.2 soniya) qimirlamasa:
                    if (!isStillGenerating && (hasActionButtons || stable >= 8) && text.length > 20) {
                        clearInterval(timer);
                        const cleanAnswer = extractCleanAnswer(text);
                        resolve(cleanAnswer);
                        return;
                    }
                }

                // 135 tsikl * 400ms = ~54 soniya maksimal sabr (Sekin internet uchun)
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
