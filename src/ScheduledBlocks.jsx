import { useState, useEffect } from "react";
import "./Popup.css";

function ScheduledBlocks({ onBack }) {
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  
  // Form state
  const [domainPattern, setDomainPattern] = useState("");
  const [days, setDays] = useState([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  
  const weekdays = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" }
  ];
  
  useEffect(() => {
    // Load scheduled blocks
    setIsLoading(true);
    chrome.runtime.sendMessage({ action: "getScheduledBlocks" }, (response) => {
      if (chrome.runtime.lastError) {
        setError("Error loading schedules: " + chrome.runtime.lastError.message);
      } else if (response && response.success) {
        setBlocks(response.blocks);
      }
      setIsLoading(false);
    });
  }, []);
  
  const handleDayToggle = (dayValue) => {
    const newDays = days.includes(dayValue)
      ? days.filter(d => d !== dayValue)
      : [...days, dayValue];
    setDays(newDays);
  };
  
  const handleAddSchedule = () => {
    setIsAdding(true);
    setDomainPattern("");
    setDays([1, 2, 3, 4, 5]); // Default to weekdays
    setStartTime("09:00");
    setEndTime("17:00");
    setEditingBlock(null);
    setStatus("");
    setError("");
  };
  
  const handleEditSchedule = (block) => {
    setIsAdding(true);
    setDomainPattern(block.domainPattern);
    setDays(block.days);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setEditingBlock(block);
    setStatus("");
    setError("");
  };
  
  const cancelEdit = () => {
    setIsAdding(false);
    setEditingBlock(null);
  };
  
  const saveSchedule = () => {
    if (!pin) {
      setError("PIN is required");
      return;
    }
    
    if (!domainPattern) {
      setError("Domain pattern is required");
      return;
    }
    
    if (days.length === 0) {
      setError("Select at least one day");
      return;
    }
    
    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }
    
    const scheduleData = {
      domainPattern,
      days: days.sort(),
      startTime,
      endTime,
      enabled: true
    };
    
    if (editingBlock) {
      // Update existing block
      chrome.runtime.sendMessage({
        action: "updateScheduledBlock",
        pin,
        block: { ...scheduleData, id: editingBlock.id }
      }, (response) => {
        if (chrome.runtime.lastError) {
          setError("Error: " + chrome.runtime.lastError.message);
        } else if (response && response.success) {
          setStatus("Schedule updated successfully");
          // Update local state
          setBlocks(blocks.map(b => 
            b.id === editingBlock.id ? { ...scheduleData, id: editingBlock.id } : b
          ));
          setIsAdding(false);
          setEditingBlock(null);
        } else {
          setError(response ? response.status : "Unknown error");
        }
      });
    } else {
      // Add new block
      chrome.runtime.sendMessage({
        action: "addScheduledBlock",
        pin,
        block: scheduleData
      }, (response) => {
        if (chrome.runtime.lastError) {
          setError("Error: " + chrome.runtime.lastError.message);
        } else if (response && response.success) {
          setStatus("Schedule added successfully");
          // Add to local state with the generated ID
          setBlocks([...blocks, { ...scheduleData, id: response.id }]);
          setIsAdding(false);
        } else {
          setError(response ? response.status : "Unknown error");
        }
      });
    }
  };
  
  const deleteSchedule = (blockId) => {
    if (!pin) {
      setError("PIN is required");
      return;
    }
    
    chrome.runtime.sendMessage({
      action: "deleteScheduledBlock",
      pin,
      blockId
    }, (response) => {
      if (chrome.runtime.lastError) {
        setError("Error: " + chrome.runtime.lastError.message);
      } else if (response && response.success) {
        setStatus("Schedule deleted successfully");
        // Update local state
        setBlocks(blocks.filter(b => b.id !== blockId));
      } else {
        setError(response ? response.status : "Unknown error");
      }
    });
  };
  
  const formatScheduleTime = (block) => {
    const days = block.days.map(day => weekdays.find(d => d.value === day).label).join(", ");
    return `${days} from ${block.startTime} to ${block.endTime}`;
  };
  
  if (isLoading) {
    return (
      <div className="popup-container">
        <p>Loading...</p>
      </div>
    );
  }
  
  if (isAdding) {
    return (
      <div className="popup-container">
        <h2 className="popup-title">
          {editingBlock ? "Edit Schedule" : "Add Schedule"}
        </h2>
        
        <div className="form-group">
          <label className="form-label">Domain Pattern:</label>
          <input
            type="text"
            placeholder="Domain (e.g., facebook.com or * for all)"
            value={domainPattern}
            onChange={(e) => setDomainPattern(e.target.value)}
            className="popup-input"
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Days:</label>
          <div className="days-selector">
            {weekdays.map(day => (
              <label key={day.value} className="day-checkbox">
                <input
                  type="checkbox"
                  checked={days.includes(day.value)}
                  onChange={() => handleDayToggle(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        </div>
        
        <div className="form-group time-inputs">
          <div className="time-input-group">
            <label className="form-label">Start Time:</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="time-input"
            />
          </div>
          <div className="time-input-group">
            <label className="form-label">End Time:</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="time-input"
            />
          </div>
        </div>
        
        <div className="form-group">
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="popup-input"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="button-group">
          <button onClick={saveSchedule} className="popup-button set-button">
            {editingBlock ? "Update Schedule" : "Add Schedule"}
          </button>
          <button onClick={cancelEdit} className="popup-button cancel-button">
            Cancel
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="popup-container">
      <h2 className="popup-title">📅 Scheduled Blocks</h2>
      
      <div className="form-group">
        <input
          type="password"
          placeholder="Enter PIN (required for changes)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="popup-input"
        />
      </div>
      
      {blocks.length === 0 ? (
        <div className="no-urls-message">No scheduled blocks yet</div>
      ) : (
        <div className="url-list">
          {blocks.map(block => (
            <div key={block.id} className="schedule-item">
              <div className="domain-name">{block.domainPattern}</div>
              <div className="schedule-time">{formatScheduleTime(block)}</div>
              <div className="schedule-actions">
                <button 
                  onClick={() => handleEditSchedule(block)}
                  className="action-button edit-button"
                >
                  Edit
                </button>
                <button 
                  onClick={() => deleteSchedule(block.id)}
                  className="action-button delete-button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {status && <div className="status-message">{status}</div>}
      {error && <div className="error-message">{error}</div>}
      
      <div className="button-group">
        <button onClick={handleAddSchedule} className="popup-button lock-button">
          Add Schedule
        </button>
        <button onClick={onBack} className="popup-button back-button">
          Back
        </button>
      </div>
    </div>
  );
}

export default ScheduledBlocks;
