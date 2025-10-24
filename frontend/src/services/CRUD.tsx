import { collection, doc, deleteDoc, Query, query, onSnapshot, type DocumentData, CollectionReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseInstances, LOCAL_APP_ID } from '../config/firebase.tsx';
import type {AddMemoryRequest, Location, Memory} from '../types/Types.ts';

import { getFunctions, httpsCallable } from 'firebase/functions';
import firebase from "firebase/compat/app";

// for local tests
import { connectFunctionsEmulator } from 'firebase/functions';

// const functions = getFunctions(firebaseInstances.app);

// if (import.meta.env.DEV) {
//     // The default Functions emulator port is 5001
//     connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }

// Helper to get the functions instance (similar to AuthService)
const getFunctionsInstance = () => {
    if (!firebaseInstances.app) throw new Error("Firebase app not initialized.");

    const functions = getFunctions(firebaseInstances.app);

    if (import.meta.env.DEV) {

        // in case hot-reloading tries to connect the emulator multiple times.
        try {
            connectFunctionsEmulator(functions, "localhost", 5001);
        } catch (e) {
            console.error("Emulator already connected:", e);
        }
    }
    return functions;
};

const getMemoryCollectionRef = (): CollectionReference<DocumentData> | null => {
    if (!firebaseInstances.db) return null;
    const collectionPath: string = `artifacts/${LOCAL_APP_ID}/public/data/memories`;
    return collection(firebaseInstances.db, collectionPath);
};

export const setupMemoriesListener = (
    setIsAuthReady: boolean,
    isMapLoaded: boolean,
    setMemories: (memories: Memory[]) => void,
    setListenerError: (error: firebase.firestore.FirestoreError) => void
) => {
    if (!setIsAuthReady || !isMapLoaded) return () => {};

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
                imageUrls: data.imageUrls || [],
            });
        });
        setMemories(newMemories);

    }, (error) => {
        console.error("Error listening to memories:", error);
        setListenerError(error);
    });

    return unsubscribe;
};

export const uploadImages = async (memoryId: string, files: File[]): Promise<string[]> => {
    const storage = firebaseInstances.storage;
    if (!storage || files.length === 0) return [];

    const urls: string[] = [];
    for (const file of files) {
        const path = `artifacts/${LOCAL_APP_ID}/memories/${memoryId}/${file.name}_${Date.now()}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        urls.push(url);
    }
    return urls;
};

export const deleteMemory = async (id: string): Promise<void> => {
    const db = firebaseInstances.db;
    if (!db) throw new Error("Firestore not initialized.");

    const docRef = doc(db, `artifacts/${LOCAL_APP_ID}/public/data/memories`, id);

    try {
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw new Error("Failed to delete memory pin.");
    }
};

export const addMemory = async (
    userId: string, // Still needed for the image upload path
    tempLocation: Location,
    memoryText: string,
    imageFiles: File[],
): Promise<void> => {
    // We use a temporary ID or the userId for the image path since we don't have the final memory ID yet.
    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
        // Upload path should use something unique or temporary until the final memoryId is known
        imageUrls = await uploadImages(userId, imageFiles);
    }

    // 2. Call the Cloud Function to perform the secure write
    const functionsInstance = getFunctionsInstance();
    const addMemoryCF = httpsCallable<AddMemoryRequest, { success: boolean, memoryId: string }>(
        functionsInstance,
        'addMemoryFunction'
    );

    const memoryDataToSend: AddMemoryRequest = {
        // The key is NOT sent
        location: tempLocation,
        story: memoryText,
        imageUrls,
    };

    try {
        // The request token automatically includes the user's UID for server-side verification
        await addMemoryCF(memoryDataToSend);
    } catch (e) {
        console.error("Error calling addMemoryFunction:", e);
        // Throw an error that App.tsx can catch and display
        throw new Error("Failed to securely add memory. Check authorization status.");
    }
};
