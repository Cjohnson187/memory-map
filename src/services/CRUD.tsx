import { collection, doc, deleteDoc, updateDoc, addDoc, Query, query, onSnapshot, type DocumentData, CollectionReference } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseInstances, LOCAL_APP_ID } from '../config/firebase.tsx';
import type { Location, Memory } from '../types/Types.ts';



const getMemoryCollectionRef = (): CollectionReference<DocumentData> | null => {
    if (!firebaseInstances.db) return null;
    const collectionPath: string = `artifacts/${LOCAL_APP_ID}/public/data/memories`;
    return collection(firebaseInstances.db, collectionPath);
};

export const setupMemoriesListener = (
    setIsAuthReady: boolean,
    isMapLoaded: boolean,
    setMemories: (memories: Memory[]) => void,
    setListenerError: (error: any) => void
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
    userId: string,
    tempLocation: Location,
    memoryText: string,
    imageFiles: File[],
): Promise<void> => {
    const memoriesCollection = getMemoryCollectionRef();
    if (!memoriesCollection) throw new Error("Firestore collection not initialized.");

    // 1. Save basic data
    const newMemoryData = {
        story: memoryText.trim(),
        location: { lat: tempLocation.lat, lng: tempLocation.lng },
        contributorId: userId,
        timestamp: Date.now(),
        imageUrls: [],
    };

    const docRef = await addDoc(memoriesCollection, newMemoryData);
    const memoryId = docRef.id;

    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
        // 2. Upload images
        imageUrls = await uploadImages(memoryId, imageFiles);

        // 3. Update the document with URLs
        await updateDoc(docRef, { imageUrls: imageUrls });
    }
};
