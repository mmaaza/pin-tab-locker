import { hashString, verifyHash } from './utils/crypto.js';

// Internal state for snoozed domains.
// Map of domain -> expiry timestamp (ms)
const snoozedDomains = new Map();

// Helper to clean up expired snoozes
function cleanupSnoozes() {
    const now = Date.now();
    for (const [domain, expiry] of snoozedDomains.entries()) {
        if (now > expiry) {
            snoozedDomains.delete(domain);
        }
    }
}

// Simple brute-force prevention
let failedAttempts = 0;
let lockoutUntil = 0;

chrome.runtime.onInstalled.addListener(() => {
    console.log("Pin Tab Locker extension installed/updated!");
    chrome.storage.sync.get(['isSetup'], (data) => {
        if (!data.isSetup) {
            chrome.storage.sync.set({ 
                globalPinHash: null,
                securityAnswerHash: null,
                isSetup: false,
                blockedUrls: [], 
                scheduledBlocks: []
            });
            console.log("Initial extension state configured");
        } else {
            // Check for migration from plaintext to hash
            chrome.storage.sync.get(['globalPin', 'globalPinHash'], (oldData) => {
                if (oldData.globalPin && !oldData.globalPinHash) {
                    console.warn("Found plaintext PIN, migrating to hashed PIN is not possible securely without knowing it, so we wipe state to force setup.");
                    chrome.storage.sync.set({
                        globalPin: null, // Clear plaintext
                        securityAnswer: null, // Clear plaintext
                        globalPinHash: null,
                        securityAnswerHash: null,
                        isSetup: false
                    });
                }
            });
        }
    });
    
    chrome.alarms.create("checkScheduledBlocks", { periodInMinutes: 1 });
    chrome.alarms.create("cleanupSnoozes", { periodInMinutes: 5 });
});

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

// Convert a wildcard pattern (e.g. *.example.com) to a Regex
function patternToRegExp(pattern) {
    if (pattern === '*') return new RegExp('.*');
    const escaped = pattern.split('*').map(escapeRegExp).join('.*');
    return new RegExp('^' + escaped + '$', 'i');
}

function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return url; 
    }
}

// Check if a URL's domain is blocked
async function isUrlBlocked(url) {
    // Never block extension pages
    if (url.startsWith('chrome-extension://')) return false;

    // Clean up snoozes before checking
    cleanupSnoozes();

    const normalizedTestDomain = normalizeUrl(url);
    
    // Check if domain is currently snoozed
    if (snoozedDomains.has(normalizedTestDomain)) {
        if (Date.now() < snoozedDomains.get(normalizedTestDomain)) {
            return false; // Currently snoozed
        } else {
            snoozedDomains.delete(normalizedTestDomain); // Expired
        }
    }

    return new Promise((resolve) => {
        chrome.storage.sync.get(['blockedUrls', 'scheduledBlocks'], (data) => {
            const blockedUrls = data.blockedUrls || [];
            const scheduledBlocks = data.scheduledBlocks || [];
            
            // 1. Check blockedUrls list (supports wildcards)
            for (const blockedItem of blockedUrls) {
                const regex = patternToRegExp(blockedItem);
                if (regex.test(normalizedTestDomain)) {
                    resolve(true);
                    return;
                }
            }
            
            // 2. Check scheduled blocks
            const isScheduledBlocked = isScheduledBlockActive(normalizedTestDomain, scheduledBlocks);
            if (isScheduledBlocked) {
                resolve(true);
                return;
            }
            
            resolve(false);
        });
    });
}

