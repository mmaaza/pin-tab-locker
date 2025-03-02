// Keep track of whether the overlay is currently displayed
let overlayActive = false;
let overlay = null;

// Function to create and add the overlay
function addOverlay() {
    if (overlayActive) return; // Don't add if already active
    
    console.log("Adding overlay to locked tab");
    
    // Create overlay element if it doesn't exist
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "pin-tab-locker-overlay";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.95);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: sans-serif;
        `;
        
        const lockIcon = document.createElement("div");
        lockIcon.textContent = "🔒";
        lockIcon.style.cssText = `
            font-size: 48px;
            margin-bottom: 20px;
        `;
        
        const message = document.createElement("div");
        message.textContent = "This tab is locked";
        message.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        `;
        
        const subMessage = document.createElement("div");
        subMessage.textContent = "Enter your PIN in the extension popup to unlock";
        subMessage.style.cssText = `
            font-size: 16px;
        `;
        
        overlay.appendChild(lockIcon);
        overlay.appendChild(message);
        overlay.appendChild(subMessage);
    }
    
    // Add overlay to the document
    document.body.appendChild(overlay);
    overlayActive = true;
    
    // Disable scrolling on the body
    document.body.style.overflow = "hidden";
}

// Function to remove the overlay
function removeOverlay() {
    if (!overlayActive || !overlay) return; // Don't try to remove if not active
    
    console.log("Removing overlay from tab");
    
    // Remove the overlay from the document
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
    overlayActive = false;
    
    // Restore scrolling
    document.body.style.overflow = "";
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message.action);
    
    if (message.action === "addOverlay") {
        addOverlay();
        sendResponse({ status: "overlay added" });
    } else if (message.action === "removeOverlay") {
        removeOverlay();
        sendResponse({ status: "overlay removed" });
    }
    
    return true; // Required for async response
});

// Automatically add the overlay when the script is first loaded
// This handles the initial lock case
addOverlay();

// Prevent the page from being closed/navigated away from
window.addEventListener('beforeunload', (e) => {
    if (overlayActive) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

console.log("Pin Tab Locker content script loaded");
