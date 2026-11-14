import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class BookStorageService {
  private readonly baseUploadDir: string;

  constructor() {
    this.baseUploadDir = process.env.STORAGE_LOCAL_DIR
      ? path.resolve(process.env.STORAGE_LOCAL_DIR)
      : path.resolve(process.cwd(), 'uploads');

    if (!fs.existsSync(this.baseUploadDir)) {
      try {
        fs.mkdirSync(this.baseUploadDir, { recursive: true });
      } catch (e) {}
    }
  }

  /**
   * Fast estimation of PDF page count by parsing cross-reference tree / object dictionary
   */
  private extractPdfPageCount(buffer: Buffer): number {
    try {
      const content = buffer.toString('latin1');
      // 1. Look for /Count (\d+) in /Pages root dictionary
      const countMatch = content.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
      if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }

      // 2. Fallback: Count /Type /Page (excluding /Pages)
      const pageMatches = content.match(/\/Type\s*\/Page\b/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
    } catch (e) {}
    return 1;
  }

  /**
   * Validate and save an uploaded PDF book file
   */
  async saveBookPdf(
    instituteId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ): Promise<{
    storageKey: string;
    originalFilename: string;
    fileSize: number;
    pageCount: number;
    mimeType: string;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No PDF file uploaded');
    }

    // 1. Validate MIME type
    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Invalid file format. Only PDF documents are allowed.');
    }

    // 2. Validate PDF signature (magic bytes: %PDF-)
    const header = file.buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new BadRequestException('Invalid PDF file content. File header signature mismatch.');
    }

    // 3. Validate size (Max 150MB)
    const MAX_SIZE = 150 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('PDF file exceeds maximum allowed limit of 150MB.');
    }

    // 4. Secure isolated institute directory
    const safeInstituteId = instituteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const instituteDir = path.join(this.baseUploadDir, 'institutes', safeInstituteId, 'books');
    await fs.promises.mkdir(instituteDir, { recursive: true });

    // 5. Generate collision-resistant unique filename
    const fileId = crypto.randomUUID();
    const diskFileName = `${fileId}.pdf`;
    const targetPath = path.join(instituteDir, diskFileName);

    await fs.promises.writeFile(targetPath, file.buffer);

    const storageKey = `institutes/${safeInstituteId}/books/${diskFileName}`;
    const pageCount = this.extractPdfPageCount(file.buffer);

    return {
      storageKey,
      originalFilename: file.originalname,
      fileSize: file.size,
      pageCount,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Resolve absolute path on disk from storageKey
   */
  resolveDiskPath(storageKey: string): string {
    const cleanKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    const candidates = [
      path.join(this.baseUploadDir, cleanKey),
      path.resolve(process.cwd(), '..', 'api', 'uploads', cleanKey),
      path.resolve(process.cwd(), 'apps', 'api', 'uploads', cleanKey),
      path.resolve(process.cwd(), '..', '..', 'uploads', cleanKey),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  /**
   * Delete a book PDF from disk
   */
  async deleteBookPdf(instituteId: string, storageKey: string): Promise<boolean> {
    try {
      const diskPath = this.resolveDiskPath(storageKey);
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Check if PDF file exists on disk
   */
  pdfExists(storageKey: string): boolean {
    const diskPath = this.resolveDiskPath(storageKey);
    return fs.existsSync(diskPath);
  }

  /**
   * Open read stream with optional HTTP Range header support
   */
  createPdfStream(
    storageKey: string,
    rangeHeader?: string,
  ): {
    stream: fs.ReadStream;
    status: number;
    headers: Record<string, string | number>;
  } {
    const diskPath = this.resolveDiskPath(storageKey);
    if (!fs.existsSync(diskPath)) {
      throw new NotFoundException('Book PDF file was not found in storage');
    }

    const stat = fs.statSync(diskPath);
    const fileSize = stat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return {
          stream: fs.createReadStream(diskPath),
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
          },
        };
      }

      const chunksize = end - start + 1;
      const stream = fs.createReadStream(diskPath, { start, end });
      return {
        stream,
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'application/pdf',
        },
      };
    }

    return {
      stream: fs.createReadStream(diskPath),
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
      },
    };
  }
}

