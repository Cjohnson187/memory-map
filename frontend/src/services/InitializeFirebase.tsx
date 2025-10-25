import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, setPersistence, browserSessionPersistence, onAuthStateChanged, type Auth, type User, connectAuthEmulator } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig, firebaseInstances, } from '../config/firebase.tsx';

// --- INITIALIZATION ---
export const initializeAndAuthenticate = async (
    setUserId: (id: string | null) => void,
    setIsAuthReady: (ready: boolean) => void,
    setErrorMessage: (message: string | null) => void
) => {
    try {
        const app = initializeApp(firebaseConfig);
        firebaseInstances.app = app;
        firebaseInstances.db = getFirestore(app);
        firebaseInstances.auth = getAuth(app);
        firebaseInstances.storage = getStorage(app);

        const authInstance: Auth = firebaseInstances.auth;
        if (!authInstance) return () => {};

        if (import.meta.env.DEV) {
            try {
                // The Auth Emulator runs on port 9099
                connectAuthEmulator(authInstance, "http://localhost:9099");
            } catch (error) {
                console.error("Emulator already connected:", error);
            }
        }

        await setPersistence(authInstance, browserSessionPersistence);
        await signInAnonymously(authInstance);

        const unsubscribe = onAuthStateChanged(authInstance, (user: User | null) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
            setIsAuthReady(true);
        });

        return unsubscribe;

    } catch (error) {
        console.error("Firebase Initialization or Auth Failed:", error);
        setIsAuthReady(true);
        setErrorMessage("Failed to connect to Firebase. Check console for configuration errors.");
        return () => {};
    }
};
