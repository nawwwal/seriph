'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation'; // Import useParams
import Link from 'next/link';
import { FontFamily, Font as FontVariant } from '@/models/font.models';
import { getFontFamilyById } from '@/lib/db/firestoreUtils';
import { Timestamp } from 'firebase/firestore';
import { Download } from "lucide-react";
import VariableFontPlayground from "@/components/font/VariableFontPlayground";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Modal from "@/components/ui/Modal"; // Import the Modal component

// Helper to serialize Firestore Timestamps (similar to CatalogPage)
// This helper is not strictly needed here anymore as serialization is done inline
// but can be kept if used elsewhere or for future refactoring.
const serializeFamilyData = (family: any): FontFamily | null => {
  if (!family) return null;
  return {
    ...family,
    uploadDate: family.uploadDate instanceof Timestamp ? family.uploadDate.toDate().toISOString() : String(family.uploadDate),
    lastModified: family.lastModified instanceof Timestamp ? family.lastModified.toDate().toISOString() : String(family.lastModified),
    fonts: family.fonts ? family.fonts.map((font: any) => ({ ...font })) : [], // Ensure fonts array is mapped even if empty
  };
};

// Remove FamilyDetailPageProps as params will come from the hook
// interface FamilyDetailPageProps {
// params: { familyId: string };
// }

