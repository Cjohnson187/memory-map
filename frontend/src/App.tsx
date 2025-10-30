import React, { useState, useEffect} from 'react';
import { setupMemoriesListener, addMemory } from './services/CRUD.tsx';
import { initializeAndAuthenticate } from './services/InitializeFirebase.tsx';
import { ImageModal } from './components/ImageViewer.tsx';
import { useLeafletMap } from './hooks/Leaflet.tsx';
import type { Memory, Location } from './types/Types.ts';
import { LOCAL_APP_ID } from './config/firebase.ts';
import { checkAuthorizationKeySecurely } from './services/AuthService.tsx';

// --- Main React Component ---
const App: React.FC = () => {
    // --- State Management ---
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
    const [tempLocation, setTempLocation] = useState<Location | null>(null);
    const [memoryText, setMemoryText] = useState<string>('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // --- Image Viewer State (for the Modal) ---
    const [selectedImageUrls, setSelectedImageUrls] = useState<string[] | null>(null);

    // --- Authorization State ---
    const [isAuthorizedToPost, setIsAuthorizedToPost] = useState<boolean>(false);
    const [authKeyInput, setAuthKeyInput] = useState<string>('');
    const [authMessage, setAuthMessage] = useState<string>('Enter the family key to add new pins.');

    // Function to handle errors from Firestore listener
    const setListenerError = (error: Error) => {
        setErrorMessage("Real-time data synchronization failed. Check console for details. " + error.toLocaleString());
    };


    // --- Map Logic Hook ---
    // Passes state setters and data to the hook to manage Leaflet functionality
    const { isMapLoaded, tempMarkerRef, mapRef } = useLeafletMap({
        memories,
        isAuthorizedToPost,
        setTempLocation,
        setAuthMessage,
        setSelectedImageUrls,
        setErrorMessage,
    });


    // --- 1. FIREBASE INITIALIZATION & ANONYMOUS AUTHENTICATION ---
    useEffect(() => {
        const unsubscribePromise = initializeAndAuthenticate(setUserId, setIsAuthReady, setErrorMessage);
        return () => {
            // Clean up auth listener when component unmounts
            unsubscribePromise.then(u => u());
        }
    }, []);

    // Auto-clear error message after 5 seconds
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    // --- 2. Real-time Listener for Memories ---
    useEffect(() => {
        // Setup the onSnapshot listener for memories when Auth and Map are ready
        const unsubscribe = setupMemoriesListener(isMapLoaded, setMemories, setListenerError);
        return () => unsubscribe();
    }, [isMapLoaded]);


    // --- 3. FILE AND AUTHORIZATION HANDLERS ---

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            setImageFiles(Array.from(files).filter(file => file.type.startsWith('image/')));
            setErrorMessage(null);
        }
    };
    const checkAuthorizationKey = async (): Promise<void> => {
        if (authKeyInput.trim() === '') return;
        setAuthMessage('Checking key...');
        setErrorMessage(null);

        // Call the secure Cloud Function
        const result = await checkAuthorizationKeySecurely(authKeyInput);

        if (result.authorized) {
            setIsAuthorizedToPost(true);
            setAuthMessage('Authorization successful!');
            setAuthKeyInput('');
        } else {
            setIsAuthorizedToPost(false);
            setAuthMessage('Invalid key. Please try again.');
        }
    };
    // const checkAuthorizationKey = (): void => {
    //     if (authKeyInput === AUTHORIZATION_KEY) {
    //         setIsAuthorizedToPost(true);
    //         setAuthMessage('Authorization successful! You can now select a location on the map to add a memory pin.');
    //         setAuthKeyInput('');
    //         setErrorMessage(null);
    //     } else {
    //         setIsAuthorizedToPost(false);
    //         setAuthMessage('Invalid key. Please try again.');
    //     }
    // };


    // --- 4. ADD MEMORY OPERATION ---

    const handleAddMemory = async (): Promise<void> => {
        // Basic validation before saving
        if (!tempLocation || !memoryText.trim() || !isAuthReady || isSaving || !userId || !isAuthorizedToPost) return;

        setIsSaving(true);
        setErrorMessage(null);

        try {
            // Use the centralized service function
            await addMemory(userId, tempLocation, memoryText, imageFiles);

            // Clear temporary state and UI on success
            setTempLocation(null);
            setMemoryText('');
            setImageFiles([]);

            // Explicitly remove the temporary marker from the map
            if (mapRef.current && tempMarkerRef.current) {
                mapRef.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }

        } catch (e) {
            console.error("Error processing memory: ", e);
            setErrorMessage((e as Error).message || "An unknown error occurred while saving. Check console.");
        } finally {
            setIsSaving(false);
        }
    };


    // --- UI Rendering Logic ---

    const selectedLocationText: string = tempLocation
        ? `Selected: Lat ${tempLocation.lat.toFixed(4)}, Lng ${tempLocation.lng.toFixed(4)}`
        : 'No location selected. Click the map!';

    const loadingMap: boolean = !isMapLoaded && isAuthReady;
    const loadingAuth: boolean = !isAuthReady;

    const saveButtonText: string = isSaving
        ? 'Uploading & Saving...'
        : `Save Pin (${imageFiles.length} photo${imageFiles.length !== 1 ? 's' : ''})`;

    const closeImageModal = () => setSelectedImageUrls(null);


    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8 font-sans">

            {/* Image Modal */}
            <ImageModal
                imageUrls={selectedImageUrls}
                onClose={closeImageModal}
            />

            <div className="w-full max-w-6xl space-y-6">

                {/* Error Message Display */}
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-xl flex justify-between items-center" role="alert" style={{ display: errorMessage ? 'flex' : 'none' }}>
                    <p className="font-bold">Error:</p>
                    <p className="ml-3">{errorMessage}</p>
                    <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold">
                        &times;
                    </button>
                </div>

                <header className="text-center pb-4 border-b border-gray-300">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        Memory Map of <span className="text-purple-700">Charles Dorchester</span>, a Life Well Lived
                    </h1>
                    <p className="text-gray-600 mt-2">Click anywhere on the map to view memories.</p>
                </header>

                {/* Main Map Container */}
                <div id="map" className="z-0 w-full h-[70vh] rounded-xl shadow-xl border border-gray-300">
                    {(loadingAuth || loadingMap) && (
                        <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-700 rounded-xl">
                            {loadingAuth ? "Authenticating with Firebase..." : "Loading Map Data..."}
                        </div>
                    )}
                </div>

                {/* Authorization Gate */}
                <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 space-y-4">
                    <p className="text-gray-700">{authMessage}</p>
                    {!isAuthorizedToPost && (
                        <form className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0" onSubmit={(e: React.FormEvent) => { e.preventDefault(); checkAuthorizationKey(); }}>
                            <input
                                type="password"
                                value={authKeyInput}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setAuthKeyInput(e.target.value);
                                    setAuthMessage('Enter the family key to add new pins.');
                                }}
                                placeholder="Enter Secret Family Key"
                                className="flex-grow p-3 rounded-xl bg-gray-200 text-gray-800 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-red-500 focus:outline-none transition duration-150"
                            />
                            <button
                                type="submit"
                                disabled={authKeyInput.length === 0}
                                className="w-full sm:w-auto flex-shrink-0 px-5 py-3 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition duration-150 disabled:opacity-50"
                            >
                                Authorize
                            </button>
                        </form>
                    )}
                    {isAuthorizedToPost && (
                        <p className="text-green-600 font-semibold">Authorized: Select a location on the map to add a pin.</p>
                    )}
                </div>

                {/* Location Entry Form (Visible when tempLocation is set AND authorized) */}
                {tempLocation && isAuthorizedToPost && (
                    <div id="memoryFormCard" className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 space-y-4 transition-all duration-300">
                        <h2 className="2xl font-bold text-purple-700">Share a Memory at This Location</h2>
                        <div id="selectedLocation" className="text-sm text-gray-600">{selectedLocationText}</div>

                        <textarea
                            id="memoryText"
                            rows={3}
                            value={memoryText}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemoryText(e.target.value)}
                            placeholder="Write the story, the date, and the memory here..."
                            className="w-full p-3 rounded-xl bg-gray-200 text-gray-800 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none transition duration-150 resize-none"
                        />

                        {/* File Input for Images */}
                        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
                            Attach Photos (Optional)
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                        {imageFiles.length > 0 && (
                            <p className="text-xs text-green-600">
                                {imageFiles.length} photo(s) selected, ready to upload.
                            </p>
                        )}


                        <button
                            onClick={handleAddMemory}
                            disabled={isSaving || memoryText.trim().length === 0}
                            className="w-full px-5 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition duration-150 transform hover:scale-[1.01] disabled:opacity-50"
                        >
                            {saveButtonText}
                        </button>
                    </div>
                )}

                {/* User Info Display */}
                <div className="text-xs text-gray-400 text-center pt-4">
                    <span className="font-mono break-all">
                        {isAuthReady ? `Current User ID: ${userId || 'N/A'}` : 'Authenticating...'}
                    </span>
                    <p>App Namespace: <span className='font-mono'>{LOCAL_APP_ID}</span></p>
                </div>
            </div>
        </div>
    );
};

export default App;
