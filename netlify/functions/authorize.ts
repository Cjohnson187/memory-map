// import { Handler, Context, APIGatewayEvent } from "@netlify/functions";
import type { APIGatewayEvent, Context, Handler } from "aws-lambda";
// Define the handler function for /api/authorize
// This function securely checks a submitted key against a Netlify environment variable.
const handler: Handler = async (event: APIGatewayEvent, context: Context) => {
    // 1. Enforce POST Method
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Method Not Allowed. Use POST." }),
        };
    }

    // 2. Validate Request Body
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing authorization key in request body." }),
        };
    }

    try {
        const body = JSON.parse(event.body);
        const submittedKey: string = body.key;

        // Load the secure key from Netlify Environment Variables
        // IMPORTANT: You MUST set this variable in your Netlify settings.
        const authorizedKey: string | undefined = process.env.POST_AUTHORIZATION_KEY;

        // 3. Check Server Configuration
        if (!authorizedKey) {
            console.error("POST_AUTHORIZATION_KEY environment variable is not set.");
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Server configuration error: Authorization key is missing." }),
            };
        }

        // 4. Validate Key
        // In a high-security scenario, use a dedicated comparison function for timing-attack safety.
        if (submittedKey === authorizedKey) {
            return {
                statusCode: 200,
                body: JSON.stringify({ authorized: true, message: "Authorization successful." }),
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({ authorized: false, message: "Invalid authorization key." }),
            };
        }
    } catch (error) {
        console.error("Error processing authorization request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to process authorization request." }),
        };
    }
};

export { handler };
