export interface ResolvedVideoSource {
  isExternalUrl: boolean;
  playerType: 'HTML5_VIDEO' | 'IFRAME_EMBED' | 'LECTURE_PREVIEW';
  src: string | null;
  rawUrl: string | null;
}

export function isHttpUrl(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return /^https?:\/\//i.test(trimmed);
}

export function resolveVideoSource(urlOrKey?: string | null): ResolvedVideoSource {
  const raw = (urlOrKey || '').trim();
  if (!raw) {
    return {
      isExternalUrl: false,
      playerType: 'LECTURE_PREVIEW',
      src: null,
      rawUrl: null,
    };
  }

  if (raw.startsWith('data:video/')) {
    return {
      isExternalUrl: true,
      playerType: 'HTML5_VIDEO',
      src: raw,
      rawUrl: raw,
    };
  }

  if (!isHttpUrl(raw)) {
    return {
      isExternalUrl: false,
      playerType: 'LECTURE_PREVIEW',
      src: null,
      rawUrl: null,
    };
  }

  // YouTube
  const ytMatch = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      isExternalUrl: true,
      playerType: 'IFRAME_EMBED',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      rawUrl: raw,
    };
  }

  // Vimeo
  const vimeoMatch = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      isExternalUrl: true,
      playerType: 'IFRAME_EMBED',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      rawUrl: raw,
    };
  }

  // Google Drive preview
  const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return {
      isExternalUrl: true,
      playerType: 'IFRAME_EMBED',
      src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      rawUrl: raw,
    };
  }

  // Direct MP4/WebM/Ogg/HLS or generic video URL
  return {
    isExternalUrl: true,
    playerType: 'HTML5_VIDEO',
    src: raw,
    rawUrl: raw,
  };
}
