import { Handler, APIGatewayEvent } from "aws-lambda";
import { getFirestore, checkAuthKey, getAppId } from './utilities/admin';

// Request body structure
interface SaveMemoryPayload {
    userId: string;
    location: { lat: number, lng: number };
    story: string;
    imageUrls: string[];
}

const handler: Handler = async (event: APIGatewayEvent) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed. Use POST." }) };
    }

    // 1. Authorization Check (Uses Bearer Token in Header)
    const authHeader = event.headers.authorization;
    const authKey = authHeader?.split(' ')[1];

    if (!authKey || !checkAuthKey(authKey)) {
        return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized: Invalid or missing authorization key." }) };
    }

    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing memory data." }) };
    }

    try {
        const payload: SaveMemoryPayload = JSON.parse(event.body);

        // Basic data validation
        if (!payload.userId || !payload.location || !payload.story) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields (userId, location, story)." }) };
        }

        const firestore = getFirestore();
        const appId = getAppId();

        if (!appId) {
            return { statusCode: 500, body: JSON.stringify({ message: "Server configuration error: App ID is missing." }) };
        }

        const collectionPath = `artifacts/${appId}/public/data/memories`;
        const memoryData = {
            story: payload.story,
            location: { lat: payload.location.lat, lng: payload.location.lng },
            contributorId: payload.userId,
            timestamp: Date.now(),
            imageUrls: payload.imageUrls || [],
        };

        // 2. Perform the secure write operation using Admin SDK
        await firestore.collection(collectionPath).add(memoryData);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Memory successfully saved to Firestore." }),
        };

    } catch (error) {
        console.error("Error saving memory:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error during Firestore save." }),
        };
    }
};

export { handler };
