// components/DataUploader.tsx — Grounding Data & Media Uploader
import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { SalesRecord, DatasetInfo, LoaderMetadata, RelationalDataModel } from '../types';
import { loadFile } from '../services/dataLoader';
import { validateRows } from '../services/dataValidator';
import { buildRelationalDataModel } from '../services/relationalModelEngine';

interface DataUploaderProps {
  onDataLoaded: (data: SalesRecord[], info: DatasetInfo) => void;
  variant?: 'header' | 'sidebar';
  isCollapsed?: boolean;
}

export const DataUploader: React.FC<DataUploaderProps> = ({ 
  onDataLoaded, 
  variant = 'sidebar',
  isCollapsed = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('Reading & extracting file worksheets...');

    try {
      const loaderResult = await loadFile(file);

      if (!loaderResult.rows || loaderResult.rows.length === 0) {
        throw new Error('No readable data records found in this file.');
      }

      let dataModel: RelationalDataModel | undefined;
      let cleanModelRows = loaderResult.rows;

      if (loaderResult.sheets && Object.keys(loaderResult.sheets).length > 0) {
        setStatusMessage('Synthesizing relational entities & keys...');
        dataModel = buildRelationalDataModel(loaderResult.sheets, file.name);
        const factSheetName = dataModel.primaryFactSheet || Object.keys(loaderResult.sheets)[0];
        cleanModelRows = (loaderResult.sheets[factSheetName] as Record<string, unknown>[]) || loaderResult.rows;
      }

      setStatusMessage('Validating schema & dynamic mappings...');
      const validationResult = validateRows(cleanModelRows);

      const records = validationResult.valid.length > 0 ? validationResult.valid : cleanModelRows;

      finalizeImport(records, loaderResult.metadata, validationResult, dataModel);
    } catch (err: any) {
      console.error('File import error:', err);
      setErrorMessage(`Import error: ${err.message || 'Failed to process file'}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const finalizeImport = (
    records: SalesRecord[],
    metadata: LoaderMetadata,
    validationResult: any,
    dataModel?: RelationalDataModel
  ) => {
    const info: DatasetInfo = {
      name: metadata.fileName,
      recordCount: records.length,
      uploadedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      }),
      sourceType: 'uploaded',
      fileSize: metadata.fileSize,
      validationSummary: validationResult.summary,
      schema: validationResult.schema,
      dataModel,
    };

    onDataLoaded(records, info);
  };

  if (variant === 'sidebar') {
    return (
      <div className="w-full space-y-1.5">
        {errorMessage && (
          <div className="flex items-center gap-1.5 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1 text-[11px]">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-600 font-bold px-1"
            >
              ×
            </button>
          </div>
        )}

        {isCollapsed ? (
          <label 
            className="w-10 h-10 mx-auto flex items-center justify-center bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl cursor-pointer transition-all shadow-xs active:scale-95"
            title="Import Data & Media (Excel, CSV, JSON)"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-4 h-4 text-indigo-400" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.json,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
        ) : (
          <label className="w-full flex items-center justify-between p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/60 cursor-pointer transition-all group">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  Import Data & Media
                </p>
                <p className="text-[10px] text-slate-400">
                  {statusMessage || 'Excel, CSV or JSON'}
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.json,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all">
      {isProcessing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
      ) : (
        <Upload className="w-3.5 h-3.5 text-indigo-600" />
      )}
      <span>{isProcessing ? 'Processing...' : 'Upload Excel'}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.json,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
        disabled={isProcessing}
      />
    </label>
  );
};

export default DataUploader;
