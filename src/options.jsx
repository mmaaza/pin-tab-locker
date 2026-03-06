import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./Popup.css";
import BlockedUrlsList from "./BlockedUrlsList";
import ScheduledBlocks from "./ScheduledBlocks";

function OptionsPage() {
    const [activeTab, setActiveTab] = useState("blocked");
    const [securityAnswer, setSecurityAnswer] = useState("");
    const [newPin, setNewPin] = useState("");
    const [confirmNewPin, setConfirmNewPin] = useState("");
    const [resetStatus, setResetStatus] = useState("");
    const [isSetupComplete, setIsSetupComplete] = useState(true); // Assume true, otherwise show error

    useEffect(() => {
        chrome.runtime.sendMessage({ action: "isPinSetup" }, (response) => {
            if (response && response.isSetup) {
                setIsSetupComplete(true);
            } else {
                setIsSetupComplete(false);
            }
        });
    }, []);

    const resetPin = async () => {
        if (!securityAnswer || !newPin) {
            setResetStatus("All fields are required");
            return;
        }

        if (newPin !== confirmNewPin) {
            setResetStatus("PINs do not match");
            return;
        }

        chrome.runtime.sendMessage({ 
            action: "resetPinWithSecurity",
            securityAnswer,
            newPin 
        }, (response) => {
            if (chrome.runtime.lastError) {
                setResetStatus("Error: " + chrome.runtime.lastError.message);
            } else {
                if (response.success) {
                    setResetStatus("PIN reset successfully!");
                    setSecurityAnswer("");
                    setNewPin("");
                    setConfirmNewPin("");
                } else {
                    setResetStatus("Incorrect security answer");
                }
            }
        });
    };

    if (!isSetupComplete) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "white" }}>
                <h1>⚙️ Pin Tab Locker Settings</h1>
                <p>Please open the extension popup to complete the initial setup first.</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#1e1e1e", color: "white", fontFamily: "sans-serif" }}>
            <div style={{ width: "250px", backgroundColor: "#2d2d2d", padding: "20px" }}>
                <h2 style={{ marginBottom: "30px", fontSize: "1.2rem" }}>⚙️ Settings</h2>
                <div 
                    onClick={() => setActiveTab("blocked")}
                    style={{ padding: "10px", margin: "5px 0", cursor: "pointer", backgroundColor: activeTab === "blocked" ? "#3d3d3d" : "transparent", borderRadius: "5px" }}>
                    🚫 Blocked Domains
                </div>
                <div 
                    onClick={() => setActiveTab("scheduled")}
                    style={{ padding: "10px", margin: "5px 0", cursor: "pointer", backgroundColor: activeTab === "scheduled" ? "#3d3d3d" : "transparent", borderRadius: "5px" }}>
                    📅 Scheduled Blocks
                </div>
                <div 
                    onClick={() => setActiveTab("reset")}
                    style={{ padding: "10px", margin: "5px 0", cursor: "pointer", backgroundColor: activeTab === "reset" ? "#3d3d3d" : "transparent", borderRadius: "5px" }}>
                    🔄 Reset PIN
                </div>
            </div>

            <div style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: "600px" }}>
                    {activeTab === "blocked" && (
                        <BlockedUrlsList onBack={() => {}} hideBack={true} />
                    )}
                    {activeTab === "scheduled" && (
                        <ScheduledBlocks onBack={() => {}} hideBack={true} />
                    )}
                    {activeTab === "reset" && (
                        <div className="popup-container" style={{ width: "100%" }}>
                            <h2 className="popup-title">🔄 Reset PIN</h2>
                            <div className="form-group">
                                <label className="security-question">Security Question: What's your place of birth?</label>
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
                            {resetStatus && <div className="status-message">{resetStatus}</div>}
                            <div className="button-group">
                                <button onClick={resetPin} className="popup-button reset-button">
                                    Reset PIN
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <OptionsPage />
    </React.StrictMode>
);
