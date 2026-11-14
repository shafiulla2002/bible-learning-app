import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { Readable } from 'stream';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class BookStorageService {
  private readonly baseUploadDir: string;
  private chunkTableReady = false;

  constructor(private readonly prisma: PrismaService) {
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

    // 4. Secure isolated institute directory (fall back to os.tmpdir()/uploads on read-only serverless FS)
    const safeInstituteId = instituteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileId = crypto.randomUUID();
    const diskFileName = `${fileId}.pdf`;

    const primaryDir = path.join(this.baseUploadDir, 'institutes', safeInstituteId, 'books');
    try {
      await fs.promises.mkdir(primaryDir, { recursive: true });
      await fs.promises.writeFile(path.join(primaryDir, diskFileName), file.buffer);
    } catch (err: any) {
      if (err?.code === 'EROFS' || err?.code === 'EACCES' || err?.code === 'EPERM') {
        const tmpDir = path.join(os.tmpdir(), 'uploads', 'institutes', safeInstituteId, 'books');
        await fs.promises.mkdir(tmpDir, { recursive: true });
        await fs.promises.writeFile(path.join(tmpDir, diskFileName), file.buffer);
      } else {
        throw err;
      }
    }

    const storageKey = `institutes/${safeInstituteId}/books/${diskFileName}`;
    const pageCount = this.extractPdfPageCount(file.buffer);

    try {
      await this.ensureChunkTable();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO book_pdf_chunks (storage_key, chunk_index, total_chunks, data)
         VALUES ($1, 0, 1, $2)
         ON CONFLICT (storage_key, chunk_index) DO UPDATE SET data = EXCLUDED.data, total_chunks = 1`,
        storageKey,
        file.buffer,
      );
    } catch (e) {}

    return {
      storageKey,
      originalFilename: file.originalname,
      fileSize: file.size,
      pageCount,
      mimeType: 'application/pdf',
    };
  }

  private async ensureChunkTable(): Promise<void> {
    if (this.chunkTableReady) return;
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS book_pdf_chunks (
        storage_key TEXT NOT NULL,
        chunk_index INT NOT NULL,
        total_chunks INT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (storage_key, chunk_index)
      )
    `);
    this.chunkTableReady = true;
  }

  async saveBookPdfChunk(
    instituteId: string,
    payload: {
      uploadId?: string;
      chunkIndex: number;
      totalChunks: number;
      chunkBase64: string;
      originalFilename: string;
      totalSize: number;
    },
  ): Promise<any> {
    const chunkIndex = Number(payload?.chunkIndex);
    const totalChunks = Number(payload?.totalChunks);
    const totalSize = Number(payload?.totalSize || 0);
    const originalFilename = String(payload?.originalFilename || 'book.pdf');

    if (!originalFilename.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Invalid file format. Only PDF documents are allowed.');
    }
    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || totalChunks < 1 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new BadRequestException('Invalid PDF chunk metadata.');
    }
    if (totalSize > 150 * 1024 * 1024) {
      throw new BadRequestException('PDF file exceeds maximum allowed limit of 150MB.');
    }
    if (!payload?.chunkBase64) {
      throw new BadRequestException('Missing PDF chunk data.');
    }

    const chunkBuffer = Buffer.from(payload.chunkBase64, 'base64');
    if (chunkIndex === 0) {
      const header = chunkBuffer.subarray(0, 5).toString('ascii');
      if (header !== '%PDF-') {
        throw new BadRequestException('Invalid PDF file content. File header signature mismatch.');
      }
    }

    const safeInstituteId = instituteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeUploadId = (payload.uploadId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '');
    const storageKey = `institutes/${safeInstituteId}/books/${safeUploadId}.pdf`;

    await this.ensureChunkTable();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO book_pdf_chunks (storage_key, chunk_index, total_chunks, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (storage_key, chunk_index) DO UPDATE SET data = EXCLUDED.data, total_chunks = EXCLUDED.total_chunks`,
      storageKey,
      chunkIndex,
      totalChunks,
      chunkBuffer,
    );

    if (chunkIndex < totalChunks - 1) {
      return {
        completed: false,
        uploadId: safeUploadId,
        storageKey,
        chunkIndex,
      };
    }

    // Final chunk received: compute page count from stored chunks
    let pageCount = 1;
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT data FROM book_pdf_chunks WHERE storage_key = $1 ORDER BY chunk_index ASC`,
        storageKey,
      )) as Array<{ data: Buffer }>;
      const fullBuffer = Buffer.concat(rows.map((r) => Buffer.from(r.data)));
      pageCount = this.extractPdfPageCount(fullBuffer);
    } catch (e) {}

    return {
      completed: true,
      storageKey,
      originalFilename,
      fileSize: totalSize,
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
      path.join(os.tmpdir(), 'uploads', cleanKey),
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
    let deleted = false;
    try {
      const diskPath = this.resolveDiskPath(storageKey);
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
        deleted = true;
      }
    } catch (e) {}
    try {
      await this.ensureChunkTable();
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM book_pdf_chunks WHERE storage_key = $1`,
        storageKey,
      );
      deleted = true;
    } catch (e) {}
    return deleted;
  }

  /**
   * Check if PDF file exists on disk
   */
  pdfExists(storageKey: string): boolean {
    const diskPath = this.resolveDiskPath(storageKey);
    return fs.existsSync(diskPath);
  }

  /**
   * Open read stream with optional HTTP Range header support (disk or PostgreSQL chunks)
   */
  async createPdfStream(
    storageKey: string,
    rangeHeader?: string,
  ): Promise<{
    stream: Readable;
    status: number;
    headers: Record<string, string | number>;
  }> {
    const diskPath = this.resolveDiskPath(storageKey);
    if (fs.existsSync(diskPath)) {
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
        return {
          stream: fs.createReadStream(diskPath, { start, end }),
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

    // Fallback: load persisted chunks from PostgreSQL
    await this.ensureChunkTable();
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT data FROM book_pdf_chunks WHERE storage_key = $1 ORDER BY chunk_index ASC`,
      storageKey,
    )) as Array<{ data: Buffer }>;

    if (!rows || rows.length === 0) {
      throw new NotFoundException('Book PDF file was not found in storage');
    }

    const fullBuffer = Buffer.concat(rows.map((r) => Buffer.from(r.data)));
    const fileSize = fullBuffer.length;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (!isNaN(start) && !isNaN(end) && start < fileSize && end < fileSize) {
        const slice = fullBuffer.subarray(start, end + 1);
        return {
          stream: Readable.from(slice),
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': slice.length,
            'Content-Type': 'application/pdf',
          },
        };
      }
    }

    return {
      stream: Readable.from(fullBuffer),
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
      },
    };
  }
}

