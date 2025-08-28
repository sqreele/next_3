// app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, DEBUG_CONFIG } from '@/app/lib/config';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Rooms API - Request started');
      console.log('🔍 Request URL:', request.url);
      console.log('🔍 API_CONFIG.baseUrl:', API_CONFIG.baseUrl);
    }

    // next-auth removed; require Authorization header from client
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('property');
    
    // ✅ Use the config for API URL construction
    const apiUrl = propertyId
      ? `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.rooms}?property=${encodeURIComponent(propertyId)}`
      : `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.rooms}`;
    
    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Calling Django API:', apiUrl, propertyId ? `(filtered by property ${propertyId})` : '(no property filter)');
      console.log('🔍 With auth header:', !!authHeader);
    }

    // Fetch rooms from the external API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'NextJS-Server/1.0',
      },
      // Add timeout
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (DEBUG_CONFIG.logApiCalls) {
      console.log('🔍 Django API response:', response.status, response.statusText);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch rooms:', response.status, response.statusText, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch rooms', 
          details: errorText, 
          status: response.status,
          apiUrl: DEBUG_CONFIG.logApiCalls ? apiUrl : undefined
        }, 
        { status: response.status }
      );
    }

    const rooms = await response.json();
    
    if (DEBUG_CONFIG.logApiCalls) {
      console.log('✅ Rooms fetched successfully:', Array.isArray(rooms) ? rooms.length : 'Not an array');
    }
    
    return NextResponse.json(rooms);

  } catch (error) {
    console.error('❌ Error in rooms API:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: DEBUG_CONFIG.logApiCalls ? error.stack : undefined
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: getErrorMessage(error),
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}
