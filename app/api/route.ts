import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Upsert user in our database
        const dbUser = await prisma.user.upsert({
            where: { supabaseUserId: user.id },
            update: {
                email: user.email!,
                updatedAt: new Date(),
            },
            create: {
                supabaseUserId: user.id,
                email: user.email!,
                role: 'ADMIN', // MVP: all users are admins
            },
        })

        return NextResponse.json({ user: dbUser })
    } catch (error: any) {
        console.error('User upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}