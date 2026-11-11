'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Lock,
  Download,
  ExternalLink,
  Link2,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  BookOpen,
} from 'lucide-react';
import { resolveVideoSource } from '@/lib/media-utils';

export interface MediaPlayerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sourceUrlOrKey?: string | null;
  lessonNotes?: string | null;
  downloadable?: boolean;
  canAttachUrl?: boolean;
  onSaveVideoUrl?: (newUrl: string) => Promise<void>;
  downloadHref?: string | null;
}

export function MediaPlayerModal({
  open,
  onClose,
  title,
  subtitle,
  sourceUrlOrKey,
  lessonNotes,
  downloadable = false,
  canAttachUrl = false,
  onSaveVideoUrl,
  downloadHref,
}: MediaPlayerModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState(sourceUrlOrKey || '');

  useEffect(() => {
    setActiveSource(sourceUrlOrKey || '');
    setUrlInput(
      sourceUrlOrKey && /^https?:\/\//i.test(sourceUrlOrKey) ? sourceUrlOrKey : ''
    );
    setSaveError(null);
    setSaveSuccess(null);
  }, [sourceUrlOrKey, open]);

  if (!open) return null;

  const resolved = resolveVideoSource(activeSource);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveVideoUrl) return;
    const trimmed = urlInput.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setSaveError('Please enter a valid video URL starting with https:// or http://');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await onSaveVideoUrl(trimmed);
      setActiveSource(trimmed);
      setSaveSuccess('Recorded video link saved and ready to stream.');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save video link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Video size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white truncate" title={title}>
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-300 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!downloadable && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                <Lock size={11} />
                Stream Only
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close player"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Stage */}
        <div className="bg-slate-950">
          {resolved.playerType === 'IFRAME_EMBED' && resolved.src ? (
            <div className="aspect-video w-full">
              <iframe
                src={resolved.src}
                title={title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : resolved.playerType === 'HTML5_VIDEO' && resolved.src ? (
            <div className="aspect-video w-full flex items-center justify-center bg-black">
              <video
                src={resolved.src}
                controls
                playsInline
                controlsList={downloadable ? undefined : 'nodownload'}
                onContextMenu={downloadable ? undefined : (e) => e.preventDefault()}
                className="w-full h-full max-h-[65vh]"
              />
            </div>
          ) : (
            <div className="p-8 text-center text-white space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center mx-auto">
                <PlayCircle size={34} className="text-blue-400" />
              </div>
              <div className="max-w-lg mx-auto space-y-1.5">
                <h4 className="text-base font-bold text-white">
                  No Streamable Video URL Linked Yet
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSource
                    ? `This asset currently points to storage key "${activeSource}" without an external video stream URL.`
                    : 'This class session does not have a recorded video URL attached yet.'}
                </p>
              </div>
              {lessonNotes && (
                <div className="max-w-xl mx-auto text-left bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                    <BookOpen size={12} />
                    Lesson & Lecture Summary
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{lessonNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer / Faculty URL Linking */}
        <div className="p-5 bg-white space-y-3 border-t border-slate-100">
          {canAttachUrl && onSaveVideoUrl && (
            <form onSubmit={handleSave} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Attach or Update Recorded Class Video URL (YouTube, Vimeo, Google Drive, or direct .mp4)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <Link2
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://.../recording.mp4"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shrink-0 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Stream'}
                </button>
              </div>
              {saveError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                  <AlertCircle size={13} />
                  <span>{saveError}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 size={13} />
                  <span>{saveSuccess}</span>
                </div>
              )}
            </form>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-2">
              {resolved.rawUrl && (
                <a
                  href={resolved.rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  <ExternalLink size={13} />
                  <span>Open Original Link</span>
                </a>
              )}
              {downloadable && downloadHref && (
                <a
                  href={downloadHref}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
                >
                  <Download size={13} />
                  <span>Download Copy</span>
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
