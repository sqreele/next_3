import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/app/lib/utils/error-utils';

interface DjangoTestResult {
  status: number;
  ok: boolean;
  statusText: string;
  dataLength?: number;
  dataType?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Full auth debug starting...');
    
    // Check cookies from request headers
    const cookieHeader = request.headers.get('cookie') || '';
    const nextAuthCookies = cookieHeader
      .split(';')
      .map(cookie => cookie.trim())
      .filter(cookie => cookie.includes('next-auth') || cookie.includes('__Secure-next-auth'))
      .map(cookie => {
        const [name, ...valueParts] = cookie.split('=');
        const value = valueParts.join('=');
        return { 
          name: name.trim(), 
          hasValue: !!value, 
          valueLength: value.length 
        };
      });
    
    console.log('🧪 NextAuth cookies:', nextAuthCookies);

    // Session retrieval disabled (next-auth removed)
    const session: any = null;
    
    console.log('🧪 Session result:', {
      hasSession: false,
      hasUser: false,
      hasAccessToken: false,
      sessionError: undefined,
      sessionKeys: [],
      userKeys: []
    });

    // Test Django API call if we have a token
    let djangoTestResult: DjangoTestResult | null = null;
    if (false) {
      try {
        console.log('🧪 Testing Django API with token...');
        const djangoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/properties/`, {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        const baseResult: DjangoTestResult = {
          status: djangoResponse.status,
          ok: djangoResponse.ok,
          statusText: djangoResponse.statusText
        };
        
        if (djangoResponse.ok) {
          const data = await djangoResponse.json();
          djangoTestResult = {
            ...baseResult,
            dataLength: Array.isArray(data) ? data.length : 0,
            dataType: typeof data
          };
        } else {
          const errText = await djangoResponse.text();
          djangoTestResult = {
            ...baseResult,
            error: errText
          };
        }
        
        console.log('🧪 Django API test result:', djangoTestResult);
      } catch (error) {
        console.error('🧪 Django API test error:', error);
        djangoTestResult = { 
          status: 0, 
          ok: false, 
          statusText: 'Error',
          error: getErrorMessage(error) 
        };
      }
    } else {
      console.log('🧪 No access token available for Django API test');
    }

    const result = {
      timestamp: new Date().toISOString(),
      cookies: {
        total: nextAuthCookies.length,
        cookies: nextAuthCookies
      },
      session: {
        exists: !!session,
        hasUser: !!session?.user,
        hasAccessToken: !!session?.user?.accessToken,
        error: session?.error,
        userId: session?.user?.id,
        username: session?.user?.username,
        tokenLength: session?.user?.accessToken?.length,
        propertiesCount: session?.user?.properties?.length
      },
      djangoApiTest: djangoTestResult,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        apiUrl: process.env.NEXT_PUBLIC_API_URL
      }
    };

    console.log('🧪 Debug result summary:', {
      hasSession: result.session.exists,
      hasAccessToken: result.session.hasAccessToken,
      cookiesFound: result.cookies.total,
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('🧪 Auth debug error:', error);
    return NextResponse.json({
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
