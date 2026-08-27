'use client';

import { useId, useRef, useState, type ReactNode, type DragEvent, type ChangeEvent } from 'react';
import { AlertCircle, Upload, X, FileText } from 'lucide-react';

export interface FormFileProps {
  name: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onChange: (files: File[]) => void;
  error?: string;
  hint?: string;
  label?: ReactNode;
}

interface SelectedFile {
  file: File;
  id: string;
}

export function FormFile({
  name,
  accept,
  maxSize,
  multiple = false,
  onChange,
  error,
  hint,
  label,
}: FormFileProps) {
  const generatedId = useId();
  const id = generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFiles = (fileList: FileList): File[] => {
    const valid: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((f) => {
      if (accept) {
        const accepted = accept
          .split(',')
          .map((a) => a.trim())
          .some((a) => {
            if (a.startsWith('.')) {
              return f.name.toLowerCase().endsWith(a.toLowerCase());
            }
            if (a.endsWith('/*')) {
              return f.type.startsWith(a.replace('/*', '/'));
            }
            return f.type === a;
          });
        if (!accepted) {
          errors.push(`"${f.name}" — vale failitüüp`);
          return;
        }
      }
      if (maxSize && f.size > maxSize) {
        const maxMb = (maxSize / (1024 * 1024)).toFixed(1);
        errors.push(`"${f.name}" — liiga suur (max ${maxMb} MB)`);
        return;
      }
      valid.push(f);
    });

    if (errors.length > 0) {
      setValidationError(errors.join('. '));
    } else {
      setValidationError(null);
    }

    return valid;
  };

  const addFiles = (fileList: FileList) => {
    const valid = validateFiles(fileList);
    if (valid.length === 0) return;

    const mapped: SelectedFile[] = valid.map((f) => ({
      file: f,
      id: `${f.name}-${f.size}-${f.lastModified}`,
    }));

    const next = multiple ? [...selected, ...mapped] : mapped;
    setSelected(next);
    onChange(next.map((s) => s.file));
  };

  const removeFile = (id: string) => {
    const next = selected.filter((s) => s.id !== id);
    setSelected(next);
    onChange(next.map((s) => s.file));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayError = error || validationError;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-body font-semibold text-primary">
          {label}
        </label>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-input border-2 border-dashed p-6 text-center transition-all duration-hover ease-hover motion-reduce:transition-none ${
          dragOver
            ? 'border-primary bg-primary/5'
            : displayError
              ? 'border-danger bg-danger/5'
              : 'border-border hover:border-primary/50 hover:bg-bgPage'
        }`}
        aria-label={typeof label === 'string' ? label : 'Faili valimine'}
      >
        <Upload
          className={`h-8 w-8 ${
            dragOver ? 'text-primary' : 'text-ink-muted'
          }`}
          aria-hidden="true"
        />
        <p className="text-body text-ink-muted">
          {dragOver
            ? 'Lohista failid siia'
            : 'Lohista failid siia või kliki valimiseks'}
        </p>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          aria-invalid={!!displayError}
          aria-describedby={displayError ? errorId : hint ? hintId : undefined}
          className="hidden"
        />
      </div>

      {selected.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {selected.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-input border border-border bg-bgPage px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 truncate text-body">{s.file.name}</span>
              <span className="shrink-0 text-bodySm text-ink-muted">
                {formatSize(s.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(s.id)}
                className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-danger focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={`Eemalda ${s.file.name}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {displayError && (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-bodySm text-danger"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{displayError}</span>
        </div>
      )}

      {hint && !displayError && (
        <p id={hintId} className="text-bodySm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}