import * as admin from 'firebase-admin';

// The Service Account Key MUST be stored as an Environment Variable in Netlify (FIREBASE_SERVICE_ACCOUNT_KEY)
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: admin.app.App | null = null;

// Initialize Firebase Admin App only once
const initializeAdmin = (): admin.app.App => {
    if (!adminApp) {
        if (!serviceAccountKey) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
        }

        // Parse the service account key from the Netlify environment variable
        const serviceAccount = JSON.parse(serviceAccountKey);

        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // The databaseURL is required by the Admin SDK initialization
            databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
    }
    return adminApp;
};

// Utility function to check the Authorization Bearer Token
export const checkAuthKey = (key: string): boolean => {
    const authorizedKey: string | undefined = process.env.POST_AUTHORIZATION_KEY;

    if (!authorizedKey) {
        console.error("POST_AUTHORIZATION_KEY environment variable is not set.");
        return false;
    }

    // Simple key comparison
    return key === authorizedKey;
};

export const getFirestore = (): admin.firestore.Firestore => {
    return initializeAdmin().firestore();
};

export const getAppId = (): string | undefined => {
    // This should match the client's LOCAL_APP_ID environment variable
    return process.env.LOCAL_APP_ID;
};
