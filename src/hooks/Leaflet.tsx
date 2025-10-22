import { useState, useEffect, useRef} from 'react';
import type { Location, LeafletMap, LeafletLayer, Memory } from '../types/Types.ts';
import { deleteMemory } from '../services/CRUD.tsx'; // Import secure deleteMemory

// Assumed global L variable from the Leaflet script load
declare const L: any;

// --- Custom Leaflet Icons (Base64 SVG) ---
const createIcons = () => {
    if (typeof L === 'undefined') return { tempIcon: null, memorialIcon: null };

    // Pin icon for new temporary pin (Blue)
    const tempIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="%233b82f6" stroke-width="2"><circle cx="16" cy="16" r="14" fill="%233b82f6" stroke="white" stroke-width="3"/><path d="M16 8v16M8 16h16" stroke="white" stroke-width="3"/></svg>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -28]
    });

    // Pin icon for saved memories (Purple)
    const memorialIcon = new L.Icon({
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%235b21b6" stroke="%23ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path><circle cx="12" cy="9" r="3" fill="%23ffffff"/></svg>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -32]
    });

    return { tempIcon, memorialIcon };
};


// --- Custom Hook for Leaflet Map Logic ---

interface UseLeafletMapProps {
    memories: Memory[];
    isAuthorizedToPost: boolean;
    tempLocation: Location | null;
    setTempLocation: (location: Location | null) => void;
    setSelectedImageUrls: (urls: string[] | null) => void;
    setErrorMessage: (message: string | null) => void;
    setIsAuthorizedToPost: (authorized: boolean) => void;
}

export const useLeafletMap = (
    memories: Memory[],
    isAuthorizedToPost: boolean,
    tempLocation: Location | null,
    setTempLocation: (location: Location | null) => void,
    setSelectedImageUrls: (urls: string[] | null) => void,
    setErrorMessage: (message: string | null) => void,
    setIsAuthorizedToPost: (authorized: boolean) => void // Setter for revoking auth state
) => {
    const mapRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<LeafletLayer | null>(null);
    const tempMarkerRef = useRef<LeafletLayer | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Create icons once
    const { tempIcon, memorialIcon } = createIcons();

    // 1. Map Initialization
    useEffect(() => {
        if (typeof L === 'undefined' || mapRef.current) return;

        const map = L.map('map', {
            center: [39.8283, -98.5795], // Center of US
            zoom: 4,
            zoomControl: false, // Will add a custom one later
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Initialize Layer Group for permanent markers
        markerLayerRef.current = L.layerGroup().addTo(map);

        // Handle map click to place a temporary pin
        map.on('click', (e: any) => {
            const latlng: Location = { lat: e.latlng.lat, lng: e.latlng.lng };

            // Remove previous temp marker
            if (tempMarkerRef.current && map.hasLayer(tempMarkerRef.current)) {
                map.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
            }

            if (tempIcon) {
                // Add new temp marker
                const marker = L.marker([latlng.lat, latlng.lng], { icon: tempIcon }).addTo(map);
                tempMarkerRef.current = marker;
            }

            // Update React state to show the form
            setTempLocation(latlng);
        });

        mapRef.current = map;
        setIsMapLoaded(true);

        // Cleanup function for map destruction
        return () => {
            map.off('click');
            map.remove();
            mapRef.current = null;
        };

    }, []); // Run only once on mount


    // 2. Memory Marker Rendering
    useEffect(() => {
        if (!isMapLoaded || !markerLayerRef.current || !memorialIcon) return;

        // Clear existing markers to redraw the entire set
        markerLayerRef.current.clearLayers();

        memories.forEach(memory => {
            const { lat, lng } = memory.location;
            const formattedDate = new Date(memory.timestamp).toLocaleDateString();

            // Build the popup content
            let popupContent = `<div class="p-2 space-y-3 font-sans text-gray-800">`;
            popupContent += `<h3 class="text-xl font-bold text-purple-700 break-words">${memory.story.substring(0, 30)}...</h3>`;
            popupContent += `<p class="text-sm italic">${memory.story}</p>`;
            popupContent += `<div class="text-xs text-gray-500">Posted on ${formattedDate} by <span class="font-mono break-all">${memory.contributorId.substring(0, 8)}...</span></div>`;

            // If there are images, add the view button
            if (memory.imageUrls && memory.imageUrls.length > 0) {
                popupContent += `<button id="view-images-pin-${memory.id}" class="mt-2 w-full flex justify-center items-center px-3 py-2 text-sm font-semibold text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition">View ${memory.imageUrls.length} Photo(s)</button>`;
            } else {
                popupContent += `<p class="text-xs text-gray-400 mt-2">No photos attached.</p>`;
            }

            // If authorized, add the delete button
            if (isAuthorizedToPost) {
                popupContent += `<button id="delete-pin-${memory.id}" class="mt-2 w-full flex justify-center items-center px-3 py-2 text-sm font-semibold text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 transition"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 mr-1"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Delete Pin</button>`;
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
                        deleteButton.onclick = async () => {
                            try {
                                // *** authKey is NO LONGER passed to the deleteMemory function! ***
                                await deleteMemory(memory.id);

                                // Close the popup on successful delete
                                marker.closePopup();
                            } catch(e) {
                                // The CRUD service is designed to return specific error messages on API failure
                                if (e instanceof Error && (e.message.includes('401') || e.message.includes('403') || e.message.includes('Unauthorized'))) {
                                    setErrorMessage("Delete failed: Authorization revoked or expired. Please re-authorize.");
                                    setIsAuthorizedToPost(false); // Revoke client-side auth state
                                } else {
                                    setErrorMessage("Failed to delete memory pin: " + (e instanceof Error ? e.message : "Unknown error."));
                                }
                            }
                        };
                    }
                }

                // Attach event listener for the View Images button
                const viewImagesButton = document.getElementById(`view-images-pin-${memory.id}`);
                if (viewImagesButton) {
                    viewImagesButton.onclick = () => {
                        // This sets the React state in the App component via prop
                        setSelectedImageUrls(memory.imageUrls);
                    };
                }
            });
        });
    }, [memories, isAuthorizedToPost, setSelectedImageUrls, setErrorMessage, memorialIcon, setIsAuthorizedToPost]); // Removed authKey dependency


    // 3. Temporary Marker cleanup (on successful save/clear)
    useEffect(() => {
        if (!tempLocation && mapRef.current && tempMarkerRef.current && mapRef.current.hasLayer(tempMarkerRef.current)) {
            mapRef.current.removeLayer(tempMarkerRef.current);
            tempMarkerRef.current = null;
        }
    }, [tempLocation, isMapLoaded]);


    return { isMapLoaded, tempMarkerRef, mapRef };
};
