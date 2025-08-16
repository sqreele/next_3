import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { API_CONFIG, DEBUG_CONFIG } from '@/app/lib/config';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

function toISODateTime(value: string | null | undefined): string | null {
	if (!value) return null;
	// If already looks like a full datetime, return as-is
	if (/T\d{2}:\d{2}/.test(value)) return value;
	// If only date is provided, append midnight UTC
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`;
	return value;
}

function normalizeFrequency(original: string | null | undefined, formData: FormData): string | null {
	if (!original) return null;
	const value = String(original).toLowerCase();
	// Map frontend values to backend choices
	switch (value) {
		case 'annually':
			return 'annual';
		case 'biannually':
			return 'semi_annual';
		case 'bi-weekly':
		case 'biweekly':
			// Backend has no biweekly choice. Use custom 14 days.
			formData.set('custom_days', '14');
			return 'custom';
		default:
			return value;
	}
}

export async function GET(request: NextRequest) {
	try {
		if (DEBUG_CONFIG.logApiCalls) {
			console.log('🔍 PM API (GET) - Request started');
			console.log('🔍 Request URL:', request.url);
		}

		const session = await getServerSession(authOptions);
		if (!session?.user?.accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { search } = new URL(request.url);
		const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.preventiveMaintenance}${search ?? ''}`;

		const response = await fetch(apiUrl, {
			headers: {
				Authorization: `Bearer ${session.user.accessToken}`,
				'User-Agent': 'NextJS-Server/1.0',
			},
			cache: 'no-store',
			signal: AbortSignal.timeout(20000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return NextResponse.json({ error: 'Failed to fetch preventive maintenance', details: errorText }, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		if (DEBUG_CONFIG.logApiCalls) {
			console.log('🔍 PM API (POST) - Request started');
		}

		const session = await getServerSession(authOptions);
		if (!session?.user?.accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const incoming = await request.formData();

		// Build a new FormData with normalized fields
		const outgoing = new FormData();
		for (const [key, value] of incoming.entries()) {
			// Drop unsupported fields
			if (key === 'property_id') continue;

			if (key === 'scheduled_date' || key === 'completed_date') {
				const normalized = toISODateTime(typeof value === 'string' ? value : undefined);
				if (normalized) outgoing.append(key, normalized);
				continue;
			}

			if (key === 'frequency' && typeof value === 'string') {
				// Normalize frequency; may also set custom_days in outgoing
				const normalized = normalizeFrequency(value, outgoing);
				if (normalized) outgoing.append('frequency', normalized);
				continue;
			}

			// Pass-through other fields, including files and arrays (duplicated keys)
			outgoing.append(key, value as any);
		}

		const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.preventiveMaintenance}`;
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session.user.accessToken}`,
				'User-Agent': 'NextJS-Server/1.0',
				// Let fetch set Content-Type with boundary for multipart
			},
			body: outgoing,
			cache: 'no-store',
			signal: AbortSignal.timeout(30000),
		});

		const text = await response.text();
		const contentType = response.headers.get('content-type') || 'application/json';
		return new NextResponse(text, { status: response.status, headers: { 'Content-Type': contentType } });
	} catch (error) {
		return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
	}
}