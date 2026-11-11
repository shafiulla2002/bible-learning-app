/**
 * Zero-dependency valid PDF 1.4 binary generator for Course Syllabi & Study PDFs.
 * Produces compliant PDF documents readable by all standard browsers and PDF viewers.
 */

export interface PdfSection {
  heading?: string;
  lines: string[];
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  instituteName?: string;
  metadata?: string[];
  sections: PdfSection[];
}

function sanitizePdfAscii(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdfLiteral(text: string): string {
  return sanitizePdfAscii(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const cleaned = sanitizePdfAscii(text).replace(/\r\n/g, '\n');
  const paragraphs = cleaned.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ' ' + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

interface DrawItem {
  text: string;
  font: 'F1' | 'F2';
  size: number;
  leading: number;
  indent?: number;
  ruleAfter?: boolean;
}

export function buildPdfBuffer(input: PdfDocumentInput): Buffer {
  const items: DrawItem[] = [];

  if (input.instituteName) {
    items.push({
      text: input.instituteName.toUpperCase(),
      font: 'F2',
      size: 10,
      leading: 16,
    });
  }

  for (const line of wrapText(input.title, 58)) {
    items.push({
      text: line,
      font: 'F2',
      size: 18,
      leading: 23,
    });
  }

  if (input.subtitle) {
    for (const line of wrapText(input.subtitle, 82)) {
      items.push({
        text: line,
        font: 'F1',
        size: 11,
        leading: 16,
      });
    }
  }

  if (input.metadata && input.metadata.length > 0) {
    items.push({ text: '', font: 'F1', size: 10, leading: 6 });
    for (const meta of input.metadata) {
      for (const line of wrapText(meta, 88)) {
        items.push({
          text: line,
          font: 'F1',
          size: 9.5,
          leading: 13.5,
        });
      }
    }
  }

  items.push({ text: '', font: 'F1', size: 10, leading: 10, ruleAfter: true });

  for (const section of input.sections) {
    if (section.heading) {
      items.push({ text: '', font: 'F1', size: 10, leading: 8 });
      for (const line of wrapText(section.heading, 72)) {
        items.push({
          text: line,
          font: 'F2',
          size: 12.5,
          leading: 17,
        });
      }
    }
    for (const rawLine of section.lines) {
      const wrapped = wrapText(rawLine, 88);
      if (wrapped.length === 0) {
        items.push({ text: '', font: 'F1', size: 10, leading: 8 });
      } else {
        for (const w of wrapped) {
          items.push({
            text: w,
            font: 'F1',
            size: 10,
            leading: 14,
            indent: 6,
          });
        }
      }
    }
  }

  // Paginate items into A4 pages (595 x 842 pt)
  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;
  const MARGIN_X = 48;
  const TOP_Y = 788;
  const BOTTOM_Y = 54;

  const pages: string[] = [];
  let currentOps: string[] = [];
  let y = TOP_Y;

  const flushPage = (pageNum: number) => {
    currentOps.push(
      `0.82 0.85 0.90 RG 0.7 w ${MARGIN_X} 40 m ${PAGE_WIDTH - MARGIN_X} 40 l S`
    );
    currentOps.push(
      `BT /F1 8 Tf 0.45 0.48 0.54 rg ${MARGIN_X} 26 Td (${escapePdfLiteral(
        `Page ${pageNum} - ${input.instituteName || 'Bible Institute LMS'}`
      )}) Tj ET`
    );
    pages.push(currentOps.join('\n'));
    currentOps = [];
    y = TOP_Y;
  };

  for (const item of items) {
    if (y - item.leading < BOTTOM_Y) {
      flushPage(pages.length + 1);
    }

    if (item.text) {
      const x = MARGIN_X + (item.indent || 0);
      const color =
        item.font === 'F2' ? '0.07 0.11 0.22 rg' : '0.18 0.22 0.29 rg';
      currentOps.push(
        `BT /${item.font} ${item.size} Tf ${color} ${x} ${y.toFixed(1)} Td (${escapePdfLiteral(
          item.text
        )}) Tj ET`
      );
    }

    y -= item.leading;

    if (item.ruleAfter) {
      currentOps.push(
        `0.78 0.82 0.88 RG 0.8 w ${MARGIN_X} ${(y + 4).toFixed(1)} m ${PAGE_WIDTH - MARGIN_X} ${(y + 4).toFixed(1)} l S`
      );
      y -= 8;
    }
  }

  if (currentOps.length > 0 || pages.length === 0) {
    flushPage(pages.length + 1);
  }

  // Assemble PDF objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5.. : pairs of (Page, Content Stream)
  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(5 + i * 2);
  }

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`
  );

  for (let i = 0; i < pages.length; i++) {
    const pageId = 5 + i * 2;
    const contentId = pageId + 1;
    const stream = pages[i];
    const streamByteLen = Buffer.byteLength(stream, 'utf8');

    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${streamByteLen} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [0];
  let cursor = Buffer.byteLength(header, 'utf8');

  for (const obj of objects) {
    offsets.push(cursor);
    body += obj;
    cursor += Buffer.byteLength(obj, 'utf8');
  }

  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, 'utf8');
}
