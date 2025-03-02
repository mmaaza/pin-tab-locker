import { useState, useEffect } from "react";
import "./Popup.css";

function BlockedUrlsList({ onBack, onUnblock }) {
  const [blockedUrls, setBlockedUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [selectedUrl, setSelectedUrl] = useState(null);

  useEffect(() => {
    // Fetch the list of blocked URLs
    chrome.storage.sync.get(["blockedUrls"], (data) => {
      const urls = data.blockedUrls || [];
      setBlockedUrls(urls);
      setIsLoading(false);
    });
  }, []);

  const handleUnblock = () => {
    if (!pin) {
      setStatus("PIN is required to unblock the URL");
      return;
    }

    if (!selectedUrl) {
      setStatus("Please select a URL to unblock");
      return;
    }

    chrome.runtime.sendMessage({
      action: "unblockUrlFromList",
      pin,
      url: selectedUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus("Error: " + chrome.runtime.lastError.message);
      } else {
        setStatus(response.status);
        if (response.success) {
          // Remove the unblocked URL from the list
          setBlockedUrls(blockedUrls.filter(url => url !== selectedUrl));
          setSelectedUrl(null);
        }
      }
    });
  };

  // Extract and format domain for display
  const formatDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  };

  // Group URLs by domain to show a cleaner list
  const groupedByDomain = () => {
    const domains = new Map();
    
    blockedUrls.forEach(url => {
      const domain = formatDomain(url);
      if (!domains.has(domain)) {
        domains.set(domain, url);
      }
    });
    
    return Array.from(domains.values());
  };

  if (isLoading) {
    return (
      <div className="popup-container">
        <h2 className="popup-title">🔄 Loading...</h2>
      </div>
    );
  }

  const uniqueBlockedUrls = groupedByDomain();

  return (
    <div className="popup-container">
      <h2 className="popup-title">🔒 Blocked Domains</h2>

      {uniqueBlockedUrls.length === 0 ? (
        <div className="no-urls-message">
          No domains are currently blocked
        </div>
      ) : (
        <div className="url-list">
          {uniqueBlockedUrls.map((url, index) => {
            const domain = formatDomain(url);
            return (
              <div 
                key={index} 
                className={`url-item ${selectedUrl === url ? 'selected' : ''}`}
                onClick={() => setSelectedUrl(url)}
              >
                <span className="domain-name">{domain}</span>
                <span className="block-indicator">Entire domain blocked</span>
              </div>
            );
          })}
        </div>
      )}

      {uniqueBlockedUrls.length > 0 && (
        <>
          <div className="form-group">
            <input
              type="password"
              placeholder="Enter PIN to unblock"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="popup-input"
            />
          </div>
          
          <button
            onClick={handleUnblock}
            disabled={!selectedUrl}
            className="popup-button unlock-button"
          >
            Unblock Selected Domain
          </button>
        </>
      )}

      {status && <div className="status-message">{status}</div>}

      <button onClick={onBack} className="popup-button back-button">
        Back to Main
      </button>
    </div>
  );
}

export default BlockedUrlsList;
