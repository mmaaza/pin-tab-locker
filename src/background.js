chrome.runtime.onInstalled.addListener(() => {
    console.log("Pin Tab Locker extension installed!");
    chrome.storage.sync.set({ globalPin: null });
});

let lockedTabs = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let responseSent = false;

    const sendResponseOnce = (response) => {
        if (!responseSent) {
            sendResponse(response);
            responseSent = true;
        }
    };

    if (message.action === "checkStatus") {
        sendResponseOnce({ status: "active" });
    } else if (message.action === "setGlobalPin") {
        // Handle setting the global PIN
        chrome.storage.sync.set({ globalPin: message.pin }, () => {
            sendResponseOnce({ status: "PIN set" });
        });
    } else if (message.action === "lockTab") {
        // Handle lockTab action
        chrome.storage.sync.get("globalPin", (data) => {
            if (data.globalPin === message.pin) {
                lockedTabs[message.tabId] = true;
                chrome.scripting.executeScript({
                    target: { tabId: message.tabId },
                    files: ['contentScript.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                    }
                });
                sendResponseOnce({ status: "tab locked" });
            } else {
                sendResponseOnce({ status: "incorrect PIN" });
            }
        });
    } else if (message.action === "unlockTab") {
        // Handle unlockTab action
        chrome.storage.sync.get("globalPin", (data) => {
            if (data.globalPin === message.pin) {
                delete lockedTabs[message.tabId];
                chrome.tabs.sendMessage(message.tabId, { action: "removeOverlay" });
                sendResponseOnce({ status: "tab unlocked" });
            } else {
                sendResponseOnce({ status: "incorrect PIN" });
            }
        });
    } else if (message.action === "resetGlobalPin") {
        // Handle resetting the global PIN
        chrome.storage.sync.set({ globalPin: null }, () => {
            sendResponseOnce({ status: "PIN reset" });
        });
    } else {
        sendResponseOnce({ status: "unknown action" });
    }
    return true; // Indicate that the response is asynchronous
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (lockedTabs[tabId] && changeInfo.url) {
        chrome.tabs.update(tabId, { url: tab.url });
        alert("This tab is locked and cannot be changed.");
    }
});
