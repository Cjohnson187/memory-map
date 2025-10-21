import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserSessionPersistence,
    type Auth } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query, Firestore, QuerySnapshot } from 'firebase/firestore';
// We must declare L as a global variable since Leaflet is loaded via CDN (see below)
declare const L: typeof import('leaflet') | undefined;

// --- GLOBAL CONFIG ---
const AUTHORIZATION_KEY = "memorykey"; // The secret key the family will share to authorize posting

// --- Global Variables (Assumed to be available in the environment) ---
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- TypeScript Interfaces ---

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

// --- Firebase and Map Instance Refs ---
const firebaseInstances = {
    db: null as Firestore | null,
    auth: null as Auth | null,
};

// --- Custom Leaflet Icons (Base64 SVG) ---

const createIcons = () => {
    if (typeof L === 'undefined') return { tempIcon: null, memorialIcon: null };

    // Custom icon for the temporary marker (Blue Plus)
    const tempIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="%233b82f6" stroke-width="2"><circle cx="16" cy="16" r="14" fill="%233b82f6" stroke="white" stroke-width="3"/><path d="M16 8v16M8 16h16" stroke="white" stroke-width="3"/></svg>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -28]
    });

    // Custom icon for the permanent memorial pin (Dark Purple drop for contrast on light map)
    const memorialIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%235b21b6" stroke="%23ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -30]
    });

    return { tempIcon, memorialIcon };
};


