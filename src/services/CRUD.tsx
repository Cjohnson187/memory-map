import { collection, query, onSnapshot, type DocumentData, CollectionReference, Query, type FirestoreError } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseInstances, LOCAL_APP_ID, API_BASE_URL } from '../config/firebase.tsx';
import type { Location, Memory } from '../types/Types.ts';

// --- Client API Interface to Netlify Functions ---
// Use the configurable API_BASE_URL imported from the firebase config
const NETLIFY_FUNCTION_BASE_URL = API_BASE_URL;

// 1. Authorization Endpoint
export const checkAuthorizationKey = async (userKey: string): Promise<{ authorized: boolean; message: string }> => {
    const response = await fetch(`${NETLIFY_FUNCTION_BASE_URL}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ONLY send the key here to check if it's correct
        body: JSON.stringify({ key: userKey }),
    });

    if (!response.ok) {
        // Handle network errors or non-2xx status codes
        throw new Error(`Authorization API failed: ${response.statusText}`);
    }

    return response.json();
};

// 2. Add Memory Endpoint (Secure Write)
// *** The 'authKey' parameter and the 'Authorization' header are removed! ***
const apiAddMemory = async (
    userId: string,
    tempLocation: Location,
    memoryText: string,
    imageUrls: string[], // Expects already uploaded URLs
): Promise<void> => {
    const response = await fetch(`${NETLIFY_FUNCTION_BASE_URL}/save-memory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // No secret key in the header. Server must validate internally.
        },
        body: JSON.stringify({
            userId,
            tempLocation,
            memoryText,
            imageUrls,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to save memory: ${response.status} ${response.statusText}`);
    }

    // Optional: read response body if server returns status/data
};

// 3. Delete Memory Endpoint (Secure Delete)
// *** The 'authKey' parameter and the 'Authorization' header are removed! ***
const apiDeleteMemory = async (id: string): Promise<void> => {
    const response = await fetch(`${NETLIFY_FUNCTION_BASE_URL}/delete-memory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // No secret key in the header. Server must validate internally.
        },
        body: JSON.stringify({ id }),
    });

    if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.status} ${response.statusText}`);
    }
    // Optional: read response body
};

// --- Firestore Listener (READ operation, which is public) ---

const getMemoryCollectionRef = (): CollectionReference<DocumentData> | null => {
    if (!firebaseInstances.db) return null;
    const collectionPath: string = `artifacts/${LOCAL_APP_ID}/public/data/memories`;
    return collection(firebaseInstances.db, collectionPath);
};

export const setupMemoriesListener = (
    isAuthReady: boolean,
    isMapLoaded: boolean,
    setMemories: (memories: Memory[]) => void,
    setListenerError: (error: any) => void
) => {
    if (!isAuthReady || !isMapLoaded) return () => {};

    const memoriesCollection = getMemoryCollectionRef();
    if (!memoriesCollection) return () => {};

    const q = query(memoriesCollection) as Query<Memory>;

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMemories: Memory[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data() as Memory;
            newMemories.push({
                id: doc.id,
                story: data.story,
                location: data.location,
                contributorId: data.contributorId,
                timestamp: data.timestamp,
                imageUrls: data.imageUrls,
            });
        });
        setMemories(newMemories.sort((a, b) => b.timestamp - a.timestamp)); // Sort newest first
    }, (error: FirestoreError) => {
        setListenerError(error);
    });

    return unsubscribe;
};

// Client-side image upload helper (still needed)
const uploadImages = async (imageFiles: File[]): Promise<string[]> => {
    const storage = firebaseInstances.storage;
    if (!storage) throw new Error("Firebase Storage not initialized.");

    const urls: string[] = [];
    for (const file of imageFiles) {
        // Use a unique ID for the storage path
        const path = `images/${LOCAL_APP_ID}/uploads/${crypto.randomUUID()}_${file.name}`;
        const fileRef = storageRef(storage, path);

        // Skip empty files
        if (file.size === 0) continue;

        try {
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            urls.push(url);
        } catch (e) {
            console.error("Error uploading image:", e);
            // Non-fatal, just skip this image
        }
    }
    return urls;
};


// --- Secured ADD operation (Client-side upload + Server-side write) ---
// *** authKey is removed from the signature. ***
export const addMemory = async (
    userId: string,
    tempLocation: Location,
    memoryText: string,
    imageFiles: File[],
): Promise<void> => {
    let uploadedImageUrls: string[] = [];

    // 1. Client-side upload of all files to Firebase Storage
    if (imageFiles.length > 0) {
        uploadedImageUrls = await uploadImages(imageFiles);
    }

    // 2. Server-side write to Firestore via Netlify function.
    // The server function is now solely responsible for checking authorization
    // using its internal secret key, which is never exposed to the client.
    await apiAddMemory(
        userId,
        tempLocation,
        memoryText,
        uploadedImageUrls,
    );
};

// --- Secured DELETE operation (Server-side delete) ---
// *** authKey is removed from the signature. ***
export const deleteMemory = async (id: string): Promise<void> => {
    try {
        // We now call the secure API function without sending the key.
        await apiDeleteMemory(id);
    } catch (e) {
        console.error("Error securing deleting document: ", e);
        // Re-throw to allow the caller (Leaflet hook) to handle the message and authorization revocation
        throw e;
    }
};
