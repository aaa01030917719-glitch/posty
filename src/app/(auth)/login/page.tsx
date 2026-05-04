'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function getLoginErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''
  const message = rawMessage.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }

  if (
    (message.includes('email') && message.includes('not confirmed')) ||
    message.includes('email confirmation')
  ) {
    return '이메일 인증이 아직 완료되지 않았습니다. 메일함을 확인해주세요.'
  }

  if (
    message.includes('supabase') &&
    (
      message.includes('url') ||
      message.includes('key') ||
      message.includes('env') ||
      message.includes('environment')
    )
  ) {
    return '로그인 설정을 확인할 수 없습니다. 환경변수와 Supabase 설정을 확인해주세요.'
  }

  return '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('Login failed', error)
        setError(getLoginErrorMessage(error))
        return
      }

      router.push('/schedule')
      router.refresh()
    } catch (error) {
      console.error('Login failed', error)
      setError(getLoginErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-[#E8917E] mb-4">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Posty</h1>
          <p className="mt-1 text-sm text-[#6B7280]">콘텐츠 운영 관리 서비스</p>
        </div>

        <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-8">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">로그인</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              id="email"
              label="이메일"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="비밀번호"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-[8px]">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6B7280]">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="text-[#E8917E] font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
