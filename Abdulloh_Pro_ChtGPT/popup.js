
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle');
    const statusText = document.getElementById('statusText');

    chrome.storage.local.get("enabled", (data) => {
        toggle.checked = data.enabled;
        updateUI(data.enabled);
    });

    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ enabled: isEnabled }, () => {
            updateUI(isEnabled);
           
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "toggle", state: isEnabled });
                }
            });
        });
    });

    function updateUI(isEnabled) {
        statusText.innerText = isEnabled ? "FAOL" : "NOFAOL";
        statusText.style.color = isEnabled ? "#00ff00" : "#ff0000";
    }
});
