import { collection, doc, deleteDoc, Query, query, onSnapshot, type DocumentData, CollectionReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseInstances, LOCAL_APP_ID } from '../config/firebase.tsx';
import type {AddMemoryRequest, Location, Memory} from '../types/Types.ts';

import { getFunctions, httpsCallable } from 'firebase/functions';
import firebase from "firebase/compat/app";

// for local tests
import { connectFunctionsEmulator } from 'firebase/functions';


// Helper to get the functions instance (similar to AuthService)
const getFunctionsInstance = () => {
    if (!firebaseInstances.app) throw new Error("Firebase app not initialized.");

    const functions = getFunctions(firebaseInstances.app);

    if (import.meta.env.DEV) {

        // in case hot-reloading tries to connect the emulator multiple times.
        try {
            connectFunctionsEmulator(functions, "localhost", 5001);
        } catch (error) {
            console.error("Emulator already connected:", error);
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
    userId: string, // No longer strictly needed but harmless
    tempLocation: Location,
    memoryText: string,
    imageFiles: File[],
): Promise<void> => {
    let imageUrls: string[] = [];

    // IMPORTANT: Temporarily use the userId for the image upload path
    // until we figure out how to do it securely on the server side.
    // For now, keep the image upload in the frontend.
    if (imageFiles.length > 0) {
        imageUrls = await uploadImages(userId, imageFiles); // ⬅️ This is okay to keep for now
    }

    // 2. Call the Cloud Function to perform the secure write
    const functionsInstance = getFunctionsInstance();
    const addMemoryCF = httpsCallable<AddMemoryRequest, { success: boolean, memoryId: string }>(
        functionsInstance,
        'addMemoryFunction' // ⬅️ Call the function that performs the secure check and write
    );

    const memoryDataToSend: AddMemoryRequest = {
        location: tempLocation,
        story: memoryText,
        imageUrls: imageUrls, // Send the URLs to the function
    };

    try {
        await addMemoryCF(memoryDataToSend);
    } catch (e) {
        console.error("Error calling addMemoryFunction:", e);
        // The error you saw is thrown here by the backend function's security logic
        throw new Error("Failed to securely add memory. Check authorization status.");
    }
};