export default function FamilyDetailPage(/* { params }: FamilyDetailPageProps */) {
  const routeParams = useParams<{ familyId: string }>(); // Use the hook
  const familyId = routeParams.familyId; // Extract familyId

  const [family, setFamily] = useState<FontFamily | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for download modal
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedSubfamilyForDownload, setSelectedSubfamilyForDownload] = useState<{
    name: string;
    variants: FontVariant[];
  } | null>(null);

  // Group fonts by subfamily - MOVED UP
  const groupedFontsBySubfamily = useMemo(() => {
    if (!family || !family.fonts) return {}; // Still check for family here, but hook is always called
    return family.fonts.reduce((acc, font) => {
      const key = font.subfamily || 'Unknown Subfamily';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(font);
      return acc;
    }, {} as { [subfamilyName: string]: FontVariant[] });
  }, [family]);

  useEffect(() => {
    if (!familyId) {
      // This case might occur if useParams returns an empty object initially or familyId is undefined
      // Though typically for a route like /family/[familyId], familyId should be a string.
      // Adding a check just in case.
      setError("Font family ID is not available in the route.");
      setIsLoading(false);
      return;
    }

    const fetchFamilyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rawFamilyData = await getFontFamilyById(familyId); // familyId is now definitely a string or caught above
        if (rawFamilyData) {
          // Serialize dates and ensure fonts array is correctly structured
          const processedFamily = {
            ...rawFamilyData,
            uploadDate: rawFamilyData.uploadDate && typeof rawFamilyData.uploadDate === 'object' && 'toDate' in rawFamilyData.uploadDate
                          ? (rawFamilyData.uploadDate as Timestamp).toDate().toISOString()
                          : String(rawFamilyData.uploadDate || ''),
            lastModified: rawFamilyData.lastModified && typeof rawFamilyData.lastModified === 'object' && 'toDate' in rawFamilyData.lastModified
                          ? (rawFamilyData.lastModified as Timestamp).toDate().toISOString()
                          : String(rawFamilyData.lastModified || ''),
            fonts: rawFamilyData.fonts ? rawFamilyData.fonts.map((font: any) => ({
              ...font,
              // Ensure any nested timestamps within font.metadata are also handled if they exist in your model in future
            })) : [],
          };
          setFamily(processedFamily as FontFamily);
        } else {
          setError("Font family not found. It might have been moved or deleted.");
        }
      } catch (err) {
        console.error(`Error fetching font family ${familyId}:`, err);
        setError("Could not load the font family details. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFamilyData();
  }, [familyId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="container mx-auto text-center">
          <LoadingSpinner text="Loading font family details..." size="large" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="container mx-auto">
          <div className="text-center p-10 border border-red-300 bg-red-50 rounded-md">
            <p className="text-xl text-red-600">{error}</p>
            <Link href="/catalog" className="mt-4 inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors">
              Back to Catalog
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!family) {
    // This case should ideally be caught by the error state if familyId was present but not found
    // Or if familyId was invalid from the start.
    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="container mx-auto text-center">
                <p className="text-xl text-gray-700">Font family not found or ID is invalid.</p>
                <Link href="/catalog" className="mt-4 inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors">
                    Back to Catalog
                </Link>
            </div>
        </main>
    );
  }

  // For debugging AI data issue - you can uncomment this temporarily
  // console.log("Current family state:", JSON.stringify(family, null, 2));

  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-5xl">
        {/* Back to Catalog Link */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800 transition-colors duration-150 ease-in-out">
            &larr; Back to Catalog
          </Link>
        </div>

        {/* Family Header */}
        <header className="mb-10 pb-6 border-b border-gray-300">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">{family.name}</h1>
          {family.metadata?.foundry && (
            <p className="text-xl text-gray-600">By {family.metadata.foundry}</p>
          )}
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10"> {/* Increased gap slightly */}
          {/* Left Column (Details & Metadata) */}
          <div className="md:col-span-1 space-y-8"> {/* Increased space-y */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-700 mb-3">Description</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {family.description || 'No description available.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-700 mb-3">Details</h2>
              <dl className="space-y-2.5 text-sm text-gray-600"> {/* Slightly increased space-y in dl */}
                <div>
                  <dt className="font-medium text-gray-800">Classification:</dt>
                  <dd>{family.classification}</dd>
                </div>
                {family.metadata?.subClassification && (
                  <div>
                    <dt className="font-medium text-gray-800">Sub-Classification:</dt>
                    <dd>{family.metadata.subClassification}</dd>
                  </div>
                )}
                {family.uploadDate && (
                  <div>
                    <dt className="font-medium text-gray-800">Uploaded:</dt>
                    <dd>{new Date(family.uploadDate).toLocaleDateString()}</dd>
                  </div>
                )}
                {family.lastModified && (
                  <div>
                    <dt className="font-medium text-gray-800">Last Modified:</dt>
                    <dd>{new Date(family.lastModified).toLocaleDateString()}</dd>
                  </div>
                )}
                {family.metadata?.moods && family.metadata.moods.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-800">Moods:</dt>
                    <dd>{family.metadata.moods.join(', ')}</dd>
                  </div>
                )}
                 {family.metadata?.useCases && family.metadata.useCases.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-800">Recommended Use Cases:</dt>
                    <dd>{family.metadata.useCases.join(', ')}</dd>
                  </div>
                )}
                {family.metadata?.technicalCharacteristics && family.metadata.technicalCharacteristics.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-800">Technical Notes:</dt>
                    <dd>{family.metadata.technicalCharacteristics.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </section>

            {family.tags && family.tags.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-gray-700 mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {family.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column (Font Variants & Downloads) */}
          <div className="md:col-span-2">
            {/* REMOVED the old "Font Styles & Variants" section and "Live Preview" placeholder section */}
            {/* This is the main section for variants */}
            <div> {/* Removed mt-10 from here, spacing handled by grid gap and section above */}
              <h3 className="text-3xl font-semibold text-gray-800 mb-6 pb-3 border-b border-gray-300">
                Font Variants & Downloads
              </h3>
              {family.fonts && family.fonts.length > 0 ? (
                <ul className="space-y-10">
                  {Object.entries(groupedFontsBySubfamily).map(([subfamilyName, variants]) => {
                    const variableVariantWithAxes = variants.find(v => v.isVariable && v.variableAxes && v.variableAxes.length > 0);

                    return (
                      <li key={subfamilyName} className="p-5 border border-gray-300 rounded-lg bg-white shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
                          <div>
                            <h4 className="text-2xl font-semibold text-gray-800 mb-1">{subfamilyName}</h4>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {variants.map(variant => (
                                <span key={variant.id} className="px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                                  {variant.format}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedSubfamilyForDownload({ name: subfamilyName, variants });
                              setIsDownloadModalOpen(true);
                            }}
                            className="mt-3 sm:mt-0 shrink-0 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm font-medium whitespace-nowrap shadow hover:shadow-md"
                          >
                            <Download size={18} className="mr-2" />
                            Download {subfamilyName}
                          </button>
                        </div>

                        {/* Display metadata from the first variant as representative (can be improved) */}
                        {variants.length > 0 && (
                          <div className="text-xs text-gray-600 space-y-1.5 mt-3 pt-3 border-t border-gray-200 mb-4">
                            {variants[0].metadata?.postScriptName && <p><span className="font-medium text-gray-700">PostScript Name:</span> {variants[0].metadata.postScriptName}</p>}
                            {variants[0].metadata?.version && <p><span className="font-medium text-gray-700">Version:</span> {variants[0].metadata.version}</p>}
                            {variants[0].metadata?.copyright && <p><span className="font-medium text-gray-700">Copyright:</span> {String(variants[0].metadata.copyright).substring(0,100)}{String(variants[0].metadata.copyright).length > 100 ? '...' : ''}</p>}
                            {/* Add other common metadata if desired */}
                          </div>
                        )}

                        {/* If a variable font with axes exists in this group, show the playground */}
                        {variableVariantWithAxes && (
                          <VariableFontPlayground font={variableVariantWithAxes} fontFamilyName={family.name} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
                     <h3 className="text-lg font-semibold text-gray-700 mb-2">No Variants Available</h3>
                     <p className="text-gray-500">This font family currently has no specific font variants listed.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Download Options Modal */}
      {selectedSubfamilyForDownload && (
        <Modal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          title={`Download Options for ${selectedSubfamilyForDownload.name}`}
          labelledById="download-modal-title"
          size="md"
        >
          <ul className="space-y-3">
            {selectedSubfamilyForDownload.variants.map(variant => (
              <li key={variant.id} className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                <a
                  href={variant.downloadUrl}
                  download={variant.filename} // Suggests the original filename
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-blue-600 hover:text-blue-800 group"
                >
                  <div>
                    <span className="font-medium">{variant.format}</span>
                    <span className="text-xs text-gray-500 ml-2">({(variant.fileSize / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Download size={20} className="text-gray-400 group-hover:text-blue-700 transition-colors" />
                </a>
              </li>
            ))}
          </ul>
          {selectedSubfamilyForDownload.variants.length === 0 && (
            <p className="text-gray-600">No specific download formats found for this style.</p>
          )}
        </Modal>
      )}
    </main>
  );
}
