// app/api/topics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, DEBUG_CONFIG } from '@/app/lib/config';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Topics API - Request started');
      console.log('🔍 Request URL:', request.url);
      console.log('🔍 API_CONFIG.baseUrl:', API_CONFIG.baseUrl);
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { search } = new URL(request.url);

    // Build target API URL, preserving query string if present
    const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.topics}${search ?? ''}`;

    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Calling Django API (topics):', apiUrl);
    }

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'NextJS-Server/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Django API response (topics):', response.status, response.statusText);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch topics:', response.status, response.statusText, errorText);
      return NextResponse.json(
        {
          error: 'Failed to fetch topics',
          details: errorText,
          status: response.status,
          apiUrl: DEBUG_CONFIG.logApiCalls ? apiUrl : undefined,
        },
        { status: response.status }
      );
    }

    const topics = await response.json();

    if (DEBUG_CONFIG.logApiCalls) {
      console.log('✅ Topics fetched successfully:', Array.isArray(topics) ? topics.length : 'Not an array');
    }

    return NextResponse.json(topics);
  } catch (error) {
    console.error('❌ Error in topics API:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: DEBUG_CONFIG.logApiCalls ? error.stack : undefined,
      });
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}