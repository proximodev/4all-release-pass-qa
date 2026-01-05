'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [forgotPassword, setForgotPassword] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            router.push('/dashboard')
            router.refresh()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) throw error

            setSuccess('Password reset email sent. Check your inbox.')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleForgotPassword = () => {
        setForgotPassword(!forgotPassword)
        setError(null)
        setSuccess(null)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
                <Link href="https://4all.digital/" target={"_new"} className="flex items-center">
                    <Image
                        src="/img/logo-4all-light.svg"
                        alt="4All Digital"
                        title="4All Digital"
                        width={150}
                        height={40}
                    />
                </Link>
                <div>
                    <h2>{forgotPassword ? 'Reset Password' : 'Sign in to ReleasePass'}</h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={forgotPassword ? handleForgotPassword : handleLogin}>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 text-green-600 p-3 rounded">
                            {success}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        {!forgotPassword && (
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="py-2 px-4 bg-black text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading
                            ? (forgotPassword ? 'Sending...' : 'Signing in...')
                            : (forgotPassword ? 'Send Reset Email' : 'Sign in')
                        }
                    </button>
                </form>
                <button
                    type="button"
                    onClick={toggleForgotPassword}
                    className="p-0 text-sm border-0 underline text-blue-600 hover:text-blue-800"
                >
                    {forgotPassword ? 'Back to Sign In' : 'Forgot Password?'}
                </button>
            </div>
        </div>
    )
}
