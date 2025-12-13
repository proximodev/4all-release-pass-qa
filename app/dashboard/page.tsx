import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Upsert user in database
    const dbUser = await prisma.user.upsert({
        where: { supabaseUserId: user.id },
        update: {
            email: user.email!,
            updatedAt: new Date(),
        },
        create: {
            supabaseUserId: user.id,
            email: user.email!,
            role: 'ADMIN',
        },
    })

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
                <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-lg">Welcome, {dbUser.email}</p>
                    <p className="text-sm text-gray-600 mt-2">Role: {dbUser.role}</p>
                    <form action="/api/auth/signout" method="POST" className="mt-4">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Sign Out
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}