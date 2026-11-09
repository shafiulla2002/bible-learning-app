import { NextRequest, NextResponse } from 'next/server.js';

export const dynamic = 'force-dynamic';

/**
 * Robust, secure logout endpoint supporting both POST (API invocation)
 * and GET (browser navigation fallback).
 *
 * Security:
 * - Redirect target is strictly hardcoded to `/login` to prevent Open Redirect attacks.
 * - Expires and invalidates all authentication cookies (auth_token, token, access_token).
 * - Matches Path, SameSite, Secure, and HttpOnly attributes.
 * - Leaves no persistent authorization credentials.
 */
function createLogoutResponse(request: NextRequest, isGet: boolean) {
  // Hardcoded redirect target to eliminate Open Redirect vulnerabilities
  const loginUrl = new URL('/login', request.url);

  const response = isGet
    ? NextResponse.redirect(loginUrl, 302)
    : NextResponse.json({ success: true, redirectUrl: '/login' });

  // Add Cache-Control headers to ensure responses/pages are not cached by browser or proxies
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  const isHttps = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

  const cookiesToClear = ['auth_token', 'token', 'access_token'];

  cookiesToClear.forEach((name) => {
    // 1. Next.js native cookie deletion
    response.cookies.delete(name);

    // 2. Explicit expired cookie with matching client & server attributes
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: false,
      sameSite: 'lax',
      secure: isHttps,
    });

    // 3. Also clear potential HttpOnly variants
    response.cookies.set(`${name}_secure`, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
    });
  });

  return response;
}

export async function POST(request: NextRequest) {
  try {
    return createLogoutResponse(request, false);
  } catch (err: any) {
    // Never expose stack trace or system secrets in errors
    return NextResponse.json(
      { success: false, message: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    return createLogoutResponse(request, true);
  } catch (err: any) {
    // Graceful fallback to login page
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl, 302);
  }
}
