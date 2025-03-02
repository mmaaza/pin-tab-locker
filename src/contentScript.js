const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.style.width = '100%';
overlay.style.height = '100%';
overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
overlay.style.zIndex = '10000';
overlay.style.display = 'flex';
overlay.style.justifyContent = 'center';
overlay.style.alignItems = 'center';
overlay.style.color = 'white';
overlay.style.fontSize = '24px';
overlay.innerText = 'This tab is locked. Please unlock to view the content.';
document.body.appendChild(overlay);

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "removeOverlay") {
        overlay.remove();
    }
});
