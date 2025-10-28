/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
// Check auth key imports
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
// AddMemory imports
import admin from "firebase-admin";
import {getFirestore} from "firebase-admin/firestore";

// this will be the maximum concurrent request count.

setGlobalOptions({maxInstances: 5});

initializeApp();

// auth key defined in firebase secrets
const authKeySecret = defineSecret("AUTH_KEY");

export const checkAuthKey = onCall(
    {secrets: [authKeySecret]},
    async (request) => {
        const submittedKey = request.data.key;
        const secretKey = authKeySecret.value(); // replace with authKeySecret for prod
        logger.info("Checking auth key...");
        if (submittedKey && submittedKey === secretKey) {
            const db = getFirestore();
            const userId = request.auth?.uid; // Use optional chaining for safety

            if (userId) {
                await db.collection("authorizedUsers").doc(userId).set({
                    authorized: true,
                    // Good practice to include a timestamp
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`[AUTH SUCCESS] User ${userId} authorized and recorded.`);
            }

            return {authorized: true};
        } else {
            throw new HttpsError("unauthenticated", "Invalid authorization key.");
        }
    }
);

const db = getFirestore();

// Data sent from the client
interface AddMemoryRequest {
    location: { lat: number; lng: number };
    story: string;
    imageUrls: string[];
}

export const addMemoryFunction = onCall(
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "The user must be authenticated to post a memory.");
        }
        const userId = request.auth.uid; // Get the user's ID from the secure token
        const {location, story, imageUrls} = request.data as AddMemoryRequest;
        // Check for UID in an 'authorizedUsers'
        const authDoc = await db.collection("authorizedUsers").doc(userId).get();
        if (!authDoc.exists) {
            throw new HttpsError("permission-denied", "User is not authorized to create memories.");
        }
        const LOCAL_APP_ID = "memory-map-v1";
        const collectionPath = `artifacts/${LOCAL_APP_ID}/public/data/memories`;

        const newMemoryData = {
            story: story.trim(),
            location: location,
            contributorId: userId,
            timestamp: Date.now(),
            imageUrls: imageUrls,
        };

        // Write to Firestore
        const docRef = await db.collection(collectionPath).add(newMemoryData);

        return {success: true, memoryId: docRef.id};
    }
);
