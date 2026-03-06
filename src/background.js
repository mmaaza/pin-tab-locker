chrome.runtime.onInstalled.addListener(() => {
    console.log("Pin Tab Locker extension installed!");
    // Check if values already exist before setting defaults
    chrome.storage.sync.get(['isSetup'], (data) => {
        if (data.isSetup === undefined) {
            // Only set initial values if not already configured
            chrome.storage.sync.set({ 
                globalPin: null,
                securityAnswer: null,
                isSetup: false,
                blockedUrls: [], // Store blocked URLs here
                scheduledBlocks: [] // Store scheduled blocks
            });
            console.log("Initial extension state configured");
        } else {
            console.log("Extension already configured, current setup state:", data.isSetup);
        }
    });
    
    // Set up alarm for checking scheduled blocks
    chrome.alarms.create("checkScheduledBlocks", {
        periodInMinutes: 1
    });
});

// Function to normalize URLs to extract base domain
function normalizeUrl(url) {
    try {
        // Create a URL object to handle different formats
        const urlObj = new URL(url);
        // Return just the hostname (domain) for domain-level blocking
        return urlObj.hostname;
    } catch (e) {
        console.error("Error normalizing URL:", e);
        return url; // Return original if parsing fails
    }
}

// Check if a URL's domain is blocked
function isUrlBlocked(url) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['blockedUrls', 'scheduledBlocks'], (data) => {
            const blockedUrls = data.blockedUrls || [];
            const scheduledBlocks = data.scheduledBlocks || [];
            const normalizedTestDomain = normalizeUrl(url);
            
            // Check if the domain is in the blocked list
            for (const blockedUrl of blockedUrls) {
                const blockedDomain = normalizeUrl(blockedUrl);
                if (normalizedTestDomain === blockedDomain) {
                    resolve(true);
                    return;
                }
            }
            
            // Check if domain is currently scheduled for blocking
            const isScheduledBlocked = isScheduledBlockActive(normalizedTestDomain, scheduledBlocks);
            if (isScheduledBlocked) {
                resolve(true);
                return;
            }
            
            resolve(false);
        });
    });
}

