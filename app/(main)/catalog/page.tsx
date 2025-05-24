'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FontFamily, FontFormat, Classification, CLASSIFICATION_VALUES, FONT_FORMAT_VALUES } from "@/models/font.models"; // Import models & values
import FontFamilyCard from "@/components/font/FamilyCard";
import { getAllFontFamilies } from '@/lib/db/firestoreUtils'; // To fetch all data
import { Timestamp } from 'firebase/firestore';
import Fuse from 'fuse.js';

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

export default function CatalogPage() {
  const [allFamilies, setAllFamilies] = useState<FontFamily[]>([]);
  const [displayedFamilies, setDisplayedFamilies] = useState<FontFamily[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<{
    classification: Classification | null;
    format: FontFormat | null;
    isVariable: boolean | null;
  }>({ classification: null, format: null, isVariable: null });

  // Fetch all font families once on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const rawFamilies = await getAllFontFamilies();
        const serialized = serializeFamilies(rawFamilies);
        setAllFamilies(serialized);
        setDisplayedFamilies(serialized); // Initially display all
      } catch (error) {
        console.error("Error fetching font families:", error);
        // Handle error display if necessary
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const fuseInstance = useMemo(() => new Fuse(allFamilies, fuseOptions), [allFamilies]);

  // Handle search and filtering
  useEffect(() => {
    let results = allFamilies;

    // Apply text search with Fuse.js
    if (searchTerm.trim() !== '') {
      results = fuseInstance.search(searchTerm.trim()).map(result => result.item);
    } else {
      // If no search term, start with all families for filtering
      results = [...allFamilies];
    }

    // Apply filters
    if (activeFilters.classification) {
      results = results.filter(family => family.classification === activeFilters.classification);
    }
    if (activeFilters.format) {
      results = results.filter(family => family.fonts.some(font => font.format === activeFilters.format));
    }
    if (activeFilters.isVariable !== null) {
      results = results.filter(family =>
        family.fonts.some(font => font.isVariable === activeFilters.isVariable)
      );
    }

    setDisplayedFamilies(results);
  }, [searchTerm, allFamilies, fuseInstance, activeFilters]);

  const handleFilterChange = (filterType: keyof typeof activeFilters, value: any) => {
    setActiveFilters(prev => ({
        ...prev,
        [filterType]: prev[filterType] === value ? null : value // Toggle on/off or set value
    }));
  };

  const clearFilters = () => {
    setActiveFilters({ classification: null, format: null, isVariable: null });
    setSearchTerm(''); // Optionally clear search term too
  };

  // --- Render Logic ---
  if (isLoading) {
    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="container mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">Font Catalog</h1>
                </div>
                <p className="text-center text-xl">Loading font catalog...</p>
            </div>
        </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-gray-800">Font Catalog</h1>
          <Link href="/upload" className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors whitespace-nowrap">
            Upload Fonts
          </Link>
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
                                className={`block w-full text-left px-3 py-1.5 text-sm rounded mb-1
                                            ${activeFilters.classification === c ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>
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
                                className={`block w-full text-left px-3 py-1.5 text-sm rounded mb-1
                                            ${activeFilters.format === f ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* Variable Font Filter */}
                    <div>
                        <h4 className="text-md font-semibold mb-2 text-gray-600">Type</h4>
                        <button onClick={() => handleFilterChange('isVariable', true)}
                                className={`block w-full text-left px-3 py-1.5 text-sm rounded mb-1 ${activeFilters.isVariable === true ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>Variable</button>
                        <button onClick={() => handleFilterChange('isVariable', false)}
                                className={`block w-full text-left px-3 py-1.5 text-sm rounded mb-1 ${activeFilters.isVariable === false ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>Static</button>
                    </div>

                    <button
                        onClick={clearFilters}
                        className="w-full mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                        Clear All Filters
                    </button>
                </div>
            </aside>

            {/* Results Area */}
            <div className="w-full md:w-3/4">
                {displayedFamilies.length === 0 && searchTerm && (
                    <p className="text-center text-gray-600">No families match your search "{searchTerm}".</p>
                )}
                 {displayedFamilies.length === 0 && !searchTerm && !isLoading && (
                    <p className="text-center text-gray-600">No font families found. Try adjusting filters or upload some fonts!</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                    {displayedFamilies.map((family) => (
                        <FontFamilyCard key={family.id} family={family} />
                    ))}
                </div>
                {/* Basic Pagination (can be enhanced) - For now, all results are shown and filtered client-side */}
            </div>
        </div>
      </div>
    </main>
  );
}
