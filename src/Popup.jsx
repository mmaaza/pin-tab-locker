import { useState, useEffect } from "react";
import "./Popup.css";
import SetupPin from "./SetupPin";

function Popup() {
    const [pin, setPin] = useState("");
    const [status, setStatus] = useState("");
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUrl, setCurrentUrl] = useState("");
    const [isUrlBlocked, setIsUrlBlocked] = useState(false);

    useEffect(() => {
        chrome.runtime.sendMessage({ action: "isPinSetup" }, (response) => {
            setIsSetupComplete(response && response.isSetup === true);
            setIsLoading(false);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0 && tabs[0].url) {
                // Ignore extension pages for currentUrl baseline
                if (!tabs[0].url.startsWith('chrome-extension://')) {
                    setCurrentUrl(tabs[0].url);
                }
                
                chrome.runtime.sendMessage({ action: "checkIfUrlBlocked", url: tabs[0].url }, (response) => {
                    if (response) {
                        setIsUrlBlocked(response.isBlocked);
                        // If it is blocked.html, extract the target
                        if (tabs[0].url.includes('blocked.html?target=')) {
                            const params = new URLSearchParams(new URL(tabs[0].url).search);
                            setCurrentUrl(params.get('target') || "Blocked Page");
                            setIsUrlBlocked(true);
                        }
                    }
                });
            }
        });
    }, []);

    const handleSetupComplete = () => {
        setIsSetupComplete(true);
    };

    const blockUrl = async () => {
        if (pin) {
            chrome.runtime.sendMessage({ action: "blockUrl", pin }, (response) => {
                if (chrome.runtime.lastError) {
                    setStatus("Error: " + chrome.runtime.lastError.message);
                } else {
                    setStatus(response.status);
                    if (response.success) setIsUrlBlocked(true);
                }
            });
        } else {
            setStatus("PIN is required to block the domain.");
        }
    };

    const openOptions = () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    };

    if (isLoading) return <div className="popup-container"><p>Loading...</p></div>;
    if (!isSetupComplete) return <SetupPin onSetupComplete={handleSetupComplete} />;

    let displayUrl = "current site";
    try {
        if (currentUrl) displayUrl = new URL(currentUrl).hostname;
    } catch(e) {}

    return (
        <div className="popup-container">
            <h2 className="popup-title">
                <span className="title-icon">🔒</span>
                <span className="title-text">Tab Lockr</span>
            </h2>

            <div className="current-url">
                {displayUrl}
            </div>

            <div className="form-group">
                <input
                    type="password"
                    placeholder="Enter PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="popup-input"
                    autoFocus
                />
            </div>

            {!isUrlBlocked ? (
                <button onClick={blockUrl} className="popup-button lock-button">
                    Block Domain
                </button>
            ) : (
                <div style={{ textAlign: "center", marginBottom: "15px", color: "#f39c12", padding: "10px", backgroundColor: "#2d2005", borderRadius: "5px" }}>
                    🔒 This domain is blocked.<br/> Unlock it from the options settings!
                </div>
            )}

            <button onClick={openOptions} className="popup-button list-button" style={{ marginTop: "10px" }}>
                ⚙️ Open Full Settings
            </button>

            {status && <div className="status-message">{status}</div>}
        </div>
    );
}

export default Popup;