// Check if any scheduled block is currently active for the domain
function isScheduledBlockActive(domain, scheduledBlocks) {
    if (!scheduledBlocks || scheduledBlocks.length === 0) return false;
    
    const now = new Date();
    const currentDay = now.getDay(); // 0-6 (Sunday-Saturday)
    
    // Format: HH:MM in 24-hour
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0');
    
    for (const block of scheduledBlocks) {
        if (!block.enabled) continue;
        
        // Check if domain matches (simple string match for now)
        if (domain.includes(block.domainPattern) || block.domainPattern === '*') {
            // Check if today is a blocked day
            if (block.days.includes(currentDay)) {
                // Check if current time is within blocked hours
                if (currentTime >= block.startTime && currentTime <= block.endTime) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

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
    } else if (message.action === "blockUrl") {
        // Handle blockUrl action (replacing lockTab)
        chrome.storage.sync.get(["globalPin", "blockedUrls"], (data) => {
            if (data.globalPin === message.pin) {
                // Get the current tab's URL
                chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    if (tabs && tabs.length > 0) {
                        const currentUrl = tabs[0].url;
                        const tabId = tabs[0].id;
                        
                        // Extract the domain for blocking
                        const domain = normalizeUrl(currentUrl);
                        
                        // Add domain to blocked list if not already blocked
                        let blockedUrls = data.blockedUrls || [];
                        
                        // Check if domain is already blocked
                        const isAlreadyBlocked = blockedUrls.some(blockedUrl => 
                            normalizeUrl(blockedUrl) === domain
                        );
                        
                        if (!isAlreadyBlocked) {
                            // Store the full URL but will match by domain
                            blockedUrls.push(currentUrl);
                            chrome.storage.sync.set({ blockedUrls }, () => {
                                console.log("Domain blocked:", domain, "Original URL:", currentUrl);
                                
                                // Apply overlay to current tab
                                chrome.tabs.sendMessage(tabId, { action: "addOverlay" }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        console.log("Injecting content script for blocked domain");
                                        chrome.scripting.executeScript({
                                            target: { tabId },
                                            files: ['contentScript.js']
                                        }, () => {
                                            if (chrome.runtime.lastError) {
                                                console.error("Script injection error:", chrome.runtime.lastError.message);
                                                sendResponseOnce({ status: "error blocking domain", error: chrome.runtime.lastError.message });
                                            } else {
                                                setTimeout(() => {
                                                    chrome.tabs.sendMessage(tabId, { action: "addOverlay" });
                                                }, 100);
                                                sendResponseOnce({ status: "Domain blocked" });
                                            }
                                        });
                                    } else {
                                        sendResponseOnce({ status: "Domain blocked" });
                                    }
                                });
                            });
                        } else {
                            sendResponseOnce({ status: "Domain already blocked" });
                        }
                    } else {
                        sendResponseOnce({ status: "no active tab found" });
                    }
                });
            } else {
                sendResponseOnce({ status: "incorrect PIN" });
            }
        });
    } else if (message.action === "unblockUrl") {
        // Handle unblockUrl action (replacing unlockTab)
        chrome.storage.sync.get(["globalPin", "blockedUrls"], (data) => {
            if (data.globalPin === message.pin) {
                // Get the current tab's URL
                chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    if (tabs && tabs.length > 0) {
                        const currentUrl = tabs[0].url;
                        const tabId = tabs[0].id;
                        const currentDomain = normalizeUrl(currentUrl);
                        
                        // Remove the domain from blocked list
                        let blockedUrls = data.blockedUrls || [];
                        const filteredUrls = blockedUrls.filter(url => 
                            normalizeUrl(url) !== currentDomain
                        );
                        
                        if (filteredUrls.length < blockedUrls.length) {
                            chrome.storage.sync.set({ blockedUrls: filteredUrls }, () => {
                                console.log("Domain unblocked:", currentDomain);
                                
                                // Remove overlay from the current tab
                                chrome.tabs.sendMessage(tabId, { action: "removeOverlay" }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        console.error("Error removing overlay:", chrome.runtime.lastError);
                                    }
                                    sendResponseOnce({ status: "Domain unblocked" });
                                });
                            });
                        } else {
                            sendResponseOnce({ status: "Domain not found in blocked list" });
                        }
                    } else {
                        sendResponseOnce({ status: "no active tab found" });
                    }
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
    } else if (message.action === "checkIfUrlBlocked") {
        // New action to check if current URL is blocked
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs && tabs.length > 0) {
                const currentUrl = tabs[0].url;
                const isBlocked = await isUrlBlocked(currentUrl);
                sendResponseOnce({ isBlocked });
            } else {
                sendResponseOnce({ isBlocked: false });
            }
        });
    } else if (message.action === "unblockUrlFromList") {
        // Handle unblocking a specific URL from the list view
        chrome.storage.sync.get(["globalPin", "blockedUrls"], (data) => {
            if (data.globalPin === message.pin) {
                // Remove the specified URL from the blocked list
                let blockedUrls = data.blockedUrls || [];
                const normalizedUrl = normalizeUrl(message.url);
                
                const filteredUrls = blockedUrls.filter(url => 
                    normalizeUrl(url) !== normalizedUrl
                );
                
                if (filteredUrls.length < blockedUrls.length) {
                    chrome.storage.sync.set({ blockedUrls: filteredUrls }, () => {
                        console.log("URL unblocked from list:", message.url);
                        sendResponseOnce({ 
                            status: "URL unblocked successfully", 
                            success: true 
                        });
                    });
                } else {
                    sendResponseOnce({ 
                        status: "URL not found in blocked list", 
                        success: false 
                    });
                }
            } else {
                sendResponseOnce({ 
                    status: "Incorrect PIN", 
                    success: false 
                });
            }
        });
    } else if (message.action === "addScheduledBlock") {
        chrome.storage.sync.get(["globalPin", "scheduledBlocks"], (data) => {
            if (data.globalPin === message.pin) {
                const scheduledBlocks = data.scheduledBlocks || [];
                
                // Generate unique ID
                const newBlock = {
                    ...message.block,
                    id: Date.now().toString()
                };
                
                scheduledBlocks.push(newBlock);
                chrome.storage.sync.set({ scheduledBlocks }, () => {
                    sendResponseOnce({ 
                        status: "Schedule added", 
                        success: true,
                        id: newBlock.id
                    });
                });
            } else {
                sendResponseOnce({ status: "incorrect PIN", success: false });
            }
        });
    }
    else if (message.action === "getScheduledBlocks") {
        chrome.storage.sync.get(["scheduledBlocks"], (data) => {
            sendResponseOnce({ 
                blocks: data.scheduledBlocks || [],
                success: true
            });
        });
    }
    else if (message.action === "updateScheduledBlock") {
        chrome.storage.sync.get(["globalPin", "scheduledBlocks"], (data) => {
            if (data.globalPin === message.pin) {
                const scheduledBlocks = data.scheduledBlocks || [];
                const index = scheduledBlocks.findIndex(block => block.id === message.block.id);
                
                if (index !== -1) {
                    scheduledBlocks[index] = message.block;
                    chrome.storage.sync.set({ scheduledBlocks }, () => {
                        sendResponseOnce({ 
                            status: "Schedule updated", 
                            success: true 
                        });
                    });
                } else {
                    sendResponseOnce({ 
                        status: "Schedule not found", 
                        success: false 
                    });
                }
            } else {
                sendResponseOnce({ status: "incorrect PIN", success: false });
            }
        });
    }
    else if (message.action === "deleteScheduledBlock") {
        chrome.storage.sync.get(["globalPin", "scheduledBlocks"], (data) => {
            if (data.globalPin === message.pin) {
                const scheduledBlocks = data.scheduledBlocks || [];
                const filteredBlocks = scheduledBlocks.filter(block => block.id !== message.blockId);
                
                if (filteredBlocks.length < scheduledBlocks.length) {
                    chrome.storage.sync.set({ scheduledBlocks: filteredBlocks }, () => {
                        sendResponseOnce({ 
                            status: "Schedule deleted", 
                            success: true 
                        });
                    });
                } else {
                    sendResponseOnce({ 
                        status: "Schedule not found", 
                        success: false 
                    });
                }
            } else {
                sendResponseOnce({ status: "incorrect PIN", success: false });
            }
        });
    }
    else {
        sendResponseOnce({ status: "unknown action" });
    }
    return true; // Indicate that the response is asynchronous
});

