import { useState } from "react";
import "./Popup.css"; // Import the CSS file

function Popup() {
    const [pin, setPin] = useState("");
    const [status, setStatus] = useState("");

    const setGlobalPin = async () => {
        if (pin) {
            chrome.runtime.sendMessage(
                { action: "setGlobalPin", pin },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        setStatus("Error: " + chrome.runtime.lastError.message);
                    } else {
                        console.log(response);
                        setStatus("PIN set successfully!");
                    }
                }
            );
        } else {
            setStatus("Please enter a PIN first");
        }
    };

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
                        setStatus("Error: " + chrome.runtime.lastError.message);
                    } else {
                        console.log(response);
                        setStatus(response.status);
                    }
                });
            } catch (error) {
                console.error("Error locking tab:", error);
                setStatus("Error locking tab: " + error.message);
            }
        } else {
            setStatus("PIN is required to lock the tab.");
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
                        setStatus("Error: " + chrome.runtime.lastError.message);
                    } else {
                        console.log(response);
                        setStatus(response.status);
                    }
                }
            );
        } catch (error) {
            console.error("Error unlocking tab:", error);
            setStatus("Error unlocking tab: " + error.message);
        }
    };

    const resetPin = async () => {
        chrome.runtime.sendMessage({ action: "resetGlobalPin" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                setStatus("Error: " + chrome.runtime.lastError.message);
            } else {
                console.log(response);
                setStatus("PIN reset successfully!");
            }
        });
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
                onClick={setGlobalPin}
                className="popup-button set-button"
            >
                Set Global PIN
            </button>
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
            <button
                onClick={resetPin}
                className="popup-button reset-button"
            >
                Reset PIN
            </button>
            
            {status && (
                <div className="status-message">
                    {status}
                </div>
            )}
        </div>
    );
}

export default Popup;
