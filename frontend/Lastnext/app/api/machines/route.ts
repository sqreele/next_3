import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { API_CONFIG, DEBUG_CONFIG } from '@/app/lib/config';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

export async function GET(request: NextRequest) {
	try {
		if (DEBUG_CONFIG.logApiCalls) {
			console.log('🔍 Machines API - Request started');
			console.log('🔍 Request URL:', request.url);
		}

		const session = await getServerSession(authOptions);
		if (!session?.user?.accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const propertyId = searchParams.get('property_id');
		const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
		const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.machines}${qs}`;

		const response = await fetch(apiUrl, {
			headers: {
				Authorization: `Bearer ${session.user.accessToken}`,
				'Content-Type': 'application/json',
				'User-Agent': 'NextJS-Server/1.0',
			},
			cache: 'no-store',
			signal: AbortSignal.timeout(20000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return NextResponse.json({ error: 'Failed to fetch machines', details: errorText }, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
	}
}