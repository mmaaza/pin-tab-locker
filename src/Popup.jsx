import { useState } from "react";
import "./Popup.css"; // Import the CSS file

function Popup() {
    const [pin, setPin] = useState("");

    const lockTab = async () => {
        if (pin) {
            try {
                let [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true,
                });
                chrome.runtime.sendMessage({
                    action: "lockTab",
                    pin,
                    tabId: tab.id,
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                    } else {
                        console.log(response);
                    }
                });
            } catch (error) {
                console.error("Error locking tab:", error);
            }
        } else {
            console.error("PIN is required to lock the tab.");
        }
    };

    const unlockTab = async () => {
        try {
            let [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            chrome.runtime.sendMessage(
                { action: "unlockTab", pin, tabId: tab.id },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                    } else {
                        alert(response.status);
                    }
                }
            );
        } catch (error) {
            console.error("Error unlocking tab:", error);
        }
    };

    return (
        <div className="popup-container">
            <h2 className="popup-title">
                🔒 Pin Tab Locker
            </h2>
            <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="popup-input"
            />
            <button
                onClick={lockTab}
                className="popup-button lock-button"
            >
                Lock Tab
            </button>
            <button
                onClick={unlockTab}
                className="popup-button unlock-button"
            >
                Unlock Tab
            </button>
        </div>
    );
}

export default Popup;
