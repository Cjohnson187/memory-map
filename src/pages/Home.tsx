import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserSessionPersistence, type Auth, type User } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query, deleteDoc, doc, updateDoc, type Firestore, type Query, type DocumentData, type CollectionReference } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import { ArrowLeft, ArrowRight, X } from 'lucide-react'; // Using lucide-react for icons

// --- GLOBAL LEAFLET DECLARATION (assumed to be loaded via <script> tags) ---
declare const L: any;

// --- CONFIGURATION ---

// IMPORTANT: Replace these placeholder strings with your actual Firebase project credentials
const firebaseConfig = {
    // These values should be provided in your .env file
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};


// Application ID used for Firestore paths (acts as the root namespace)
const LOCAL_APP_ID = "memory-map-v1";

// Authorization Key (For posting memories - CHANGE THIS SECRET KEY)
const AUTHORIZATION_KEY = import.meta.env.VITE_FIREBASE_AUTH_KEY;


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
    imageUrls: string[];
}

type LeafletMap = any;
type LeafletLayer = any;

// --- Firebase Instance Refs ---
const firebaseInstances: { db: Firestore | null, auth: Auth | null, storage: FirebaseStorage | null } = {
    db: null,
    auth: null,
    storage: null,
};


// --- Custom Leaflet Icons (Base64 SVG) ---
const createIcons = () => {
    if (typeof L === 'undefined') return { tempIcon: null, memorialIcon: null };

    const tempIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="%233b82f6" stroke-width="2"><circle cx="16" cy="16" r="14" fill="%233b82f6" stroke="white" stroke-width="3"/><path d="M16 8v16M8 16h16" stroke="white" stroke-width="3"/></svg>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -28]
    });

    const memorialIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%235b21b6" stroke="%23ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -30]
    });

    return { tempIcon, memorialIcon };
};

// --- Image Modal Component ---
interface ImageModalProps {
    imageUrls: string[] | null;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrls, onClose }) => {
    // --- HOOKS MUST BE UNCONDITIONAL ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const totalImages = imageUrls?.length || 0;

    // Memoize navigation functions
    const goToPrevious = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex === 0 ? totalImages - 1 : prevIndex - 1));
    }, [totalImages]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex === totalImages - 1 ? 0 : prevIndex + 1));
    }, [totalImages]);

    // Reset index when images change (e.g., modal opens with new content)
    useEffect(() => {
        setCurrentIndex(0);
    }, [totalImages]);

    // Keyboard navigation logic
    useEffect(() => {
        // Conditional logic now happens *inside* the hook, not outside
        if (totalImages === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrevious();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrevious, onClose, totalImages]);
    // --- END HOOKS ---

    // Conditional Return (AFTER all hooks)
    if (totalImages === 0) return null;

    // Use non-null assertion since we've checked totalImages > 0
    const currentUrl = imageUrls![currentIndex];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                className="absolute top-4 right-4 text-white hover:text-red-400 transition duration-150 p-2 rounded-full z-50 bg-black/50"
                onClick={onClose}
                aria-label="Close Image Viewer"
            >
                <X size={32} />
            </button>

            <div className="relative max-w-7xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>

                {/* Previous Button */}
                {totalImages > 1 && (
                    <button
                        className="absolute left-0 lg:-left-16 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full transition duration-150 transform hover:scale-110 shadow-lg z-10"
                        onClick={goToPrevious}
                        aria-label="Previous Image"
                    >
                        <ArrowLeft size={32} />
                    </button>
                )}

                {/* Main Image Container */}
                <div className="max-w-full max-h-full flex flex-col items-center justify-center">
                    <img
                        src={currentUrl}
                        alt={`Memory photo ${currentIndex + 1} of ${totalImages}`}
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = 'https://placehold.co/600x400/DC2626/FFFFFF?text=Image+Load+Failed';
                        }}
                    />

                    {/* Index Counter */}
                    {totalImages > 1 && (
                        <div className="absolute bottom-4 text-white text-lg font-mono bg-black/50 px-4 py-2 rounded-full">
                            {currentIndex + 1} / {totalImages}
                        </div>
                    )}
                </div>

                {/* Next Button */}
                {totalImages > 1 && (
                    <button
                        className="absolute right-0 lg:-right-16 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full transition duration-150 transform hover:scale-110 shadow-lg z-10"
                        onClick={goToNext}
                        aria-label="Next Image"
                    >
                        <ArrowRight size={32} />
                    </button>
                )}
            </div>
        </div>
    );
};


