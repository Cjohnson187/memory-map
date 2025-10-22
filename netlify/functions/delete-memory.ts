import { Handler, APIGatewayEvent } from "aws-lambda";
import { getFirestore, checkAuthKey, getAppId } from './utilities/admin';

// Request body structure
interface DeleteMemoryPayload {
    id: string; // The Firestore Document ID
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
        return { statusCode: 400, body: JSON.stringify({ message: "Missing memory ID." }) };
    }

    try {
        const payload: DeleteMemoryPayload = JSON.parse(event.body);

        // Basic data validation
        const memoryId = payload.id;
        if (!memoryId) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing memory ID." }) };
        }

        const firestore = getFirestore();
        const appId = getAppId();

        if (!appId) {
            return { statusCode: 500, body: JSON.stringify({ message: "Server configuration error: App ID is missing." }) };
        }

        const docPath = `artifacts/${appId}/public/data/memories/${memoryId}`;

        // 2. Perform the secure delete operation using Admin SDK
        await firestore.doc(docPath).delete();

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Memory ${memoryId} successfully deleted.` }),
        };

    } catch (error) {
        console.error("Error deleting memory:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error during Firestore delete." }),
        };
    }
};

export { handler };
