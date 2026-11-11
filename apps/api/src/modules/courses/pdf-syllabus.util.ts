export interface PdfSection {
  heading: string;
  lines: string[];
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  instituteName?: string;
  metadata?: Array<{ label: string; value: string }>;
  sections: PdfSection[];
}

export function safeFileName(name: string, fallback = 'document'): string {
  const cleaned = (name || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

export function resolveVideoSource(url: string | null | undefined): {
  kind: 'youtube' | 'vimeo' | 'direct' | 'none';
  embedUrl: string | null;
  streamId: string | null;
} {
  if (!url) {
    return { kind: 'none', embedUrl: null, streamId: null };
  }
  const trimmed = url.trim();
  const ytMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i);
  if (ytMatch) {
    return {
      kind: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      streamId: ytMatch[1],
    };
  }
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return {
      kind: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      streamId: vimeoMatch[1],
    };
  }
  return { kind: 'direct', embedUrl: trimmed, streamId: null };
}

export function parseDataUri(
  value: string | null | undefined,
): { mimeType: string; buffer: Buffer } | null {
  if (!value) return null;
  const match = value.trim().match(/^data:([^;,]+)?(?:;base64)?,(.*)$/is);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const payload = match[2] || '';
  const isBase64 = /^data:[^,]*;base64,/i.test(value.trim());
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mimeType, buffer };
}

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars = 84): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generates a valid single- or multi-page PDF 1.4 document buffer without external dependencies.
 */
export function buildPdfBuffer(doc: PdfDocumentInput): Buffer {
  interface LineEntry {
    text: string;
    size: number;
    bold?: boolean;
    leading: number;
  }

  const entries: LineEntry[] = [];
  if (doc.instituteName) {
    entries.push({ text: doc.instituteName.toUpperCase(), size: 10, bold: true, leading: 16 });
  }
  entries.push({ text: doc.title || 'Course Document', size: 18, bold: true, leading: 24 });
  if (doc.subtitle) {
    for (const line of wrapLine(doc.subtitle, 82)) {
      entries.push({ text: line, size: 11, leading: 16 });
    }
  }
  entries.push({ text: '', size: 10, leading: 10 });

  if (doc.metadata && doc.metadata.length > 0) {
    for (const item of doc.metadata) {
      for (const line of wrapLine(`${item.label}: ${item.value}`, 88)) {
        entries.push({ text: line, size: 10, leading: 14 });
      }
    }
    entries.push({ text: '', size: 10, leading: 10 });
  }

  for (const section of doc.sections) {
    for (const h of wrapLine(section.heading, 78)) {
      entries.push({ text: h, size: 13, bold: true, leading: 18 });
    }
    for (const rawLine of section.lines) {
      for (const wrapped of wrapLine(rawLine, 88)) {
        entries.push({ text: wrapped, size: 10, leading: 14 });
      }
    }
    entries.push({ text: '', size: 10, leading: 10 });
  }

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const startY = 792;
  const minY = 56;

  const pages: string[][] = [];
  let currentOps: string[] = [];
  let y = startY;

  for (const entry of entries) {
    if (y - entry.leading < minY) {
      pages.push(currentOps);
      currentOps = [];
      y = startY;
    }
    if (entry.text) {
      const fontRef = entry.bold ? '/F2' : '/F1';
      currentOps.push(
        `BT ${fontRef} ${entry.size} Tf 1 0 0 1 ${marginX} ${y} Tm (${escapePdfText(entry.text)}) Tj ET`,
      );
    }
    y -= entry.leading;
  }
  if (currentOps.length > 0 || pages.length === 0) {
    pages.push(currentOps);
  }

  // Object layout:
  // 1: Catalog, 2: Pages, 3: Helvetica (/F1), 4: Helvetica-Bold (/F2),
  // then for each page i: (5 + i*2) Page, (6 + i*2) Contents
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(5 + i * 2);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
  );

  for (let i = 0; i < pages.length; i++) {
    const pageNum = 5 + i * 2;
    const contentNum = 6 + i * 2;
    const stream = pages[i].join('\n');
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }

  const header = '%PDF-1.4\n';
  const offsets: number[] = [0];
  let cursor = Buffer.byteLength(header, 'utf8');
  for (const obj of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(obj, 'utf8');
  }

  const xrefStart = cursor;
  const totalObjs = objects.length + 1;
  const xrefLines = [
    `xref\n0 ${totalObjs}\n`,
    `0000000000 65535 f \n`,
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
  ];
  const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + objects.join('') + xrefLines.join('') + trailer, 'utf8');
}

