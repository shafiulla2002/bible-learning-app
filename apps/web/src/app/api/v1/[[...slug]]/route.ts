import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Reference PrismaClient so Next.js/Vercel file tracing bundles the Prisma Query Engine and schema.prisma
void PrismaClient;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function resolveBackendOrigin(): Promise<string> {
  const explicitExternal = process.env.NEST_API_URL?.trim().replace(/\/+$/, '');
  if (explicitExternal) {
    return explicitExternal.replace(/\/api\/v1$/, '');
  }

  // Load the central NestJS serverless loopback handler from @bible-lms/api
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const apiPkg = require('@bible-lms/api') as {
    getNestServerlessOrigin: () => Promise<string>;
  };
  return apiPkg.getNestServerlessOrigin();
}

async function handleNestRequest(
  req: NextRequest,
  context: { params: Promise<{ slug?: string[] }> }
): Promise<Response> {
  try {
    const resolvedParams = await context.params;
    const slugParts = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];
    const subPath = slugParts.join('/');
    const origin = await resolveBackendOrigin();
    const search = req.nextUrl.search || '';
    const targetUrl = `${origin}/api/v1/${subPath}${search}`;

    const forwardHeaders = new Headers();
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'connection' || lower === 'content-length') {
        return;
      }
      forwardHeaders.set(key, value);
    });

    const method = req.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

    const upstreamRes = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'transfer-encoding' || lower === 'connection' || lower === 'set-cookie') {
        return;
      }
      responseHeaders.set(key, value);
    });

    const setCookies =
      typeof (upstreamRes.headers as any).getSetCookie === 'function'
        ? ((upstreamRes.headers as any).getSetCookie() as string[])
        : [];
    for (const cookieStr of setCookies) {
      responseHeaders.append('Set-Cookie', cookieStr);
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[NestJS Serverless Bridge Error]:', err);
    return Response.json(
      {
        statusCode: 500,
        message: err?.message || 'Internal server error in NestJS bridge',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

export async function OPTIONS(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  return handleNestRequest(req, ctx);
}

