import { useState, useEffect } from "react";
import "./Popup.css";
import SetupPin from "./SetupPin";

function Popup() {
    const [pin, setPin] = useState("");
    const [status, setStatus] = useState("");
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isResetting, setIsResetting] = useState(false);
    const [securityAnswer, setSecurityAnswer] = useState("");
    const [newPin, setNewPin] = useState("");
    const [confirmNewPin, setConfirmNewPin] = useState("");

    // Check if global PIN is already set
    useEffect(() => {
        console.log("Checking if PIN is setup...");
        setIsLoading(true);
        
        chrome.runtime.sendMessage({ action: "isPinSetup" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error checking PIN setup:", chrome.runtime.lastError);
            } else {
                console.log("PIN setup response:", response);
                setIsSetupComplete(response && response.isSetup === true);
            }
            setIsLoading(false);
        });
    }, []);

    const handleSetupComplete = () => {
        setIsSetupComplete(true);
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
                        setStatus("Error: " + chrome.runtime.lastError.message);
                    } else {
                        setStatus(response.status);
                    }
                });
            } catch (error) {
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
                        setStatus("Error: " + chrome.runtime.lastError.message);
                    } else {
                        setStatus(response.status);
                    }
                }
            );
        } catch (error) {
            setStatus("Error unlocking tab: " + error.message);
        }
    };

    const startPinReset = () => {
        setIsResetting(true);
        setStatus("");
    };

    const cancelPinReset = () => {
        setIsResetting(false);
        setSecurityAnswer("");
        setNewPin("");
        setConfirmNewPin("");
        setStatus("");
    };

    const resetPin = async () => {
        if (!securityAnswer) {
            setStatus("Security answer is required");
            return;
        }

        if (!newPin) {
            setStatus("New PIN is required");
            return;
        }

        if (newPin !== confirmNewPin) {
            setStatus("PINs do not match");
            return;
        }

        chrome.runtime.sendMessage({ 
            action: "resetPinWithSecurity",
            securityAnswer,
            newPin 
        }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus("Error: " + chrome.runtime.lastError.message);
            } else {
                if (response.success) {
                    setStatus("PIN reset successfully!");
                    setIsResetting(false);
                    setSecurityAnswer("");
                    setNewPin("");
                    setConfirmNewPin("");
                } else {
                    setStatus("Incorrect security answer");
                }
            }
        });
    };

    // Show loading state
    if (isLoading) {
        return (
            <div className="popup-container">
                <p>Loading...</p>
            </div>
        );
    }

    if (!isSetupComplete) {
        return <SetupPin onSetupComplete={handleSetupComplete} />;
    }

    if (isResetting) {
        return (
            <div className="popup-container">
                <h2 className="popup-title">🔄 Reset PIN</h2>
                
                <div className="form-group">
                    <label className="security-question">
                        What's your place of birth?
                    </label>
                    <input
                        type="text"
                        placeholder="Security Answer"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="popup-input"
                    />
                </div>

                <div className="form-group">
                    <input
                        type="password"
                        placeholder="New PIN"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="popup-input"
                    />
                </div>

                <div className="form-group">
                    <input
                        type="password"
                        placeholder="Confirm New PIN"
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value)}
                        className="popup-input"
                    />
                </div>
                
                {status && <div className="status-message">{status}</div>}
                
                <div className="button-group">
                    <button
                        onClick={resetPin}
                        className="popup-button reset-button"
                    >
                        Reset PIN
                    </button>
                    <button
                        onClick={cancelPinReset}
                        className="popup-button cancel-button"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

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
            <button
                onClick={startPinReset}
                className="popup-button forgot-button"
            >
                Forgot PIN?
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
