import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserSessionPersistence, type Auth, signInWithCustomToken, type User } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query, deleteDoc, doc, Firestore, Query } from 'firebase/firestore';


declare const L: any;
// --- TYPE DEFINITIONS ---

interface Location {
    lat: number;
    lng: number;
}

interface Memory {
    id: string;
    story: string;
    location: Location;
    contributorId: string;
    timestamp: number;
}

// NOTE on Leaflet: Since Leaflet is loaded dynamically, we use 'any' for Leaflet-specific types (L.Map, L.Marker, etc.)
// to avoid requiring full external @types/leaflet definitions in a single-file environment.
type LeafletMap = any;
type LeafletLayer = any;

// --- CONFIGURATION ---

// Authorization Key (For posting memories - CHANGE THIS SECRET KEY)
const AUTHORIZATION_KEY = "local-test-auth-key-12345";

// Firebase Configuration (Replace the empty strings with your actual Firebase project credentials)
const firebaseConfig = {
    // Keys are now sourced from process.env (e.g., REACT_APP_FIREBASE_API_KEY)
    // IMPORTANT: When running locally, ensure you set these environment variables in your .env file.
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};


// Application ID (Used for Firestore path - defaults to project ID or a fallback string)
const appId: string = firebaseConfig.projectId || "memory-map-default";

// Auth Token (set to null as it is not provided externally)
const initialAuthToken: string | null = null;

// --- Firebase and Map Instance Refs ---
const firebaseInstances: { db: Firestore | null, auth: Auth | null } = {
    db: null,
    auth: null,
};


// --- Custom Leaflet Icons (Base64 SVG) ---

const createIcons = () => {
    // Check if Leaflet (L) is loaded
    if (typeof L === 'undefined') return { tempIcon: null, memorialIcon: null };

    // Custom icon for the temporary marker (Blue Plus)
    const tempIcon = new (L as any).Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="%233b82f6" stroke-width="2"><circle cx="16" cy="16" r="14" fill="%233b82f6" stroke="white" stroke-width="3"/><path d="M16 8v16M8 16h16" stroke="white" stroke-width="3"/></svg>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -28]
    });

    // Custom icon for the permanent memorial pin (Dark Purple drop for contrast on light map)
    const memorialIcon = new (L as any).Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%235b21b6" stroke="%23ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -30]
    });

    return { tempIcon, memorialIcon };
};


