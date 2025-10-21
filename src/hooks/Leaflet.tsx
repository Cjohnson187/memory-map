import { useState, useEffect, useRef, useCallback } from 'react';
import type { Location, LeafletMap, LeafletLayer, Memory } from '../types/Types.ts';
import { deleteMemory } from '../services/CRUD';

// Assumed global L variable from the Leaflet script load
declare const L: any;

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


interface UseLeafletMapProps {
    memories: Memory[];
    isAuthorizedToPost: boolean;
    setTempLocation: (loc: Location | null) => void;
    setAuthMessage: (msg: string) => void;
    setSelectedImageUrls: (urls: string[] | null) => void;
    setErrorMessage: (msg: string | null) => void;
}

export const useLeafletMap = ({
                                  memories,
                                  isAuthorizedToPost,
                                  setTempLocation,
                                  setAuthMessage,
                                  setSelectedImageUrls,
                                  setErrorMessage,
                              }: UseLeafletMapProps) => {

    const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

    // Refs for Leaflet Instances
    const mapRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<LeafletLayer | null>(null);
    const tempMarkerRef = useRef<LeafletLayer | null>(null);

    // Ref to hold current authorization status
    const authStatusRef = useRef<boolean>(isAuthorizedToPost);
    useEffect(() => {
        authStatusRef.current = isAuthorizedToPost;
    }, [isAuthorizedToPost]);


    // Map Click Handler (to place temporary pin)
    const handleMapClick = useCallback((e: any): void => {
        if (typeof L === 'undefined' || !mapRef.current) return;

        if (!authStatusRef.current) {
            setAuthMessage("You must be authorized to select a location for a new pin.");
            return;
        }

        const newLoc: Location = { lat: e.latlng.lat, lng: e.latlng.lng };
        // This is where we update the state in the App component to show the form
        setTempLocation(newLoc);

        const { tempIcon } = createIcons();

        if (tempMarkerRef.current) {
            mapRef.current.removeLayer(tempMarkerRef.current);
        }

        tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon }).addTo(mapRef.current);
        mapRef.current.panTo(e.latlng);
    }, [setTempLocation, setAuthMessage]);

    // Setup and Initialization of the Leaflet Map
    const setupMap = useCallback((): void => {
        if (mapRef.current || typeof L === 'undefined' || typeof L.map !== 'function' || !document.getElementById('map')) return;

        const map = L.map('map').setView([20, 0], 2);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        markerLayerRef.current = new L.LayerGroup().addTo(map);

        map.on('click', handleMapClick);

        setTimeout(() => map.invalidateSize(), 100);

    }, [handleMapClick]);


    // Dynamic Leaflet Loading
    useEffect(() => {
        // ... (Leaflet CSS and JS loading functions from the original code)
        const loadLeafletCss = (): void => {
            if (document.querySelector('link[href*="leaflet.css"]')) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        };

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

    // Effect to run map setup when Leaflet is loaded
    useEffect(() => {
        if (isMapLoaded) {
            setupMap();
        }
    }, [isMapLoaded, setupMap]);


    // Marker Rendering Effect
    useEffect(() => {
        if (!mapRef.current || !markerLayerRef.current || typeof L === 'undefined') return;

        markerLayerRef.current.clearLayers();
        const { memorialIcon } = createIcons();

        memories.forEach(memory => {
            const { lat, lng } = memory.location;
            const date: string = memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Date Unknown';

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
                        deleteButton.onclick = async () => {
                            try {
                                await deleteMemory(memory.id);
                            } catch(e) {
                                setErrorMessage("Failed to delete memory pin.");
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
    }, [memories, isAuthorizedToPost, setSelectedImageUrls, setErrorMessage]); // Dependencies


    return { isMapLoaded, tempMarkerRef, mapRef };
};
