export const runtime = 'edge';

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  if (!isValidUrl(targetUrl)) {
    return new Response('Invalid url parameter', { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      // Prevent caching issues when images update
      cache: 'no-store',
      // Some servers require a UA
      headers: { 'User-Agent': 'NextJS-Image-Proxy/1.0' },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return new Response('Unsupported content type', { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        // Allow canvas/html2canvas to consume
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response('Failed to proxy image', { status: 502 });
  }
}

