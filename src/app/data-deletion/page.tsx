const CONTACT_EMAIL = 'yujoouzuo@gmail.com'

const deletionTargets = [
  'Instagram 연결 metadata',
  '암호화된 access token',
  '자동 DM 규칙',
  '댓글 감지 및 발송 이력',
]

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] px-5 py-10 text-[var(--color-text-primary)]">
      <article className="mx-auto max-w-3xl rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-8 sm:px-8">
        <header className="border-b border-[var(--color-border-soft)] pb-6">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">서비스명: Posty</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Posty 사용자 데이터 삭제 요청</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">최종 수정일: 2026. 06. 06.</p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--color-text-secondary)]">
          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">삭제 요청 안내</h2>
            <p className="mt-2">
              사용자는 Posty에 연결된 Instagram 관련 데이터 삭제를 요청할 수 있습니다.
              요청이 접수되면 본인 확인과 처리 범위 확인 후 삭제 절차를 진행합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">삭제 대상 예시</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {deletionTargets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">삭제 요청 방법</h2>
            <p className="mt-2">
              아래 이메일로 데이터 삭제 요청을 보내주세요.
            </p>
            <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-4 py-3 font-medium text-[var(--color-text-primary)]">
              <a className="text-[var(--color-accent)] underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </p>
            <div className="mt-4 space-y-2">
              <p>이메일 제목 예시: <strong>Posty 사용자 데이터 삭제 요청</strong></p>
              <p>
                요청 본문에는 Posty 로그인 이메일과 연결된 Instagram username을 함께 기재해주세요.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">처리 절차</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>삭제 요청 이메일을 확인합니다.</li>
              <li>Posty 계정과 Instagram 연결 정보를 기준으로 요청자를 확인합니다.</li>
              <li>삭제 대상 데이터를 확인한 뒤 삭제를 진행합니다.</li>
              <li>처리 완료 후 이메일로 결과를 안내합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">참고</h2>
            <p className="mt-2">
              서비스 안정성, 오류 확인, 법적 의무 이행을 위해 일부 기록은 필요한 기간 동안
              제한적으로 보관될 수 있습니다. 이 경우에도 Posty는 필요한 범위 안에서만
              데이터를 처리합니다.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
