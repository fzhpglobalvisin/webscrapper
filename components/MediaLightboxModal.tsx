import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink, 
  MessageSquare, 
  Sparkles, 
  Building2, 
  Layers, 
  Maximize2,
  Calendar,
  DollarSign,
  Tag
} from 'lucide-react';
import { ProjectAsset } from '../types';

interface MediaLightboxModalProps {
  asset: ProjectAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToUrl?: (url: string) => void;
  onAskCopilotAboutAsset?: (asset: ProjectAsset) => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  asset,
  isOpen,
  onClose,
  onNavigateToUrl,
  onAskCopilotAboutAsset,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Reset zoom whenever a new asset opens
  useEffect(() => {
    setZoomLevel(1);
  }, [asset]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1);

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'floorplan':
        return 'bg-blue-600 text-white';
      case 'masterplan':
        return 'bg-emerald-600 text-white';
      case 'pricing':
        return 'bg-amber-600 text-white';
      case 'interior':
        return 'bg-purple-600 text-white';
      case 'amenity':
        return 'bg-cyan-600 text-white';
      default:
        return 'bg-indigo-600 text-white';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${getCategoryBadgeColor(asset.category)}`}>
              {asset.category.toUpperCase()}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {asset.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {asset.projectName} • Verified Project Media &amp; Blueprints
              </p>
            </div>
          </div>

          {/* Right Controls: Zoom & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.75}
                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-500 dark:text-slate-400">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors ml-1"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Canvas Stage */}
        <div className="flex-1 min-h-[300px] sm:min-h-[440px] max-h-[58vh] bg-slate-950 flex items-center justify-center p-4 overflow-auto relative select-none">
          <img
            src={asset.imageUrl}
            alt={asset.title}
            referrerPolicy="no-referrer"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out'
            }}
            className="max-h-full max-w-full object-contain shadow-lg rounded-lg pointer-events-auto cursor-zoom-in"
            onClick={() => setZoomLevel(prev => (prev >= 2 ? 1 : prev + 0.5))}
          />

          {/* Deep link badge overlay */}
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white text-[11px] flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{asset.projectName}</span>
          </div>
        </div>

        {/* Specs & Information Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-4">
          {/* Key Specs Pills */}
          {asset.specs && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {asset.specs.beds && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Layout</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{asset.specs.beds}</span>
                </div>
              )}
              {asset.specs.areaSqFt && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Area</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{asset.specs.areaSqFt} Sq Ft</span>
                </div>
              )}
              {asset.specs.startingPrice && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Starting Price</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {typeof asset.specs.startingPrice === 'number' 
                      ? `$${asset.specs.startingPrice.toLocaleString()}` 
                      : asset.specs.startingPrice}
                  </span>
                </div>
              )}
              {asset.specs.deposit && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Down Payment</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{asset.specs.deposit}</span>
                </div>
              )}
              {asset.specs.handover && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Handover</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{asset.specs.handover}</span>
                </div>
              )}
            </div>
          )}

          {/* Description & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              {asset.description}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              {onNavigateToUrl && asset.targetUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToUrl(asset.targetUrl!);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Navigate Browser Here</span>
                </button>
              )}

              {onAskCopilotAboutAsset && (
                <button
                  type="button"
                  onClick={() => {
                    onAskCopilotAboutAsset(asset);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Copilot About This Unit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