// --- Main React Component ---
const App: React.FC = () => {
    // --- State Management ---
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
    const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
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

    // --- Ref to hold current authorization status for use in map handlers ---
    const authStatusRef = useRef<boolean>(false);
    useEffect(() => {
        authStatusRef.current = isAuthorizedToPost;
    }, [isAuthorizedToPost]);

    // --- Refs for Leaflet Instances ---
    const mapRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<LeafletLayer | null>(null);
    const tempMarkerRef = useRef<LeafletLayer | null>(null);


    // --- 1. FIREBASE INITIALIZATION & ANONYMOUS AUTHENTICATION ---
    useEffect(() => {
        const initFirebase = async () => {
            try {
                // 1. Initialize Firebase App using local config
                const app = initializeApp(firebaseConfig);
                firebaseInstances.db = getFirestore(app);
                firebaseInstances.auth = getAuth(app);
                firebaseInstances.storage = getStorage(app);

                // 2. Set persistence and sign-in anonymously
                const authInstance: Auth = firebaseInstances.auth;
                if (!authInstance) return;

                await setPersistence(authInstance, browserSessionPersistence);
                await signInAnonymously(authInstance);

                // 3. Set up Auth State Listener
                const unsubscribe = onAuthStateChanged(authInstance, (user: User | null) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        // Fallback to random ID if anonymous sign-in fails or user is null
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


    // --- 2. FILE AND STORAGE HANDLERS ---

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            setImageFiles(Array.from(files).filter(file => file.type.startsWith('image/')));
            setErrorMessage(null);
        }
    };

    // Function to upload files to Firebase Storage
    const uploadImages = async (memoryId: string, files: File[]): Promise<string[]> => {
        const storage = firebaseInstances.storage;
        if (!storage || files.length === 0) return [];

        const urls: string[] = [];

        for (const file of files) {
            // Storage path uses the local APP ID
            const path = `artifacts/${LOCAL_APP_ID}/memories/${memoryId}/${file.name}_${Date.now()}`;
            const fileRef = storageRef(storage, path);

            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            urls.push(url);
        }
        return urls;
    };


    // --- 3. CRUD OPERATIONS ---

    const getMemoryCollectionRef = useCallback((): CollectionReference<DocumentData> | null => {
        if (!firebaseInstances.db) return null;
        // Firestore path uses the local APP ID
        const collectionPath: string = `artifacts/${LOCAL_APP_ID}/public/data/memories`;
        return collection(firebaseInstances.db, collectionPath);
    }, []);

    const checkAuthorizationKey = (): void => {
        if (authKeyInput === AUTHORIZATION_KEY) {
            setIsAuthorizedToPost(true);
            setAuthMessage('Authorization successful! You can now select a location on the map to add a memory pin.');
            setAuthKeyInput('');
            setErrorMessage(null);
        } else {
            setIsAuthorizedToPost(false);
            setAuthMessage('Invalid key. Please try again.');
        }
    };

    const deleteMemory = async (id: string): Promise<void> => {
        const db = firebaseInstances.db;
        if (!db) return;

        // Document path uses the local APP ID
        const docRef = doc(db, `artifacts/${LOCAL_APP_ID}/public/data/memories`, id);

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
        setErrorMessage(null);

        try {
            // 1. Save basic data to Firestore to get a unique document ID
            const newMemoryData = {
                story: memoryText.trim(),
                location: { lat: tempLocation.lat, lng: tempLocation.lng },
                contributorId: userId,
                timestamp: Date.now(),
                imageUrls: [],
            };

            const docRef = await addDoc(memoriesCollection, newMemoryData);
            const memoryId = docRef.id;

            let imageUrls: string[] = [];
            if (imageFiles.length > 0) {
                // 2. Upload images using the generated ID
                imageUrls = await uploadImages(memoryId, imageFiles);

                // 3. Update the document with the image URLs
                await updateDoc(docRef, { imageUrls: imageUrls });
            }

            // Clear temporary state and UI on success
            setTempLocation(null);
            setMemoryText('');
            setImageFiles([]);
            if (mapRef.current && tempMarkerRef.current) {
                mapRef.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }

        } catch (e) {
            console.error("Error processing memory: ", e);
            setErrorMessage("Failed to save memory pin or upload images. Please check your Firebase Storage rules.");
        } finally {
            setIsSaving(false);
        }
    };


    // --- 4. MAP SETUP & RENDERING ---

    const handleMapClick = useCallback((e: any): void => { // e is a Leaflet MouseEvent object
        if (typeof L === 'undefined' || !mapRef.current) return;

        if (!authStatusRef.current) {
            setAuthMessage("You must be authorized to select a location for a new pin.");
            return;
        }

        const newLoc: Location = { lat: e.latlng.lat, lng: e.latlng.lng };
        setTempLocation(newLoc);
        setMemoryText('');
        setImageFiles([]);

        const { tempIcon } = createIcons();

        if (tempMarkerRef.current) {
            mapRef.current.removeLayer(tempMarkerRef.current);
        }

        tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon }).addTo(mapRef.current);
        mapRef.current.panTo(e.latlng);
    }, []);

    const setupMap = useCallback((): void => {
        // Defensive check to ensure L is fully ready and the container exists
        if (mapRef.current || typeof L === 'undefined' || typeof L.map !== 'function' || !document.getElementById('map')) return;

        const map = L.map('map').setView([20, 0], 2);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        markerLayerRef.current = new L.LayerGroup().addTo(map);

        map.on('click', handleMapClick);

        // Required call for Leaflet when map container size might have changed
        setTimeout(() => map.invalidateSize(), 100);

    }, [handleMapClick]);

    // Dynamic Leaflet Loading and Initialization (Ensure Leaflet CSS/JS are loaded)
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
            if (typeof L !== 'undefined' && typeof L.map === 'function') {
                setIsMapLoaded(true);
                return;
            }
            if (document.querySelector('script[src*="leaflet.js"]')) return;

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = false;

            script.onload = () => {
                if (typeof L !== 'undefined' && typeof L.map === 'function') {
                    setIsMapLoaded(true);
                } else {
                    console.error("Leaflet script loaded, but L.map is still unavailable.");
                }
            };
            document.head.appendChild(script);
        };

        loadLeafletCss();
        loadLeafletJs();
    }, []);

    // This effect runs once map dependencies (Leaflet script load) and auth are ready
    useEffect(() => {
        if (isAuthReady && isMapLoaded) {
            setupMap();
        }
    }, [isAuthReady, isMapLoaded, setupMap]);

    // Real-time Listener for Memories
    useEffect(() => {
        if (!isAuthReady || !isMapLoaded) return;

        const memoriesCollection = getMemoryCollectionRef();
        if (!memoriesCollection) return;

        const q: Query<Memory> = query(memoriesCollection) as Query<Memory>;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMemories: Memory[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as Memory;
                newMemories.push({
                    id: doc.id,
                    story: data.story,
                    location: data.location,
                    contributorId: data.contributorId,
                    timestamp: data.timestamp,
                    imageUrls: data.imageUrls || [],
                });
            });
            setMemories(newMemories);

        }, (error) => {
            console.error("Error listening to memories:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, isMapLoaded, getMemoryCollectionRef]);


    // Marker Rendering Effect (Includes 'View Photos' button logic)
    useEffect(() => {
        if (!mapRef.current || !markerLayerRef.current || typeof L === 'undefined') return;

        markerLayerRef.current.clearLayers();
        const { memorialIcon } = createIcons();

        memories.forEach(memory => {
            const { lat, lng } = memory.location;
            const date: string = memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Date Unknown';

            // Generate HTML for the 'View Photos' button
            const imageHtml = memory.imageUrls.length > 0
                ? `<div class="mt-3 mb-3 border-t pt-2 border-gray-200">
                    <button 
                        id="view-images-pin-${memory.id}" 
                        class="w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition duration-150 shadow-md"
                    >
                        View ${memory.imageUrls.length} Photo${memory.imageUrls.length !== 1 ? 's' : ''}
                    </button>
                   </div>`
                : '';

            let popupContent: string = `
                <div class="p-2 text-gray-800 font-sans">
                    <h3 class="font-bold text-lg mb-1">A Memory Shared</h3>
                    <p class="mb-2 text-sm italic">${memory.story.replace(/\n/g, '<br>')}</p>
                    
                    ${imageHtml} 

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


            const marker = L.marker([lat, lng], { icon: memorialIcon })
                .bindPopup(popupContent, { maxWidth: 300, maxHeight: 400 })
                .addTo(markerLayerRef.current);

            marker.on('popupopen', () => {
                // Attach event listener for the Delete button
                if (isAuthorizedToPost) {
                    const deleteButton = document.getElementById(`delete-pin-${memory.id}`);
                    if (deleteButton) {
                        deleteButton.onclick = () => deleteMemory(memory.id);
                    }
                }

                // Attach event listener for the View Images button
                const viewImagesButton = document.getElementById(`view-images-pin-${memory.id}`);
                if (viewImagesButton) {
                    viewImagesButton.onclick = () => {
                        // This sets the React state, which triggers the modal render
                        setSelectedImageUrls(memory.imageUrls);
                    };
                }
            });
        });
    }, [memories, isAuthorizedToPost]);


    // --- UI Rendering Logic ---

    const selectedLocationText: string = tempLocation
        ? `Selected: Lat ${tempLocation.lat.toFixed(4)}, Lng ${tempLocation.lng.toFixed(4)}`
        : 'No location selected. Click the map!';

    const loadingMap: boolean = !mapRef.current && isAuthReady && !isMapLoaded;
    const loadingAuth: boolean = !isAuthReady;

    // Determine the button text based on state
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
                        <form className="flex space-x-2" onSubmit={(e: React.FormEvent) => { e.preventDefault(); checkAuthorizationKey(); }}>
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
                                className="px-5 py-3 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition duration-150 disabled:opacity-50"
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
                            onClick={addMemory}
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
