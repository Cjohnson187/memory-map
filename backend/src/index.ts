import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const port = 8080;

// --- CORS Configuration ---
// The frontend runs on http://localhost:3000, so we must explicitly allow
// it to make requests to this backend on port 8080.
const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());

// Basic health check and test endpoint
app.get('/api/hello', (req: Request, res: Response) => {
    console.log('Request received for /api/hello');
    res.json({ message: 'Hello from the TypeScript backend!' });
});

// Start the server
app.listen(port, () => {
    console.log(`[Backend] Server running at http://localhost:${port}`);
});
