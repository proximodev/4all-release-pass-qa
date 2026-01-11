import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MAX_BODY_SIZE = 512 * 1024 // 512KB

export async function middleware(request: NextRequest) {
    // Check request body size for methods that have bodies
    if (['POST', 'PATCH', 'PUT'].includes(request.method)) {
        const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
        if (contentLength > MAX_BODY_SIZE) {
            return NextResponse.json(
                { error: 'Request body too large', maxSize: '512KB' },
                { status: 413 }
            )
        }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        throw new Error(
            'Missing Supabase environment variables in middleware. ' +
            'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
        )
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        url,
        key,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    await supabase.auth.getUser()

    return response
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/releasepass/:path*',
        '/projects/:path*',
        '/settings/:path*',
        '/utilities/:path*',
        '/api/:path*',
    ],
}