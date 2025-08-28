import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing session retrieval...');
    
    const result = {
      success: true,
      message: 'next-auth removed; no server session available',
      timestamp: new Date().toISOString()
    };

    console.log('🧪 Session test result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('🧪 Session test error:', error);
    return NextResponse.json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
