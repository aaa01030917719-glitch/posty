const CONTACT_EMAIL = 'yujoouzuo@gmail.com'

const collectedItems = [
  '연결된 Instagram Professional 계정 ID',
  'Instagram username',
  '댓글 ID',
  '댓글 작성자의 Instagram scoped ID',
  '댓글 작성자 username',
  '댓글 내용',
  '자동 DM 처리 상태 및 발송 이력',
  '암호화된 Instagram access token',
]

const usageItems = [
  'Instagram 계정 연결',
  '댓글 keyword 감지',
  '자동 DM 및 공개 대댓글 처리',
  '팔로우 여부 확인',
  '공유자료 링크 발송',
  '오류 확인 및 중복 발송 방지',
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] px-5 py-10 text-[var(--color-text-primary)]">
      <article className="mx-auto max-w-3xl rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-8 sm:px-8">
        <header className="border-b border-[var(--color-border-soft)] pb-6">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">서비스명: Posty</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Posty 개인정보처리방침</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">최종 수정일: 2026. 06. 06.</p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--color-text-secondary)]">
          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">운영 목적</h2>
            <p className="mt-2">
              Posty는 Instagram 댓글 기반 자동 DM 및 공유자료 전달 기능을 제공하기 위해
              필요한 범위의 정보를 처리합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">수집 가능한 정보</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {collectedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">이용 목적</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {usageItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">보관 및 삭제</h2>
            <p className="mt-2">
              Posty는 서비스 제공에 필요한 기간 동안 관련 정보를 보관합니다. 사용자가
              Instagram 계정 연결을 해제하거나 삭제를 요청하는 경우, 서비스 운영상 필요한
              확인 절차를 거쳐 관련 데이터를 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제3자 제공 및 인프라</h2>
            <p className="mt-2">
              Posty는 서비스 제공을 위해 Meta Instagram API, Supabase, Vercel 인프라를
              사용할 수 있습니다. 각 인프라는 계정 연결, 데이터 저장, 애플리케이션 실행을
              위해 필요한 범위에서 사용됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">보호 조치</h2>
            <p className="mt-2">
              Instagram access token은 암호화하여 저장하며, app secret과 access token 같은
              민감한 secret은 브라우저에 노출하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">사용자 권리</h2>
            <p className="mt-2">
              사용자는 Posty가 처리하는 본인 관련 데이터의 열람, 수정, 삭제를 요청할 수
              있습니다. 데이터 삭제 요청 절차는 <a className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline" href="/data-deletion">사용자 데이터 삭제 요청 페이지</a>에서 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">문의</h2>
            <p className="mt-2">
              개인정보 및 데이터 삭제 관련 문의는{' '}
              <a className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              로 연락해주세요.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
