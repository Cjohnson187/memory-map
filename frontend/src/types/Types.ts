export interface Location {
    lat: number;
    lng: number;
}

export interface Memory {
    id: string;
    story: string;
    location: Location;
    contributorId: string;
    timestamp: number;
    imageUrls: string[];
}

export interface AddMemoryRequest {
    location: { lat: number; lng: number };
    story: string;
    imageUrls: string[];
}

// Global types for Leaflet instances
export type LeafletMap = any;
export type LeafletLayer = any;