// Fixed function for scheduled domains
function isScheduledBlockActive(domain, scheduledBlocks) {
    if (!scheduledBlocks || scheduledBlocks.length === 0) return false;
    
    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0');
    
    for (const block of scheduledBlocks) {
        if (!block.enabled) continue;
        
        const regex = patternToRegExp(block.domainPattern);
        if (regex.test(domain)) {
            if (block.days.includes(currentDay)) {
                // If start is less than end (e.g., 09:00 to 17:00)
                if (block.startTime <= block.endTime) {
                    if (currentTime >= block.startTime && currentTime <= block.endTime) {
                        return true;
                    }
                } else {
                    // Overnight block (e.g., 22:00 to 02:00)
                    if (currentTime >= block.startTime || currentTime <= block.endTime) {
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let responseSent = false;
    const sendResponseOnce = (response) => {
        if (!responseSent) {
            sendResponse(response);
            responseSent = true;
        }
    };

    const handlePinCheck = async (pin, callback) => {
        if (Date.now() < lockoutUntil) {
            sendResponseOnce({ status: "Locked out. Try again later.", success: false });
            return;
        }

        const data = await chrome.storage.sync.get(["globalPinHash"]);
        const isValid = await verifyHash(pin, data.globalPinHash);
        
        if (isValid) {
            failedAttempts = 0;
            callback();
        } else {
            failedAttempts++;
            if (failedAttempts >= 5) {
                // 5 minute lockout
                lockoutUntil = Date.now() + 5 * 60 * 1000;
                sendResponseOnce({ status: "Too many failed attempts. Locked out for 5 minutes.", success: false });
            } else {
                sendResponseOnce({ status: "incorrect PIN", success: false });
            }
        }
    };

    if (message.action === "isPinSetup") {
        chrome.storage.sync.get(["isSetup"], (data) => {
            sendResponseOnce({ isSetup: data.isSetup === true });
        });
        return true;
    } 
    else if (message.action === "setupGlobalPin") {
        (async () => {
            const pinHash = await hashString(message.pin);
            const answerHash = await hashString(message.securityAnswer.toLowerCase().trim());
            
            chrome.storage.sync.set({ 
                globalPinHash: pinHash,
                securityAnswerHash: answerHash,
                globalPin: null, // ensure clear
                securityAnswer: null, // ensure clear
                isSetup: true 
            }, () => {
                sendResponseOnce({ status: "Setup complete", success: true });
            });
        })();
        return true;
    } 
    else if (message.action === "blockUrl") {
        handlePinCheck(message.pin, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (tabs && tabs.length > 0) {
                    const currentUrl = tabs[0].url;
                    const domain = normalizeUrl(currentUrl);
                    
                    const data = await chrome.storage.sync.get(["blockedUrls"]);
                    let blockedUrls = data.blockedUrls || [];
                    
                    if (!blockedUrls.includes(domain)) {
                        blockedUrls.push(domain); // Store domain instead of full URL
                        chrome.storage.sync.set({ blockedUrls }, () => {
                            // Immediately enforce block
                            chrome.tabs.update(tabs[0].id, { 
                                url: chrome.runtime.getURL(`blocked.html?target=${encodeURIComponent(currentUrl)}`) 
                            });
                            sendResponseOnce({ status: "Domain blocked", success: true });
                        });
                    } else {
                        sendResponseOnce({ status: "Domain already blocked", success: true });
                    }
                } else {
                    sendResponseOnce({ status: "no active tab found", success: false });
                }
            });
        });
        return true;
    } 
    else if (message.action === "unblockUrlFromList" || message.action === "unblockUrl") {
        handlePinCheck(message.pin, async () => {
            const data = await chrome.storage.sync.get(["blockedUrls"]);
            let blockedUrls = data.blockedUrls || [];
            
            // message.url could be a domain or a pattern
            const targetUrl = message.url || message.domain; 
            const normalizedUrl = normalizeUrl(targetUrl);
            
            const filteredUrls = blockedUrls.filter(url => normalizeUrl(url) !== normalizedUrl);
            
            if (filteredUrls.length < blockedUrls.length) {
                chrome.storage.sync.set({ blockedUrls: filteredUrls }, () => {
                    sendResponseOnce({ status: "URL unblocked successfully", success: true });
                });
            } else {
                sendResponseOnce({ status: "URL not found in blocked list", success: false });
            }
        });
        return true;
    } 
    else if (message.action === "snoozeUrl") {
        handlePinCheck(message.pin, () => {
            const domain = normalizeUrl(message.url);
            const snoozeMinutes = message.minutes || 15;
            
            // Calculate expiry timestamp
            const expiry = Date.now() + (snoozeMinutes * 60 * 1000);
            snoozedDomains.set(domain, expiry);
            
            sendResponseOnce({ status: `Snoozed for ${snoozeMinutes} minutes`, success: true });
        });
        return true;
    }
    else if (message.action === "resetPinWithSecurity") {
        (async () => {
            if (!message.securityAnswer) {
                sendResponseOnce({ status: "Security answer required", success: false });
                return;
            }
            
            const data = await chrome.storage.sync.get(["securityAnswerHash"]);
            const isValid = await verifyHash(message.securityAnswer.toLowerCase().trim(), data.securityAnswerHash);
            
            if (isValid) {
                const newPinHash = await hashString(message.newPin);
                chrome.storage.sync.set({ globalPinHash: newPinHash }, () => {
                    sendResponseOnce({ status: "PIN reset successfully!", success: true });
                });
            } else {
                sendResponseOnce({ status: "Incorrect security answer", success: false });
            }
        })();
        return true;
    } 
    else if (message.action === "checkIfUrlBlocked") {
        (async () => {
            const urlToCheck = message.url;
            if (urlToCheck) {
                const isBlocked = await isUrlBlocked(urlToCheck);
                sendResponseOnce({ isBlocked });
            } else {
                 chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    if (tabs && tabs.length > 0) {
                        const isBlocked = await isUrlBlocked(tabs[0].url);
                        sendResponseOnce({ isBlocked, url: tabs[0].url });
                    } else {
                        sendResponseOnce({ isBlocked: false });
                    }
                });
            }
        })();
        return true;
    } 
    else if (message.action === "addScheduledBlock") {
        handlePinCheck(message.pin, async () => {
            const data = await chrome.storage.sync.get(["scheduledBlocks"]);
            const scheduledBlocks = data.scheduledBlocks || [];
            
            const newBlock = {
                ...message.block,
                id: Date.now().toString()
            };
            
            scheduledBlocks.push(newBlock);
            chrome.storage.sync.set({ scheduledBlocks }, () => {
                sendResponseOnce({ status: "Schedule added", success: true, id: newBlock.id });
            });
        });
        return true;
    }
    else if (message.action === "getScheduledBlocks") {
        chrome.storage.sync.get(["scheduledBlocks"], (data) => {
            sendResponseOnce({ blocks: data.scheduledBlocks || [], success: true });
        });
        return true;
    }
    else if (message.action === "updateScheduledBlock") {
        handlePinCheck(message.pin, async () => {
            const data = await chrome.storage.sync.get(["scheduledBlocks"]);
            const scheduledBlocks = data.scheduledBlocks || [];
            const index = scheduledBlocks.findIndex(b => b.id === message.block.id);
            
            if (index !== -1) {
                scheduledBlocks[index] = message.block;
                chrome.storage.sync.set({ scheduledBlocks }, () => {
                    sendResponseOnce({ status: "Schedule updated", success: true });
                });
            } else {
                sendResponseOnce({ status: "Schedule not found", success: false });
            }
        });
        return true;
    }
    else if (message.action === "deleteScheduledBlock") {
        handlePinCheck(message.pin, async () => {
            const data = await chrome.storage.sync.get(["scheduledBlocks"]);
            const scheduledBlocks = data.scheduledBlocks || [];
            const filteredBlocks = scheduledBlocks.filter(b => b.id !== message.blockId);
            
            if (filteredBlocks.length < scheduledBlocks.length) {
                chrome.storage.sync.set({ scheduledBlocks: filteredBlocks }, () => {
                    sendResponseOnce({ status: "Schedule deleted", success: true });
                });
            } else {
                sendResponseOnce({ status: "Schedule not found", success: false });
            }
        });
        return true;
    }

    sendResponseOnce({ status: "unknown action" });
    return false;
});

// Listener for tab updates to force redirect on blocked URLs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'loading') {
        const url = changeInfo.url || tab.url;
        
        if (url) {
            const isBlocked = await isUrlBlocked(url);
            
            if (isBlocked) {
                console.log("Blocked URL detected, redirecting:", url);
                const blockedUrlStr = chrome.runtime.getURL(`blocked.html?target=${encodeURIComponent(url)}`);
                // Avoid infinite loop if we are already on blocked page
                if (url !== blockedUrlStr && !url.startsWith(chrome.runtime.getURL('blocked.html'))) {
                    chrome.tabs.update(tabId, { url: blockedUrlStr });
                }
            }
        }
    }
});

// Check all tabs when the alarm fires
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "checkScheduledBlocks") {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.url) {
                const isBlocked = await isUrlBlocked(tab.url);
                if (isBlocked && !tab.url.startsWith(chrome.runtime.getURL('blocked.html'))) {
                    const blockedUrlStr = chrome.runtime.getURL(`blocked.html?target=${encodeURIComponent(tab.url)}`);
                    chrome.tabs.update(tab.id, { url: blockedUrlStr });
                }
            }
        }
    } else if (alarm.name === "cleanupSnoozes") {
        cleanupSnoozes();
    }
});
