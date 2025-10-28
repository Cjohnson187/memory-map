import type { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';

// --- CONFIGURATION ---
export const firebaseConfig = {
    // IMPORTANT: When running locally, ensure you set these environment variables in your .env file.
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


// Application ID used for Firestore paths (acts as the root namespace)
export const LOCAL_APP_ID =  import.meta.env.VITE_FIREBASE_LOCAL_APP_ID;

// --- Firebase Instance Refs (Managed globally within the service layer) ---
interface FirebaseInstances {
    app: FirebaseApp | null;
    db: Firestore | null;
    auth: Auth | null;
    storage: FirebaseStorage | null;
}

export const firebaseInstances: FirebaseInstances = {
    app: null,
    db: null,
    auth: null,
    storage: null,
};