// Listen for tab updates to check for blocked URLs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only check when the URL is updated or page is loaded
    if (changeInfo.url || changeInfo.status === 'complete') {
        const url = tab.url || changeInfo.url;
        
        if (url) {
            const isBlocked = await isUrlBlocked(url);
            
            if (isBlocked) {
                console.log("Blocked URL detected:", url);
                
                // Apply the overlay
                chrome.tabs.sendMessage(tabId, { action: "addOverlay" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Injecting content script for blocked URL");
                        chrome.scripting.executeScript({
                            target: { tabId },
                            files: ['contentScript.js']
                        }, () => {
                            if (!chrome.runtime.lastError) {
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabId, { action: "addOverlay" });
                                }, 100);
                            }
                        });
                    }
                });
            }
        }
    }
});

// Handle alarms for checking scheduled blocks
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "checkScheduledBlocks") {
        // Get all tabs
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            if (tab.url) {
                const isBlocked = await isUrlBlocked(tab.url);
                
                // Try to get current block state of the tab
                chrome.tabs.sendMessage(tab.id, { action: "checkOverlayStatus" }, (response) => {
                    const hasOverlay = response && response.hasOverlay;
                    
                    // If should be blocked but doesn't have overlay
                    if (isBlocked && !hasOverlay) {
                        chrome.tabs.sendMessage(tab.id, { action: "addOverlay" }, (response) => {
                            if (chrome.runtime.lastError) {
                                // Inject script if not already there
                                chrome.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    files: ['contentScript.js']
                                }, () => {
                                    if (!chrome.runtime.lastError) {
                                        setTimeout(() => {
                                            chrome.tabs.sendMessage(tab.id, { action: "addOverlay" });
                                        }, 100);
                                    }
                                });
                            }
                        });
                    }
                    // If shouldn't be blocked but has overlay
                    else if (!isBlocked && hasOverlay) {
                        chrome.tabs.sendMessage(tab.id, { action: "removeOverlay" });
                    }
                });
            }
        }
    }
});
