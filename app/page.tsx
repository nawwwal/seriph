'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { FontFamily, FontFormat, Classification, CLASSIFICATION_VALUES, FONT_FORMAT_VALUES } from "@/models/font.models"; // Import models & values
import FontFamilyCard from "@/components/font/FamilyCard";
import { getAllFontFamilies } from '@/lib/db/firestoreUtils'; // To fetch all data
import { Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import Fuse from 'fuse.js';
import LoadingSpinner from '@/components/ui/LoadingSpinner'; // Import the spinner
import Modal from '@/components/ui/Modal'; // Added Modal import
import ModalUploadForm from '@/components/font/ModalUploadForm'; // Changed from UploadForm

const ITEMS_PER_PAGE = 12; // Number of items to load per page

// Helper to serialize Firestore Timestamps (as before)
const serializeFamilies = (families: any[]): FontFamily[] => {
  return families.map(family => ({
    ...family,
    uploadDate: family.uploadDate instanceof Timestamp ? family.uploadDate.toDate().toISOString() : String(family.uploadDate),
    lastModified: family.lastModified instanceof Timestamp ? family.lastModified.toDate().toISOString() : String(family.lastModified),
  }));
};

const fuseOptions = {
  keys: [
    { name: 'name', weight: 0.4 }, // Higher weight for family name
    { name: 'normalizedName', weight: 0.3 },
    { name: 'metadata.foundry', weight: 0.2 },
    { name: 'tags', weight: 0.2 }, // Assuming tags is an array of strings
    { name: 'classification', weight: 0.15 },
    { name: 'fonts.subfamily', weight: 0.1 }, // Search in subfamily names within the fonts array
    { name: 'fonts.format', weight: 0.05 }
  ],
  threshold: 0.4, // Adjust for fuzziness (0 to 1, 0 is exact match)
  includeScore: true,
  minMatchCharLength: 2,
  // You might want to add more options like ignoreLocation: true if positions don't matter much
};

const CACHE_KEY_FIRST_PAGE = 'fontFamiliesCache_firstPage';
const CACHE_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

export default function HomePage() { // Renamed from CatalogPage to HomePage
  const [allFetchedFamilies, setAllFetchedFamilies] = useState<FontFamily[]>([]);
  const [displayedFamilies, setDisplayedFamilies] = useState<FontFamily[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot<FontFamily> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // Added state for modal

  const [activeFilters, setActiveFilters] = useState<{
    classification: Classification | null;
    format: FontFormat | null;
    isVariable: boolean | null;
    tags: string[];
  }>({ classification: null, format: null, isVariable: null, tags: [] });

  const loadFamilies = useCallback(async (isInitialLoad: boolean) => {
    if (isInitialLoad) setIsLoading(true);
    else setIsLoadingMore(true);
    if (isInitialLoad) setError(null);

    try {
      if (isInitialLoad) {
        // Try loading the first page from cache
        const cached = localStorage.getItem(CACHE_KEY_FIRST_PAGE);
        if (cached) {
          const { timestamp, data, nextDocTimestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRATION_MS && data.length > 0) {
            console.log("Loading first page from cache.");
            const serializedCache = serializeFamilies(data); // Re-serialize in case of object structure issues from cache
            setAllFetchedFamilies(serializedCache);
            // Note: lastVisibleDoc cannot be perfectly recreated from simple JSON,
            // so pagination after cache hit will always refetch from start OR we simplify cache.
            // For simplicity, if cache is hit, we won't use a cached lastVisibleDoc for the *next* load more.
            // The background fetch will establish the correct lastVisibleDoc.
            setHasMore(true); // Assume more if cache had items, will be corrected by background fetch
            setIsLoading(false);
          }
        }
      }

      // Fetch from Firestore
      const { families: newFamiliesRaw, nextLastVisible: newNextDoc } = await getAllFontFamilies(
        ITEMS_PER_PAGE,
        isInitialLoad ? undefined : (lastVisibleDoc || undefined) // Ensure undefined if null
      );
      const serializedNewFamilies = serializeFamilies(newFamiliesRaw);

      setAllFetchedFamilies(prev => isInitialLoad ? serializedNewFamilies : [...prev, ...serializedNewFamilies]);
      setLastVisibleDoc(newNextDoc);
      setHasMore(newNextDoc !== null && newNextDoc !== undefined);

      if (isInitialLoad && serializedNewFamilies.length > 0 && (!localStorage.getItem(CACHE_KEY_FIRST_PAGE) || Date.now() - JSON.parse(localStorage.getItem(CACHE_KEY_FIRST_PAGE)!).timestamp >= CACHE_EXPIRATION_MS)) {
         // Cache only the first page and if it's not already fresh in cache
         localStorage.setItem(CACHE_KEY_FIRST_PAGE, JSON.stringify({ timestamp: Date.now(), data: serializedNewFamilies.slice(0, ITEMS_PER_PAGE)}));
      }

    } catch (err) {
      console.error("Error fetching font families:", err);
      setError("Sorry, we couldn't load the font families. Please try refreshing the page.");
    } finally {
      if (isInitialLoad) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [lastVisibleDoc]); // lastVisibleDoc is a dependency for subsequent loads

  // Initial data load
  useEffect(() => {
    loadFamilies(true);
  }, [loadFamilies]); // loadFamilies is memoized with useCallback

  const fuseInstance = useMemo(() => new Fuse(allFetchedFamilies, fuseOptions), [allFetchedFamilies]);

  // Extract unique tags for the filter UI
  const uniqueTags = useMemo(() => {
    const allTags = new Set<string>();
    allFetchedFamilies.forEach(family => {
      family.tags?.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }, [allFetchedFamilies]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Handle search and filtering - now using allFetchedFamilies
  useEffect(() => {
    let results = allFetchedFamilies;
    if (debouncedSearchTerm.trim() !== '') {
      results = fuseInstance.search(debouncedSearchTerm.trim()).map(result => result.item);
    } else {
      results = [...allFetchedFamilies]; // Start with all *fetched* families if no search term
    }

    if (activeFilters.classification) {
      results = results.filter(family => family.classification === activeFilters.classification);
    }
    if (activeFilters.format) {
      results = results.filter(family => family.fonts.some(font => font.format === activeFilters.format));
    }
    if (activeFilters.isVariable !== null) {
      results = results.filter(family => family.fonts.some(font => font.isVariable === activeFilters.isVariable));
    }
    if (activeFilters.tags.length > 0) {
      results = results.filter(family => activeFilters.tags.some(activeTag => family.tags?.includes(activeTag)));
    }
    setDisplayedFamilies(results);
  }, [debouncedSearchTerm, allFetchedFamilies, fuseInstance, activeFilters]);

  const handleFilterChange = (filterType: keyof Omit<typeof activeFilters, 'tags'>, value: any) => {
    setActiveFilters(prev => ({ ...prev, [filterType]: prev[filterType] === value ? null : value }));
  };

  const handleTagFilterChange = (tag: string) => {
    setActiveFilters(prev => {
      const newTags = prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag];
      return { ...prev, tags: newTags };
    });
  };

  const clearFilters = () => {
    setActiveFilters({ classification: null, format: null, isVariable: null, tags: [] });
    setSearchTerm('');
  };

  const handleUploadFinished = () => {
    setIsUploadModalOpen(false); // Close the modal
    // Reset lastVisibleDoc to ensure fresh load from the beginning if caching is involved
    // or if we want to ensure the very latest data including newly uploaded items is on page 1.
    setLastVisibleDoc(null);
    loadFamilies(true); // Refresh the catalog data from the first page
  };

  // --- Render Logic ---
  if (isLoading && allFetchedFamilies.length === 0) {
    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center justify-center">
            <div className="container mx-auto text-center">
                {/* <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">Font Catalog</h1>
                </div> */}
                <LoadingSpinner text="Loading Font Catalog..." size="large" />
            </div>
        </main>
    );
  }

  if (error && allFetchedFamilies.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800">Font Catalog</h1>
          </div>
          <div className="text-center p-10 border border-red-300 bg-red-50 rounded-md">
            <p className="text-xl text-red-600">{error}</p>
            <button
              onClick={() => loadFamilies(true)}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-gray-800">Font Catalog</h1>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            Upload Fonts
          </button>
        </div>

        {/* Search Box */}
        <div className="mb-8 p-4 bg-white shadow rounded-lg">
          <input
            type="search"
            placeholder="Search by name, foundry, tag, classification..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:flex md:space-x-6">
            {/* Filters Sidebar */}
            <aside className="w-full md:w-1/4 mb-8 md:mb-0">
                <div className="bg-white p-4 shadow rounded-lg space-y-6">
                    <h3 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">Filters</h3>

                    {/* Classification Filter */}
                    <div>
                        <h4 className="text-md font-semibold mb-2 text-gray-600">Classification</h4>
                        {CLASSIFICATION_VALUES.map((c: Classification) => (
                            <button
                                key={c}
                                onClick={() => handleFilterChange('classification', c)}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-all duration-150 ease-in-out
                                            ${activeFilters.classification === c
                                                ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-300'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900'}`}>
                                {c}
                            </button>
                        ))}
                    </div>

                    {/* Format Filter */}
                    <div>
                        <h4 className="text-md font-semibold mb-2 text-gray-600">Format</h4>
                        {FONT_FORMAT_VALUES.map((f: FontFormat) => (
                            <button
                                key={f}
                                onClick={() => handleFilterChange('format', f)}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-all duration-150 ease-in-out
                                            ${activeFilters.format === f
                                                ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-300'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900'}`}>
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* Variable Font Filter */}
                    <div>
                        <h4 className="text-md font-semibold mb-2 text-gray-600">Type</h4>
                        <button onClick={() => handleFilterChange('isVariable', true)}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-all duration-150 ease-in-out
                                            ${activeFilters.isVariable === true
                                                ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-300'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900'}`}>Variable</button>
                        <button onClick={() => handleFilterChange('isVariable', false)}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-all duration-150 ease-in-out
                                            ${activeFilters.isVariable === false
                                                ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-300'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900'}`}>Static</button>
                    </div>

                    {/* Tags Filter */}
                    {uniqueTags.length > 0 && (
                        <div>
                            <h4 className="text-md font-semibold mb-2 text-gray-600">Tags</h4>
                            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                {uniqueTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => handleTagFilterChange(tag)}
                                        className={`block w-full text-left px-3 py-2 text-sm rounded-md mb-1 transition-all duration-150 ease-in-out
                                                    ${activeFilters.tags.includes(tag)
                                                        ? 'bg-purple-500 text-white shadow-sm ring-2 ring-purple-300'
                                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900'}`}>
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={clearFilters}
                        disabled={!searchTerm && activeFilters.classification === null && activeFilters.format === null && activeFilters.isVariable === null && activeFilters.tags.length === 0}
                        className="w-full mt-4 px-4 py-2.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed shadow hover:shadow-md">
                        Clear All Filters
                    </button>
                </div>
            </aside>

            {/* Results Area */}
            <div className="w-full md:w-3/4">
                {displayedFamilies.length === 0 && debouncedSearchTerm && !isLoading && (
                    <div className="text-center py-12 px-6 bg-white shadow rounded-lg">
                        {/* Optional: Icon here e.g. <SearchX size={48} className="mx-auto mb-4 text-gray-400" /> */}
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Matches Found</h3>
                        <p className="text-gray-500">No font families match your search for "<span className='font-medium text-gray-700'>{debouncedSearchTerm}</span>".</p>
                        <p className="text-gray-500 mt-1">Try a different search term or adjust your filters.</p>
                    </div>
                )}
                 {displayedFamilies.length === 0 && !debouncedSearchTerm && !isLoading && allFetchedFamilies.length === 0 && (
                    <div className="text-center py-12 px-6 bg-white shadow rounded-lg">
                        {/* Optional: Icon here e.g. <ArchiveX size={48} className="mx-auto mb-4 text-gray-400" /> */}
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Font Families Yet</h3>
                        <p className="text-gray-500">Your catalog is currently empty.</p>
                        <Link href="/upload" className="mt-4 inline-block px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                            Upload Your First Font
                        </Link>
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                    {displayedFamilies.map((family) => (
                        <FontFamilyCard key={family.id} family={family} />
                    ))}
                </div>
                {/* Load More Button */}
                {hasMore && !isLoading && !debouncedSearchTerm && (
                    <div className="mt-10 text-center">
                        <button
                            onClick={() => loadFamilies(false)} // false for not initial load
                            disabled={isLoadingMore}
                            className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-lg font-semibold"
                        >
                            {isLoadingMore ? 'Loading More...' : 'Load More Fonts'}
                        </button>
                    </div>
                )}
                 {!hasMore && !isLoading && !debouncedSearchTerm && allFetchedFamilies.length > 0 && (
                    <div className="text-center py-8 mt-10">
                         {/* Optional: Icon here e.g. <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" /> */}
                        <p className="text-lg text-gray-500">You've reached the end of the font catalog.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Fonts"
        labelledById="upload-fonts-modal-title"
        size="xl" // Or your preferred size for upload form
      >
        <ModalUploadForm onUploadComplete={handleUploadFinished} />
      </Modal>
    </main>
  );
}
