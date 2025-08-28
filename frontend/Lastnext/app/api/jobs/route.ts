import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/app/lib/config';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Jobs API - Starting request...');
    
    // next-auth removed; require Authorization header from client

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.jobs}${queryString ? `?${queryString}` : ''}`;
    console.log('🔍 Jobs API calling:', apiUrl);
    console.log('🔍 Jobs API headers:', {
      hasAuthHeader: !!request.headers.get('authorization'),
      contentType: 'application/json'
    });

    // Fetch jobs from the external API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': request.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch jobs:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' }, 
        { status: response.status }
      );
    }

    const jobs = await response.json();
    return NextResponse.json(jobs);

  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // next-auth removed; require Authorization header from client
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Create job in the external API
    const response = await fetch(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.jobs}`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error('Failed to create job:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to create job' }, 
        { status: response.status }
      );
    }

    const job = await response.json();
    return NextResponse.json(job);

  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 