// --- Main React Component ---
const App: React.FC = () => {
    // --- State Management (Explicitly Typed) ---
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
    const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
    const [tempLocation, setTempLocation] = useState<Location | null>(null);
    const [memoryText, setMemoryText] = useState<string>('');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // --- Authorization State ---
    const [isAuthorizedToPost, setIsAuthorizedToPost] = useState<boolean>(false);
    const [authKeyInput, setAuthKeyInput] = useState<string>('');
    const [authMessage, setAuthMessage] = useState<string>('Enter the family key to add new pins.');

    // --- Refs for Leaflet Instances (Typed as LeafletMap/Layer) ---
    const mapRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<LeafletLayer | null>(null);
    const tempMarkerRef = useRef<LeafletLayer | null>(null);

    // --- 1. FIREBASE INITIALIZATION & AUTHENTICATION ---
    useEffect(() => {
        const initFirebase = async () => {
            try {
                // 1. Initialize Firebase App
                const app = initializeApp(firebaseConfig);
                firebaseInstances.db = getFirestore(app);
                firebaseInstances.auth = getAuth(app);

                // 2. Set persistence and sign-in
                const authInstance: Auth = firebaseInstances.auth;
                if (!authInstance) return;

                await setPersistence(authInstance, browserSessionPersistence);

                if (initialAuthToken) {
                    // Correct use of modular function API with Auth instance
                    await signInWithCustomToken(authInstance, initialAuthToken);
                } else {
                    await signInAnonymously(authInstance);
                }

                // 3. Set up Auth State Listener
                const unsubscribe = onAuthStateChanged(authInstance, (user: User | null) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        // Fallback to random ID if auth somehow fails
                        setUserId(crypto.randomUUID());
                    }
                    setIsAuthReady(true);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Firebase Initialization or Auth Failed:", error);
                setIsAuthReady(true);
                setErrorMessage("Failed to connect to Firebase. Check console for configuration errors.");
            }
        };
        initFirebase();
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

    // --- 2. DYNAMIC LEAFLET LOADING ---
    useEffect(() => {
        // Function to dynamically load Leaflet CSS
        const loadLeafletCss = (): void => {
            if (document.querySelector('link[href*="leaflet.css"]')) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        };

        // Function to dynamically load Leaflet JS
        const loadLeafletJs = (): void => {
            if (typeof L !== 'undefined' && typeof (L as any).map === 'function') {
                setIsMapLoaded(true);
                return;
            }
            if (document.querySelector('script[src*="leaflet.js"]')) return;

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = false;

            script.onload = () => {
                setTimeout(() => {
                    if (typeof L !== 'undefined' && typeof (L as any).map === 'function') {
                        setIsMapLoaded(true);
                    } else {
                        console.error("Leaflet script loaded, but L.map is still unavailable.");
                    }
                }, 750);
            };
            document.head.appendChild(script);
        };

        loadLeafletCss();
        loadLeafletJs();
    }, []);

    // --- 3. MAP SETUP & CLICK HANDLER ---

    const handleMapClick = useCallback((e: any): void => { // e is a Leaflet MouseEvent object
        if (typeof L === 'undefined' || !mapRef.current) return;

        if (!isAuthorizedToPost) {
            setAuthMessage("You must be authorized to select a location for a new pin.");
            return;
        }

        const newLoc: Location = { lat: e.latlng.lat, lng: e.latlng.lng };
        setTempLocation(newLoc);
        setMemoryText(''); // Clear text on new selection

        const { tempIcon } = createIcons();

        // 1. Remove previous temporary marker
        if (tempMarkerRef.current) {
            mapRef.current.removeLayer(tempMarkerRef.current);
        }

        // 2. Add a new temporary marker for the selected spot
        tempMarkerRef.current = (L as any).marker(e.latlng, { icon: tempIcon }).addTo(mapRef.current);

        // 3. Pan to the clicked location
        mapRef.current.panTo(e.latlng);
    }, [isAuthorizedToPost]);

    const setupMap = useCallback((): void => {
        if (mapRef.current || typeof L === 'undefined' || typeof (L as any).map !== 'function') return;

        // Initialize Map
        const map = (L as any).map('map').setView([20, 0], 2);
        mapRef.current = map;

        // Tile Layer
        (L as any).tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Add Layer Group for saved markers
        markerLayerRef.current = new (L as any).LayerGroup().addTo(map);

        // Add map click listener
        map.on('click', handleMapClick);

        // Invalidate size to ensure it fills the container correctly
        setTimeout(() => map.invalidateSize(), 100);

    }, [handleMapClick]);

    // Initialize map after component mounts AND Leaflet is loaded
    useEffect(() => {
        if (isAuthReady && isMapLoaded) {
            setupMap();
        }
    }, [isAuthReady, isMapLoaded, setupMap]);


    // --- 4. FIREBASE HELPER FUNCTIONS & CRUD ---

    const getMemoryCollectionRef = useCallback(() => {
        if (!firebaseInstances.db) return null;
        const collectionPath: string = `artifacts/${appId}/public/data/memories`;
        return collection(firebaseInstances.db, collectionPath);
    }, [appId]);

    const checkAuthorizationKey = (): void => {
        if (authKeyInput === AUTHORIZATION_KEY) {
            setIsAuthorizedToPost(true);
            setAuthMessage('Authorization successful! You can now select a location on the map to add a memory pin.');
            setAuthKeyInput('');
            setErrorMessage(null);
        } else {
            setAuthMessage('Invalid key. Please try again.');
        }
    };

    const deleteMemory = async (id: string): Promise<void> => {
        const db = firebaseInstances.db;
        if (!db) return;

        const docRef = doc(db, `artifacts/${appId}/public/data/memories`, id);

        try {
            await deleteDoc(docRef);
            console.log(`Memory ${id} successfully deleted.`);
        } catch (e) {
            console.error("Error deleting document: ", e);
            setErrorMessage("Failed to delete memory pin. Check console and ensure you are authorized.");
        }
    };

    const addMemory = async (): Promise<void> => {
        if (!tempLocation || !memoryText.trim() || !isAuthReady || isSaving || !userId || !isAuthorizedToPost) return;

        const memoriesCollection = getMemoryCollectionRef();
        if (!memoriesCollection) return;

        setIsSaving(true);

        try {
            await addDoc(memoriesCollection, {
                story: memoryText.trim(),
                location: {
                    lat: tempLocation.lat,
                    lng: tempLocation.lng
                },
                contributorId: userId,
                timestamp: Date.now()
            });

            // Clear temporary state and UI on success
            setTempLocation(null);
            setMemoryText('');
            setErrorMessage(null);
            if (mapRef.current && tempMarkerRef.current) {
                mapRef.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }

        } catch (e) {
            console.error("Error adding document: ", e);
            setErrorMessage("Failed to save memory pin. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };


    // --- 5. REALTIME LISTENER & RENDERING ---

    useEffect(() => {
        if (!isAuthReady || !isMapLoaded) return;

        const memoriesCollection = getMemoryCollectionRef();
        if (!memoriesCollection) return;

        const q: Query<Memory> = query(memoriesCollection) as Query<Memory>;

        // Set up the real-time listener
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMemories: Memory[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as Memory; // Cast data to Memory type
                newMemories.push({
                    id: doc.id,
                    story: data.story,
                    location: data.location,
                    contributorId: data.contributorId,
                    timestamp: data.timestamp,
                });
            });
            setMemories(newMemories);

        }, (error) => {
            console.error("Error listening to memories:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, isMapLoaded, getMemoryCollectionRef]);


    useEffect(() => {
        if (!mapRef.current || !markerLayerRef.current || typeof L === 'undefined') return;

        markerLayerRef.current.clearLayers(); // Clear existing markers
        const { memorialIcon } = createIcons();

        memories.forEach(memory => {
            const { lat, lng } = memory.location;
            const date: string = memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Date Unknown';

            let popupContent: string = `
                <div class="p-2 text-gray-800 font-sans">
                    <h3 class="font-bold text-lg mb-1">A Memory Shared</h3>
                    <p class="mb-2 text-sm italic">${memory.story.replace(/\n/g, '<br>')}</p>
                    <hr class="my-2 border-gray-300">
                    <p class="text-xs text-gray-600">
                        Marked on: <span class="font-medium">${date}</span>
                    </p>
            `;

            if (isAuthorizedToPost) {
                popupContent += `
                    <button 
                        id="delete-pin-${memory.id}" 
                        class="mt-3 w-full py-2 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition duration-150 shadow-md"
                    >
                        Delete Pin
                    </button>
                `;
            }
            popupContent += `</div>`;


            const marker = (L as any).marker([lat, lng], { icon: memorialIcon })
                .bindPopup(popupContent, { maxWidth: 300 })
                .addTo(markerLayerRef.current);

            // Handle the click event for the delete button *after* the popup opens
            marker.on('popupopen', () => {
                if (isAuthorizedToPost) {
                    const deleteButton = document.getElementById(`delete-pin-${memory.id}`);
                    if (deleteButton) {
                        deleteButton.onclick = () => deleteMemory(memory.id);
                    }
                }
            });
        });
    }, [memories, isAuthorizedToPost]);


    // --- UI Rendering Logic ---

    const selectedLocationText: string = tempLocation
        ? `Selected: Lat ${tempLocation.lat.toFixed(4)}, Lng ${tempLocation.lng.toFixed(4)}`
        : 'No location selected. Click the map!';

    // Show a loading message while Leaflet is being fetched
    const loadingMap: boolean = !mapRef.current && isAuthReady && !isMapLoaded;
    const loadingAuth: boolean = !isAuthReady;


    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-6xl space-y-6">

                {/* New Error Message Display */}
                {errorMessage && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex justify-between items-center" role="alert">
                        <p className="font-bold">Error:</p>
                        <p className="ml-3">{errorMessage}</p>
                        <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold">
                            &times;
                        </button>
                    </div>
                )}

                <header className="text-center pb-4 border-b border-gray-300">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        <span className="text-purple-700">Memory Map</span> of a Life Well Lived
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
                {!isAuthorizedToPost && (
                    <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 space-y-4">
                        <h2 className="text-2xl font-bold text-red-600">Authorization Required to Post</h2>
                        <p className="text-gray-700">{authMessage}</p>
                        <form className="flex space-x-2" onSubmit={(e: React.FormEvent) => { e.preventDefault(); checkAuthorizationKey(); }}>
                            <input
                                type="password"
                                value={authKeyInput}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setAuthKeyInput(e.target.value);
                                    setAuthMessage('Enter the family key to add new pins.'); // Reset message on change
                                }}
                                placeholder="Enter Secret Family Key"
                                className="flex-grow p-3 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-red-500 focus:outline-none transition duration-150"
                            />
                            <button
                                type="submit"
                                disabled={authKeyInput.length === 0}
                                className="px-5 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-150 disabled:opacity-50"
                            >
                                Authorize
                            </button>
                        </form>
                    </div>
                )}

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
                            placeholder="Write the story, the date, and the memory of spreading the ashes here..."
                            className="w-full p-3 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none transition duration-150 resize-none"
                        />

                        <button
                            onClick={addMemory}
                            disabled={isSaving || memoryText.trim().length === 0}
                            className="w-full px-5 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-150 transform hover:scale-[1.01] disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Memory Pin'}
                        </button>
                    </div>
                )}

                {/* User Info Display */}
                <div className="text-xs text-gray-400 text-center pt-4">
                    <span className="font-mono break-all">
                        {isAuthReady ? `Contributor ID: ${userId || 'N/A'}` : 'Authenticating...'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default App;