export function buildSyllabusPdfBuffer(params: {
  instituteName?: string;
  courseTitle: string;
  courseCode?: string | null;
  description?: string | null;
  durationWeeks?: number | null;
  credits?: number | null;
  modules: Array<{
    title: string;
    orderIndex?: number | null;
    description?: string | null;
    lessons: Array<{
      title: string;
      lessonType?: string | null;
      durationMinutes?: number | null;
      summary?: string | null;
    }>;
  }>;
}): Buffer {
  const sections: PdfSection[] = [];
  if (params.description) {
    sections.push({
      heading: 'Course Overview',
      lines: [params.description],
    });
  }

  if (params.modules.length === 0) {
    sections.push({
      heading: 'Curriculum',
      lines: ['No modules published yet.'],
    });
  } else {
    params.modules.forEach((mod, idx) => {
      const moduleLines: string[] = [];
      if (mod.description) {
        moduleLines.push(mod.description);
      }
      if (mod.lessons.length === 0) {
        moduleLines.push('  - No lessons scheduled yet.');
      } else {
        mod.lessons.forEach((lesson, lIdx) => {
          const metaParts: string[] = [];
          if (lesson.lessonType) metaParts.push(lesson.lessonType);
          if (lesson.durationMinutes) metaParts.push(`${lesson.durationMinutes} min`);
          const suffix = metaParts.length > 0 ? ` (${metaParts.join(', ')})` : '';
          moduleLines.push(`  ${lIdx + 1}. ${lesson.title}${suffix}`);
          if (lesson.summary) {
            moduleLines.push(`     ${lesson.summary}`);
          }
        });
      }
      sections.push({
        heading: `Module ${idx + 1}: ${mod.title}`,
        lines: moduleLines,
      });
    });
  }

  return buildPdfBuffer({
    instituteName: params.instituteName,
    title: `${params.courseTitle} — Course Syllabus`,
    subtitle: params.courseCode ? `Course Code: ${params.courseCode}` : undefined,
    metadata: [
      ...(params.durationWeeks ? [{ label: 'Duration', value: `${params.durationWeeks} weeks` }] : []),
      ...(params.credits !== null && params.credits !== undefined
        ? [{ label: 'Credits', value: String(params.credits) }]
        : []),
      { label: 'Total Modules', value: String(params.modules.length) },
    ],
    sections,
  });
}

export type ResourceDelivery =
  | { kind: 'redirect'; url: string }
  | { kind: 'buffer'; buffer: Buffer; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' };

export function resolveResourceDelivery(params: {
  title: string;
  resourceType?: string | null;
  url?: string | null;
  content?: string | null;
  courseTitle?: string | null;
  lessonTitle?: string | null;
  instituteName?: string | null;
  mode: 'download' | 'inline';
}): ResourceDelivery {
  const url = params.url?.trim() || '';
  if (isHttpUrl(url)) {
    return { kind: 'redirect', url };
  }

  const baseName = safeFileName(params.title, 'material');
  const parsedData = parseDataUri(url);
  if (parsedData) {
    const ext = parsedData.mimeType.includes('pdf')
      ? '.pdf'
      : parsedData.mimeType.includes('plain')
        ? '.txt'
        : parsedData.mimeType.includes('png')
          ? '.png'
          : parsedData.mimeType.includes('jpeg')
            ? '.jpg'
            : '';
    return {
      kind: 'buffer',
      buffer: parsedData.buffer,
      mimeType: parsedData.mimeType,
      fileName: baseName.includes('.') ? baseName : `${baseName}${ext}`,
      disposition: params.mode === 'inline' ? 'inline' : 'attachment',
    };
  }

  const lines: string[] = [];
  if (params.content?.trim()) {
    lines.push(...params.content.trim().split(/\r?\n/));
  } else if (url) {
    lines.push(`Resource Link: ${url}`);
  } else {
    lines.push('Study material summary generated by Bible Institute LMS.');
  }

  const pdfBuffer = buildPdfBuffer({
    instituteName: params.instituteName || undefined,
    title: params.title,
    subtitle: [params.courseTitle, params.lessonTitle].filter(Boolean).join(' • ') || undefined,
    metadata: [
      ...(params.resourceType ? [{ label: 'Resource Type', value: params.resourceType }] : []),
    ],
    sections: [
      {
        heading: 'Material Content',
        lines,
      },
    ],
  });

  return {
    kind: 'buffer',
    buffer: pdfBuffer,
    mimeType: 'application/pdf',
    fileName: baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`,
    disposition: params.mode === 'inline' ? 'inline' : 'attachment',
  };
}

