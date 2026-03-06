// Hashes a string using SHA-256
export async function hashString(message) {
    if (!message) return null;
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Helper to compare an input string against a stored hash
export async function verifyHash(inputString, storedHash) {
    if (!inputString || !storedHash) return false;
    const inputHash = await hashString(inputString);
    return inputHash === storedHash;
}
