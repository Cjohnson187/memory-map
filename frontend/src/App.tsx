import React, { useState, useEffect } from 'react';

// Basic utility to fetch from the backend
const BACKEND_URL = 'http://localhost:8080/api/hello';

const App: React.FC = () => {
    const [message, setMessage] = useState<string>('Loading...');

    useEffect(() => {
        // Note: When running in a browser accessed via host, 'localhost' points to the host machine.
        // The browser will successfully access the backend running on host port 8080.
        fetch(BACKEND_URL)
            .then(res => res.json())
            .then(data => {
                setMessage(data.message);
            })
            .catch(err => {
                console.error("Error fetching from backend:", err);
                setMessage('Failed to connect to backend (API is likely not ready or running). Check console.');
            });
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md text-white border border-indigo-500">
                <h1 className="text-3xl font-bold text-center text-indigo-400 mb-4">
                    Full-Stack Docker Setup
                </h1>
                <p className="text-sm text-gray-400 mb-6 text-center">
                    React/TypeScript Frontend communicating with Node/TypeScript Backend.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-700 rounded-lg">
                        <h2 className="text-xl font-semibold text-indigo-300">Frontend Status:</h2>
                        <p className="text-green-400 mt-1">Running in Docker container on port 3000</p>
                    </div>

                    <div className="p-4 bg-gray-700 rounded-lg">
                        <h2 className="text-xl font-semibold text-indigo-300">Backend Response:</h2>
                        <p className="text-white font-mono break-words mt-1">{message}</p>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mt-6 text-center">
                    Edit `backend/server.ts` or `frontend/src/App.tsx` and watch the changes refresh!
                </p>
            </div>
        </div>
    );
};

export default App;
