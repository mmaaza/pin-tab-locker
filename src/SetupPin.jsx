import { useState } from "react";
import "./Popup.css";

function SetupPin({ onSetupComplete }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleSetup = () => {
    // Validate inputs
    if (!pin || !securityAnswer) {
      setError("Please fill in all fields");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    // Save PIN and security answer
    chrome.runtime.sendMessage(
      { 
        action: "setupGlobalPin", 
        pin, 
        securityAnswer 
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setError("Error: " + chrome.runtime.lastError.message);
        } else {
          setStatus("Setup completed successfully!");
          setTimeout(() => {
            onSetupComplete();
          }, 1000);
        }
      }
    );
  };

  return (
    <div className="popup-container">
      <h2 className="popup-title">🔒 Initial Setup</h2>
      
      <div className="form-group">
        <input
          type="password"
          placeholder="Create PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="popup-input"
        />
      </div>
      
      <div className="form-group">
        <input
          type="password"
          placeholder="Confirm PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          className="popup-input"
        />
      </div>
      
      <div className="form-group">
        <label className="security-question">
          Security Question: What's your place of birth?
        </label>
        <input
          type="text"
          placeholder="Answer"
          value={securityAnswer}
          onChange={(e) => setSecurityAnswer(e.target.value)}
          className="popup-input"
        />
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {status && <div className="status-message">{status}</div>}
      
      <button
        onClick={handleSetup}
        className="popup-button set-button"
      >
        Complete Setup
      </button>
    </div>
  );
}

export default SetupPin;
