import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./Popup.css";

function BlockedPage() {
    const [pin, setPin] = useState("");
    const [status, setStatus] = useState("");
    const [targetUrl, setTargetUrl] = useState("");
    const [displayDomain, setDisplayDomain] = useState("");
    
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const target = urlParams.get("target");
        if (target) {
            setTargetUrl(target);
            try {
                setDisplayDomain(new URL(target).hostname);
            } catch (e) {
                setDisplayDomain(target);
            }
        }
    }, []);

    const handleUnlockPermanently = () => {
        if (!pin) {
            setStatus("PIN is required");
            return;
        }
        
        // Remove from list
        chrome.runtime.sendMessage({
            action: "unblockUrlFromList",
            pin,
            url: targetUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus("Error: " + chrome.runtime.lastError.message);
            } else {
                if (response.success) {
                    window.location.href = targetUrl;
                } else {
                    setStatus(response.status || "Could not unlock");
                }
            }
        });
    };

    const handleSnooze = () => {
        if (!pin) {
            setStatus("PIN is required");
            return;
        }

        chrome.runtime.sendMessage({
            action: "snoozeUrl",
            pin,
            url: targetUrl,
            minutes: 15
        }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus("Error: " + chrome.runtime.lastError.message);
            } else if (response.success) {
                window.location.href = targetUrl;
            } else {
                setStatus(response.status);
            }
        });
    };

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100vh", backgroundColor: "#1a1a1a", color: "white", padding: "20px", fontFamily: "sans-serif"
        }}>
            <div className="popup-container" style={{ width: "400px", maxWidth: "90%" }}>
                <h1 style={{ textAlign: "center", marginBottom: "5px", fontSize: "2rem" }}>🔒 Tab Blocked</h1>
                <p style={{ textAlign: "center", marginBottom: "20px", color: "#ccc" }}>
                    The site <strong>{displayDomain}</strong> is currently locked.
                </p>
                
                <div className="form-group">
                    <input
                        type="password"
                        placeholder="Enter PIN to unlock"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="popup-input"
                        style={{ padding: "12px", fontSize: "16px" }}
                        autoFocus
                    />
                </div>
                
                <button
                    onClick={handleSnooze}
                    className="popup-button snooze-button"
                    style={{ backgroundColor: "#f39c12", marginBottom: "10px" }}
                >
                    Snooze / Unlock for 15 Min
                </button>
                
                <button
                    onClick={handleUnlockPermanently}
                    className="popup-button unlock-button"
                    style={{ marginBottom: "15px" }}
                >
                    Unlock Permanently
                </button>
                
                {status && <div className="status-message" style={{ textAlign: "center" }}>{status}</div>}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BlockedPage />
    </React.StrictMode>
);
