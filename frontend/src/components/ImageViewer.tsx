import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface ImageModalProps {
    imageUrls: string[] | null;
    onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrls, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const totalImages = imageUrls?.length || 0;

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex === 0 ? totalImages - 1 : prevIndex - 1));
    }, [totalImages]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex === totalImages - 1 ? 0 : prevIndex + 1));
    }, [totalImages]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [totalImages]);

    // Keyboard navigation logic
    useEffect(() => {
        if (totalImages === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrevious();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrevious, onClose, totalImages]);

    if (totalImages === 0 || !imageUrls) return null;

    const currentUrl = imageUrls[currentIndex];

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
