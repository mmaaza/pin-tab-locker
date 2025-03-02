chrome.runtime.onInstalled.addListener(() => {
    console.log("Pin Tab Locker extension installed!");
    // Check if values already exist before setting defaults
    chrome.storage.sync.get(['isSetup'], (data) => {
        if (data.isSetup === undefined) {
            // Only set initial values if not already configured
            chrome.storage.sync.set({ 
                globalPin: null,
                securityAnswer: null,
                isSetup: false
            });
            console.log("Initial extension state configured");
        } else {
            console.log("Extension already configured, current setup state:", data.isSetup);
        }
    });
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

    if (message.action === "isPinSetup") {
        chrome.storage.sync.get(["isSetup"], (data) => {
            // Be explicit about the isSetup value, ensure it's a boolean
            const isSetupComplete = data.isSetup === true;
            console.log("isPinSetup check - result:", isSetupComplete);
            sendResponseOnce({ isSetup: isSetupComplete });
        });
    } else if (message.action === "setupGlobalPin") {
        // Handle initial PIN setup with security question
        chrome.storage.sync.set({ 
            globalPin: message.pin,
            securityAnswer: message.securityAnswer.toLowerCase(),
            isSetup: true 
        }, () => {
            sendResponseOnce({ status: "Setup complete", success: true });
        });
    } else if (message.action === "checkStatus") {
        sendResponseOnce({ status: "active" });
    } else if (message.action === "lockTab") {
        // Handle lockTab action
        chrome.storage.sync.get("globalPin", (data) => {
            if (data.globalPin === message.pin) {
                lockedTabs[message.tabId] = true;
                
                // First try to message the content script (if it's already loaded)
                chrome.tabs.sendMessage(message.tabId, { action: "addOverlay" }, (response) => {
                    // If there's an error, the content script may not be loaded yet
                    if (chrome.runtime.lastError) {
                        console.log("Injecting content script for the first time");
                        // Inject the content script
                        chrome.scripting.executeScript({
                            target: { tabId: message.tabId },
                            files: ['contentScript.js']
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error("Script injection error:", chrome.runtime.lastError.message);
                                sendResponseOnce({ status: "error locking tab", error: chrome.runtime.lastError.message });
                            } else {
                                // After injection, explicitly tell it to add the overlay
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(message.tabId, { action: "addOverlay" });
                                }, 100);
                                sendResponseOnce({ status: "tab locked" });
                            }
                        });
                    } else {
                        console.log("Content script already loaded, overlay added");
                        sendResponseOnce({ status: "tab locked" });
                    }
                });
            } else {
                sendResponseOnce({ status: "incorrect PIN" });
            }
        });
    } else if (message.action === "unlockTab") {
        // Handle unlockTab action
        chrome.storage.sync.get("globalPin", (data) => {
            if (data.globalPin === message.pin) {
                delete lockedTabs[message.tabId];
                chrome.tabs.sendMessage(message.tabId, { action: "removeOverlay" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error removing overlay:", chrome.runtime.lastError);
                    }
                    sendResponseOnce({ status: "tab unlocked" });
                });
            } else {
                sendResponseOnce({ status: "incorrect PIN" });
            }
        });
    } else if (message.action === "resetPinWithSecurity") {
        // Handle PIN reset with security question
        chrome.storage.sync.get(["securityAnswer"], (data) => {
            if (data.securityAnswer === message.securityAnswer.toLowerCase()) {
                chrome.storage.sync.set({ globalPin: message.newPin }, () => {
                    sendResponseOnce({ status: "PIN reset", success: true });
                });
            } else {
                sendResponseOnce({ status: "incorrect answer", success: false });
            }
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
