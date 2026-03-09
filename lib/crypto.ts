const KEY_NAME = "dcim-master-key";
const DB_NAME = "dcim-crypto-store";
const STORE_NAME = "keys";
const PBKDF2_ITERATIONS = 250000;
const SALT_SIZE = 16; // 16 bytes salt
const IV_SIZE = 12; // 12 bytes IV for AES-GCM

interface StoredKey {
    id: string;
    key: CryptoKey;
    expiresAt: number;
}

// -------------------------------------------------------------
// IndexedDB Utils
// -------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };
        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

export async function storeKey(key: CryptoKey): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        // 7 days from now
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

        const storedKey: StoredKey = {
            id: KEY_NAME,
            key,
            expiresAt,
        };

        const request = store.put(storedKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getStoredKey(): Promise<CryptoKey | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(KEY_NAME);

        request.onsuccess = () => {
            const result = request.result as StoredKey | undefined;
            if (!result) {
                resolve(null);
                return;
            }

            // Check expiration
            if (Date.now() > result.expiresAt) {
                clearStoredKey().then(() => resolve(null)).catch(reject);
            } else {
                resolve(result.key);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function clearStoredKey(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(KEY_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// -------------------------------------------------------------
// Web Crypto Utils
// -------------------------------------------------------------

export async function deriveKeyContext(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const passwordBuffer = enc.encode(password);

    // Create a fixed salt for this application context so we always 
    // derive the same key from the same master password.
    // In a multi-user app, you'd want a user-specific salt.
    // We use a fixed string as salt here just to map the same password -> same key.
    const salt = enc.encode("dcim-app-static-salt");

    const importedPassword = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        importedPassword,
        { name: "AES-GCM", length: 256 },
        false, // Must not be extractable
        ["encrypt", "decrypt"]
    );

    return key;
}

/**
 * Encrypts a plaintext string.
 * Returns a Base64 string that includes both the IV and the ciphertext.
 * Format: Base64(IV + Ciphertext)
 */
export async function encryptData(data: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const enc = new TextEncoder();
    const encodedData = enc.encode(data);

    const cipherBuffer = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encodedData
    );

    const cipherArray = new Uint8Array(cipherBuffer);
    const combined = new Uint8Array(iv.length + cipherArray.length);
    combined.set(iv);
    combined.set(cipherArray, iv.length);

    // Convert Uint8Array to base64
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
}

/**
 * Decrypts a previously encrypted base64 string containing IV + Ciphertext.
 */
export async function decryptData(encryptedBase64: string, key: CryptoKey): Promise<string> {
    const binary = atob(encryptedBase64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        combined[i] = binary.charCodeAt(i);
    }

    const iv = combined.slice(0, IV_SIZE);
    const ciphertext = combined.slice(IV_SIZE);

    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
}
