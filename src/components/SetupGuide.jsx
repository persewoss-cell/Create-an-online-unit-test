export default function SetupGuide() {
  return (
    <div className="container narrow" style={{ maxWidth: 640 }}>
      <div className="card stack">
        <h1>Firebase 설정이 필요합니다</h1>
        <p>
          이 사이트는 Firebase(Firestore 데이터베이스 + 로그인)를 사용합니다. 프로젝트 폴더의 <code>.env.example</code>을{' '}
          <code>.env</code>로 복사한 뒤 Firebase 웹 앱 설정값을 입력하고 다시 빌드해 주세요.
        </p>
        <p className="muted small">자세한 순서는 README.md의 “Firebase 설정” 항목을 참고하세요.</p>
      </div>
    </div>
  );
}
