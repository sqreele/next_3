import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/app/lib/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId } = await params;

    // Fetch property from the external API
    const response = await fetch(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.properties}${propertyId}/`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch property:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch property' }, 
        { status: response.status }
      );
    }

    const property = await response.json();
    return NextResponse.json(property);

  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 