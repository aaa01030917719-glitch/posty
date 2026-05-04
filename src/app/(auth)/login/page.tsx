'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-canvas)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-accent)]">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Posty</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            콘텐츠 운영 관리 서비스
          </p>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 shadow-[var(--shadow-sm)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">로그인</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              이메일과 비밀번호를 입력해 Posty를 시작하세요.
            </p>
          </div>

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
              <p
                aria-live="polite"
                className="rounded-[var(--radius-md)] bg-[var(--color-bg-accent-soft)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
            계정이 없으신가요?{' '}
            <Link
              href="/signup"
              className="font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)] hover:underline"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
