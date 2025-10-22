import React, { useState, useEffect, useCallback } from 'react';
import { setupMemoriesListener, addMemory, checkAuthorizationKey } from './services/CRUD.tsx';
import { initializeAndAuthenticate } from './services/InitializeFirebase.tsx';
import { ImageModal } from './components/ImageViewer.tsx';
import { useLeafletMap } from './hooks/Leaflet.tsx';
import type { Memory, Location } from './types/Types.ts';
import { LOCAL_APP_ID } from './config/firebase.tsx';
import { MapPin, UploadCloud, Key, Send, X } from 'lucide-react'; // Icons

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
    const [listenerError, setListenerError] = useState<any>(null); // State for Firestore errors

    // --- Image Viewer State (for the Modal) ---
    const [selectedImageUrls, setSelectedImageUrls] = useState<string[] | null>(null);

    // --- Authorization State ---
    const [isAuthorizedToPost, setIsAuthorizedToPost] = useState<boolean>(false);
    const [authKeyInput, setAuthKeyInput] = useState<string>('');
    const [authKey, setAuthKey] = useState<string>('');
    const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    // --- Map Hook Initialization ---
    const { isMapLoaded, tempMarkerRef } = useLeafletMap({
        memories,
        isAuthorizedToPost,
        tempLocation,
        setTempLocation,
        setSelectedImageUrls,
        setErrorMessage,
        setIsAuthorizedToPost,
        // authKey,
    });

    // --- Effects ---

    // 1. Initialize Firebase and Authentication (runs once)
    useEffect(() => {
        // Initializes Firebase app, auth, db, and storage, and signs in anonymously.
        // Also sets up the onAuthStateChanged listener to determine userId and setIsAuthReady.
        const unsubscribe = initializeAndAuthenticate(setUserId, setIsAuthReady, setErrorMessage);
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    // 2. Setup Firestore Listener (runs when auth/map are ready)
    useEffect(() => {
        // Attach listener only when auth is ready AND map is initialized
        if (isAuthReady && isMapLoaded) {
            const unsubscribe = setupMemoriesListener(
                isAuthReady,
                isMapLoaded,
                setMemories,
                setListenerError
            );
            return unsubscribe;
        }
    }, [isAuthReady, isMapLoaded]);

    // --- Handlers ---

    // Handle Authorization Key Submission
    const handleAuthKeyCheck = async () => {
        if (authKeyInput.trim() === '') {
            setAuthMessage({ type: 'info', text: 'Please enter the authorization key.' });
            return;
        }
        setAuthMessage({ type: 'info', text: 'Verifying key...' });

        try {
            const result = await checkAuthorizationKey(authKeyInput);
            if (result.authorized) {
                setAuthKey(authKeyInput); // Store the key for secure operations
                setIsAuthorizedToPost(true);
                setAuthMessage({ type: 'success', text: result.message });
                setAuthKeyInput(''); // Clear input after successful authentication
            } else {
                setAuthMessage({ type: 'error', text: result.message || 'Key invalid.' });
                setIsAuthorizedToPost(false);
            }
        } catch (e) {
            console.error("Authorization check failed:", e);
            setAuthMessage({ type: 'error', text: 'Network or API error during authorization.' });
            setIsAuthorizedToPost(false);
        }
    };

    // Handle Image File Selection
    const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            // Convert FileList to an array and limit to 5 files
            const filesArray = Array.from(e.target.files).slice(0, 5);
            setImageFiles(filesArray);
        }
    };

    // Handle Memory Submission
    const handleAddMemory = useCallback(async () => {
        if (!userId || !tempLocation || memoryText.trim().length === 0 || !isAuthorizedToPost) return;

        setIsSaving(true);
        setErrorMessage(null);

        try {
            // Note: The addMemory function now handles both the image upload (client-side)
            // and the secure Firestore write (via serverless function).
            await addMemory(userId, tempLocation, memoryText, imageFiles, authKey);

            // Success cleanup
            setMemoryText('');
            setImageFiles([]);
            setTempLocation(null);
            // Manually clear the temporary map marker
            if (tempMarkerRef.current) {
                tempMarkerRef.current.remove();
                tempMarkerRef.current = null;
            }
            // Clear message if it was a prior error
            setAuthMessage(null);

        } catch (e: any) {
            console.error("Error adding memory:", e);
            // Handle authorization failure specifically
            if (e.message.includes('401') || e.message.includes('403') || e.message.includes('Unauthorized')) {
                setErrorMessage("Post failed: Authorization revoked. Please re-authorize.");
                setIsAuthorizedToPost(false); // Revoke client-side auth state
            } else {
                setErrorMessage("Failed to save memory. Please try again.");
            }
        } finally {
            setIsSaving(false);
        }
    }, [userId, tempLocation, memoryText, imageFiles, authKey, isAuthorizedToPost, tempMarkerRef]);

    const saveButtonText = isSaving ? 'Saving...' : 'Post Memory to Map';

    // --- Render ---
    return (
        <div className="flex flex-col lg:flex-row h-screen antialiased bg-gray-50">
            {/* Map Container (Takes up main space) */}
            <div id="map" className="flex-1 w-full lg:w-3/4 min-h-[50vh] lg:min-h-full">
                {(!isAuthReady || !isMapLoaded) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/80 z-[1000] text-lg font-semibold text-purple-700">
                        Loading Map & Authentication...
                    </div>
                )}
            </div>

            {/* Sidebar for Controls and Messages */}
            <div className="w-full lg:w-1/4 p-6 bg-white shadow-xl flex flex-col space-y-6 overflow-y-auto">
                <h1 className="text-3xl font-extrabold text-purple-800 border-b pb-3 mb-3">
                    Community Memory Map <MapPin className='inline-block w-6 h-6 ml-2' />
                </h1>

                {/* Error/Listener Message Box */}
                {(errorMessage || listenerError) && (
                    <div className="p-4 bg-red-100 text-red-700 rounded-xl border border-red-300 shadow-sm flex items-center">
                        <X className='w-5 h-5 mr-2 flex-shrink-0' />
                        <div>
                            <p className="font-semibold">Error:</p>
                            <p className='text-sm'>{errorMessage || (listenerError.message || "A real-time connection error occurred.")}</p>
                        </div>
                        {/* Option to clear error message */}
                        <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 rounded-full hover:bg-red-200">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Authorization Section */}
                {!isAuthorizedToPost ? (
                    <div className="p-4 border border-purple-300 rounded-xl bg-purple-50 space-y-3 shadow-inner">
                        <h2 className="text-lg font-bold text-purple-700 flex items-center">
                            <Key className='w-5 h-5 mr-2' /> Posting Authorization
                        </h2>
                        <p className="text-sm text-gray-600">
                            To contribute memories, you must enter a valid authorization key.
                        </p>
                        <input
                            type="password"
                            placeholder="Enter Authorization Key"
                            value={authKeyInput}
                            onChange={(e) => setAuthKeyInput(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                            disabled={!isAuthReady}
                        />
                        <button
                            onClick={handleAuthKeyCheck}
                            className="w-full px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition duration-150 disabled:opacity-50"
                            disabled={!isAuthReady || authKeyInput.trim().length === 0}
                        >
                            Authorize Posting
                        </button>
                        {authMessage && (
                            <div className={`text-sm text-center font-medium ${authMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                                {authMessage.text}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 border border-green-300 rounded-xl bg-green-50 space-y-3 shadow-inner">
                        <p className="text-sm font-semibold text-green-700 flex items-center">
                            <Send className='w-5 h-5 mr-2' /> Authorized to Post!
                        </p>
                    </div>
                )}

                {/* Posting Form */}
                {isAuthorizedToPost && (
                    <div className={`space-y-4 p-4 border rounded-xl shadow-lg ${tempLocation ? 'border-purple-500' : 'border-gray-300 bg-gray-100'}`}>
                        <h2 className="text-lg font-bold text-gray-800">
                            Create New Memory
                        </h2>

                        <div className={`p-3 rounded-lg font-mono text-sm ${tempLocation ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}`}>
                            {tempLocation ? (
                                `Pin Location: ${tempLocation.lat.toFixed(4)}, ${tempLocation.lng.toFixed(4)}`
                            ) : (
                                "Click on the map to set a memory pin location."
                            )}
                        </div>

                        <textarea
                            placeholder="Share your memory (e.g., 'We built sandcastles here in 2015')"
                            value={memoryText}
                            onChange={(e) => setMemoryText(e.target.value)}
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 resize-none"
                            disabled={!tempLocation}
                        />

                        <label className="block text-sm font-medium text-gray-700 flex items-center">
                            <UploadCloud className='w-4 h-4 mr-1' /> Attach Photo(s) (Max 5)
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageFileChange}
                            disabled={!tempLocation || isSaving}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                        {imageFiles.length > 0 && (
                            <p className="text-xs text-green-600">
                                {imageFiles.length} photo(s) selected, ready to upload.
                            </p>
                        )}


                        <button
                            onClick={handleAddMemory}
                            disabled={isSaving || memoryText.trim().length === 0 || !isAuthorizedToPost || !tempLocation}
                            className="w-full px-5 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition duration-150 transform hover:scale-[1.01] disabled:opacity-50"
                        >
                            {saveButtonText}
                        </button>
                    </div>
                )}

                {/* User Info Display */}
                <div className="text-xs text-gray-400 text-center pt-4 mt-auto">
                    <span className="font-mono break-all">
                        {isAuthReady ? `Current User ID: ${userId || 'N/A'}` : 'Authenticating...'}
                    </span>
                    <p>App Namespace: <span className='font-mono'>{LOCAL_APP_ID}</span></p>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImageUrls && (
                <ImageModal
                    imageUrls={selectedImageUrls}
                    onClose={() => setSelectedImageUrls(null)}
                />
            )}
        </div>
    );
};

export default App;
