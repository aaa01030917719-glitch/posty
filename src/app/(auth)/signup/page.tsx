'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

function normalizeEmail(email: string) {
  return email
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function logSignupError(error: unknown) {
  const details =
    typeof error === 'object' && error !== null
      ? {
          code: 'code' in error ? error.code : undefined,
          status: 'status' in error ? error.status : undefined,
          message: 'message' in error ? error.message : undefined,
        }
      : {
          code: undefined,
          status: undefined,
          message: undefined,
        }

  console.error('Signup failed', details, error)
}

function getSignupErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''
  const message = rawMessage.toLowerCase()

  if (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('already exists') ||
    message.includes('already in use')
  ) {
    return '이미 가입된 이메일일 수 있습니다. 로그인하거나 다른 이메일을 사용해주세요.'
  }

  if (
    message.includes('password') &&
    (
      message.includes('6') ||
      message.includes('character') ||
      message.includes('at least') ||
      message.includes('weak')
    )
  ) {
    return '비밀번호는 6자 이상 입력해주세요.'
  }

  if (
    message.includes('email') &&
    (
      message.includes('invalid') ||
      message.includes('valid') ||
      message.includes('address')
    )
  ) {
    return '올바른 이메일 주소를 입력해주세요.'
  }

  return '회원가입 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('비밀번호는 6자 이상 입력해주세요.')
      setLoading(false)
      return
    }

    try {
      const normalizedEmail = normalizeEmail(email)
      const normalizedName = name.trim()
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { name: normalizedName } },
      })

      if (error) {
        logSignupError(error)
        setError(getSignupErrorMessage(error))
        return
      }

      if (data.session) {
        router.push('/schedule')
        router.refresh()
        return
      }

      setDone(true)
    } catch (error) {
      logSignupError(error)
      setError(getSignupErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-canvas)] px-4 py-10">
        <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mb-4 text-4xl">확인</div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
            이메일을 확인해주세요
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {email}로 인증 메일을 발송했습니다.
            <br />
            메일함을 확인한 뒤 로그인해주세요.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="mt-6 w-full">
              로그인 페이지로 이동
            </Button>
          </Link>
        </div>
      </div>
    )
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
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">회원가입</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              새 계정을 만들고 Posty를 바로 시작하세요.
            </p>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <Input
              id="name"
              label="이름"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
              placeholder="6자 이상 입력"
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
              {loading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)] hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
