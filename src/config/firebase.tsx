import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';

// --- CONFIGURATION ---

// IMPORTANT: These values must be provided via environment variables (e.g., in a .env file)
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};


// Application ID used for Firestore paths (acts as the root namespace)
export const LOCAL_APP_ID =  import.meta.env.VITE_FIREBASE_LOCAL_APP_ID as string;

/**
 * Base URL for calling Netlify/Serverless Functions.
 * The default '/.netlify/functions' is used when deploying to Netlify.
 * This is crucial for secure operations like adding or deleting memories.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string || '/.netlify/functions';


// --- Firebase Instance Refs (Managed globally within the service layer) ---
interface FirebaseInstances {
    app: FirebaseApp | null;
    db: Firestore | null;
    auth: Auth | null;
    storage: FirebaseStorage | null;
}

// Global reference container for initialized Firebase services
export const firebaseInstances: FirebaseInstances = {
    app: null,
    db: null,
    auth: null,
    storage: null,
};
