import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/app/lib/config';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Properties API Debug');

    const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.properties}`;
    console.log('🔍 Properties API calling:', apiUrl);
    console.log('🔍 Properties API headers:', { hasAuthHeader: !!request.headers.get('authorization'), contentType: 'application/json' });

    // Fetch properties from the external API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': request.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch properties:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch properties' }, 
        { status: response.status }
      );
    }

    const properties = await response.json();
    return NextResponse.json(properties);

  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 