// --- Main React Component ---
const App: React.FC = () => {
    // --- State Management ---
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
    const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
    const [tempLocation, setTempLocation] = useState<Location | null>(null);
    const [memoryText, setMemoryText] = useState<string>('');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // --- Authorization State ---
    const [isAuthorizedToPost, setIsAuthorizedToPost] = useState<boolean>(false);
    const [authKeyInput, setAuthKeyInput] = useState<string>('');
    const [authMessage, setAuthMessage] = useState<string>('Enter the family key to add new pins.');

    // --- Refs for Leaflet Instances ---
    const mapRef = useRef<import('leaflet').Map | null>(null);
    const markerLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const tempMarkerRef = useRef<import('leaflet').Marker | null>(null);

    // --- 1. FIREBASE INITIALIZATION & AUTHENTICATION ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            firebaseInstances.db = getFirestore(app);
            firebaseInstances.auth = getAuth(app);

            setPersistence(firebaseInstances.auth, browserSessionPersistence);

            const unsubscribe = onAuthStateChanged(firebaseInstances.auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                } else {
                    try {
                        if (initialAuthToken && firebaseInstances.auth) {
                            await signInWithCustomToken(firebaseInstances.auth, initialAuthToken);
                        } else if (firebaseInstances.auth) {
                            await signInAnonymously(firebaseInstances.auth);
                        }
                    } catch (error) {
                        console.error("Firebase Auth Error:", error);
                    }
                }
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase Initialization Failed:", error);
        }
    }, []);

    // --- 2. DYNAMIC LEAFLET LOADING (Fix for L.map is not a function error) ---
    useEffect(() => {
        // Function to dynamically load Leaflet CSS
        const loadLeafletCss = () => {
            if (document.querySelector('link[href*="leaflet.css"]')) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
        };

        // Function to dynamically load Leaflet JS
        const loadLeafletJs = () => {
            // Check if Leaflet and its map function are already available
            if (typeof L !== 'undefined' && typeof L.map === 'function') {
                setIsMapLoaded(true);
                return;
            }
            if (document.querySelector('script[src*="leaflet.js"]')) return;

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20n6cT8x32mN/ZQV9E1FwH5rB/iL8bJc+j7T3s1+A9I=';
            script.crossOrigin = '';
            script.async = false;

            // Add a small delay on load to ensure the browser has finished executing the script
            // and registering all properties (like L.map) on the global L object.
            script.onload = () => {
                // Increased delay from 50ms to 300ms to allow more time for Leaflet to fully initialize
                // within the Canvas preview environment, resolving the map loading issue.
                setTimeout(() => {
                    if (typeof L !== 'undefined' && typeof L.map === 'function') {
                        setIsMapLoaded(true);
                    } else {
                        console.error("Leaflet script loaded, but L.map is still unavailable.");
                    }
                }, 300);
            };
            document.head.appendChild(script);
        };

        loadLeafletCss();
        loadLeafletJs();
    }, []);

    // --- 3. MAP SETUP & CLICK HANDLER ---

    const handleMapClick = useCallback((e: import('leaflet').LeafletMouseEvent) => {
        if (typeof L === 'undefined' || !mapRef.current) return;

        // Only allow map clicking to set a location if the user is authorized to post
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
        tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon! }).addTo(mapRef.current);

        // 3. Pan to the clicked location
        mapRef.current.panTo(e.latlng);
    }, [isAuthorizedToPost]); // Dependency on isAuthorizedToPost

    const setupMap = useCallback(() => {
        // Strict check to ensure L and L.map are available before proceeding
        if (mapRef.current || typeof L === 'undefined' || typeof L.map !== 'function') return;

        // Initialize Map
        const map = L.map('map').setView([20, 0], 2); // Center map globally
        mapRef.current = map;

        // Light Tile Layer (Standard OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Add Layer Group for saved markers
        markerLayerRef.current = new L.LayerGroup().addTo(map);

        // Add map click listener
        map.on('click', handleMapClick);

        // Add a handler for map resize/repositioning on initial load
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
        if (!firebaseInstances.db || !userId) return null;
        // Public collection path for shared memories (read access for all)
        const collectionPath = `artifacts/${appId}/public/data/memories`;
        return collection(firebaseInstances.db, collectionPath);
    }, [userId]);

    const checkAuthorizationKey = () => {
        if (authKeyInput === AUTHORIZATION_KEY) {
            setIsAuthorizedToPost(true);
            setAuthMessage('Authorization successful! You can now select a location on the map to add a memory pin.');
            setAuthKeyInput(''); // Clear the input
        } else {
            setAuthMessage('Invalid key. Please try again.');
        }
    };

    const addMemory = async () => {
        // Enforce authorization check before writing to the database
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
            if (mapRef.current && tempMarkerRef.current) {
                mapRef.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }

        } catch (e) {
            console.error("Error adding document: ", e);
            console.error("Failed to save memory. See console for details.");
        } finally {
            setIsSaving(false);
        }
    };


    // --- 5. REALTIME LISTENER & RENDERING ---

    useEffect(() => {
        if (!isAuthReady || !isMapLoaded) return;

        const memoriesCollection = getMemoryCollectionRef();
        if (!memoriesCollection) return;

        const q = query(memoriesCollection);

        // Set up the real-time listener
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot) => {
            const newMemories: Memory[] = [];
            snapshot.forEach((doc) => {
                // Cast the data to the Memory interface
                const data = doc.data();
                newMemories.push({
                    id: doc.id,
                    story: data.story,
                    location: data.location,
                    contributorId: data.contributorId,
                    timestamp: data.timestamp,
                } as Memory);
            });
            setMemories(newMemories);

        }, (error) => {
            console.error("Error listening to memories:", error);
        });

        // Cleanup the listener when the component unmounts or dependencies change
        return () => unsubscribe();
    }, [isAuthReady, isMapLoaded, getMemoryCollectionRef]);


    useEffect(() => {
        if (!mapRef.current || !markerLayerRef.current || !L) return;

        markerLayerRef.current.clearLayers(); // Clear existing markers
        const { memorialIcon } = createIcons();

        memories.forEach(memory => {
            const { lat, lng } = memory.location;
            const date = memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Date Unknown';

            // Create the content for the popup window
            const popupContent = `
                <div class="p-2 text-gray-800 font-sans">
                    <h3 class="font-bold text-lg mb-1">A Memory Shared</h3>
                    <p class="mb-2 text-sm italic">${memory.story.replace(/\n/g, '<br>')}</p>
                    <hr class="my-2 border-gray-300">
                    <p class="text-xs text-gray-600">
                        Marked on: <span class="font-medium">${date}</span>
                    </p>
                </div>
            `;

            L.marker([lat, lng], { icon: memorialIcon! })
                .bindPopup(popupContent, { maxWidth: 300 })
                .addTo(markerLayerRef.current!);
        });
    }, [memories]);


    // --- UI Rendering Logic ---

    const selectedLocationText = tempLocation
        ? `Selected: Lat ${tempLocation.lat.toFixed(4)}, Lng ${tempLocation.lng.toFixed(4)}`
        : 'No location selected. Click the map!';

    // Show a loading message while Leaflet is being fetched
    const loadingMap = !mapRef.current && isAuthReady && !isMapLoaded;
    const loadingAuth = !isAuthReady;


    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-6xl space-y-6">
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
                        <div className="flex space-x-2">
                            <input
                                type="password"
                                value={authKeyInput}
                                onChange={(e) => {
                                    setAuthKeyInput(e.target.value);
                                    setAuthMessage('Enter the family key to add new pins.'); // Reset message on change
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { checkAuthorizationKey(); }
                                }}
                                placeholder="Enter Secret Family Key"
                                className="flex-grow p-3 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 border border-gray-300 focus:ring-2 focus:ring-red-500 focus:outline-none transition duration-150"
                            />
                            <button
                                onClick={checkAuthorizationKey}
                                className="px-5 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-150 disabled:opacity-50"
                                disabled={authKeyInput.trim().length === 0}
                            >
                                Authorize
                            </button>
                        </div>
                    </div>
                )}

                {/* Location Entry Form (Visible when tempLocation is set AND authorized) */}
                {tempLocation && isAuthorizedToPost && (
                    <div id="memoryFormCard" className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 space-y-4 transition-all duration-300">
                        <h2 className="text-2xl font-bold text-purple-700">Share a Memory at This Location</h2>
                        <div id="selectedLocation" className="text-sm text-gray-600">{selectedLocationText}</div>

                        <textarea
                            id="memoryText"
                            rows={3}
                            value={memoryText}
                            onChange={(e) => setMemoryText(e.target.value)}
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
                        {isAuthReady ? `Contributor ID: ${userId}` : 'Authenticating...'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default App;
