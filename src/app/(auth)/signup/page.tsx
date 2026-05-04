'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })

      if (error) {
        console.error('Signup failed', error)
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
      console.error('Signup failed', error)
      setError(getSignupErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
        <div className="w-full max-w-sm bg-white border border-[#F0F0F0] rounded-[12px] p-8 text-center">
          <div className="text-4xl mb-4">확인</div>
          <h2 className="text-lg font-semibold mb-2">이메일을 확인해주세요</h2>
          <p className="text-sm text-[#6B7280]">
            {email}로 인증 메일을 발송했습니다.
            <br />
            이메일을 확인한 뒤 로그인해주세요.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="mt-6 w-full">로그인 페이지로</Button>
          </Link>
        </div>
      </div>
    )
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
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">회원가입</h2>

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
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-[8px]">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6B7280]">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-[#E8917E] font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
