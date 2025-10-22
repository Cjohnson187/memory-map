import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- CONFIGURATION AND DEFAULTS ---

// The key used to authorize posting of new memories
const DEFAULT_AUTHORIZATION_KEY = "local-test-auth-key-12345"; 
const LOCAL_FALLBACK_APP_ID = "memory-map-local-default";

// Standard Next.js environment variable access for client-side keys (must be NEXT_PUBLIC_)
const loadConfig = () => {
    // Note: Next.js standard prefix for client-side environment variables is NEXT_PUBLIC_
    const config: FirebaseOptions = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || LOCAL_FALLBACK_APP_ID;
    const authKey = process.env.NEXT_PUBLIC_AUTHORIZATION_KEY || DEFAULT_AUTHORIZATION_KEY;

    // Check if configuration is even minimally set up
    const isConfigured = !!config.projectId; 

    return { firebaseConfig: config, appId, authKey, isConfigured };
};


// --- INITIALIZATION ---

const { firebaseConfig, appId, authKey, isConfigured } = loadConfig();

if (!isConfigured) {
    console.warn(
        "Firebase: Configuration keys are missing. Please ensure your .env file is set up with NEXT_PUBLIC_FIREBASE_ keys."
    );
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig as FirebaseOptions); 

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Export derived values
export const FIREBASE_APP_ID = appId;
export const AUTHORIZATION_KEY = authKey;


// Firestore paths
export const getMemoryCollectionPath = () => {
    // Use the public path for shared data: /artifacts/{appId}/public/data/memories
    return `artifacts/${FIREBASE_APP_ID}/public/data/memories`;
};
