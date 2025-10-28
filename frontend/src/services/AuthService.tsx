import { getFunctions, httpsCallable } from 'firebase/functions';
// NOTE: Make sure your InitializeFirebase has run and firebaseInstances.app is set
import { firebaseInstances } from '../config/firebase.ts';

// for local tests
import { connectFunctionsEmulator } from 'firebase/functions';

interface AuthResponse {
    authorized: boolean;
    error: string;
}

export const checkAuthorizationKeySecurely = async (key: string): Promise<AuthResponse> => {
    // Check if the app is initialized
    if (!firebaseInstances.app) {
        return { authorized: false, error: "Firebase app not initialized." };
    }

    const functions = getFunctions(firebaseInstances.app);

    // connect to emulator if testing in dev
    if (import.meta.env.DEV) {
        // The default Functions emulator port is 5001
        connectFunctionsEmulator(functions, "localhost", 5001);
    }

    // 'checkAuthKey' must match the function name exported in index.ts
    const checkAuth = httpsCallable<{ key: string }, AuthResponse>(functions, 'checkAuthKey');

    try {
        const result = await checkAuth({ key });
        return result.data;
    } catch (error) {
        console.error("Error calling secure auth function:", error);
        return { authorized: false, error: "Error calling secure auth function:" }; // Deny access on any call error
    }
};