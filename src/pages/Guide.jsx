import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { goBackTo } from '../lib/nav.js';
import TopBar from '../components/TopBar.jsx';
import { DEFAULT_TEACHER_PASSWORD, MIN_TEACHER_PASSWORD } from '../lib/school.js';

// 사용설명서: 학생용 / 교사용을 순서대로. 앱 안의 버튼·아이콘은 실제 화면과 같은 모양으로 보여 준다.

const WHO = [
  ['student', '✏️ 학생용 설명서'],
  ['teacher', '🧑‍🏫 교사용 설명서'],
];

/** 실제 버튼과 같은 모양 (눌러지지 않음) */
function B({ c = '', children }) {
  return <span className={`btn sm demo ${c}`}>{children}</span>;
}

/** 채점 표시 O / X / ? */
function M({ s, over }) {
  return <span className={`mark sm ${s} ${over ? 'overridden' : ''} demo`}>{{ correct: 'O', wrong: 'X', review: '?' }[s]}</span>;
}

function Badge({ c, children }) {
  return <span className={`badge ${c}`}>{children}</span>;
}

/** 채점된 시험지의 빨간 동그라미 · 빗금 · 노란 형광 */
function PaperMark({ kind }) {
  return (
    <svg className="guide-paper-mark" viewBox="0 0 40 40" aria-hidden="true">
      {kind === 'review' && <rect x="2" y="9" width="36" height="22" rx="4" fill="#ffe066" opacity="0.7" />}
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1c2430">1</text>
      {kind === 'correct' && <circle cx="20" cy="20" r="15" fill="none" stroke="#d64545" strokeWidth="3" />}
      {kind === 'wrong' && <line x1="8" y1="34" x2="32" y2="6" stroke="#d64545" strokeWidth="3.5" strokeLinecap="round" />}
    </svg>
  );
}

/** 아이콘 · 버튼 모음표 */
function IconTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="data guide-icons">
        <thead><tr><th className="c">모양</th><th>이름 · 뜻</th></tr></thead>
        <tbody>
          {rows.map(([icon, text], i) => (
            <tr key={i}>
              <td className="c nowrap">{icon}</td>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({ id, no, title, children }) {
  return (
    <section className="card guide-step" id={id}>
      <h2><span className="guide-no">{no}</span>{title}</h2>
      {children}
    </section>
  );
}

function Tip({ children }) {
  return <div className="alert info guide-tip">💡 {children}</div>;
}

function Warn({ children }) {
  return <div className="alert warn guide-tip">⚠️ {children}</div>;
}

/** 목차 (HashRouter라 #주소 대신 스크롤로 이동) */
function Toc({ items }) {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="card guide-toc" aria-label="목차">
      <b>목차</b>
      <ol>
        {items.map(([id, title]) => (
          <li key={id}>
            <button type="button" className="link-like" onClick={() => go(id)}>{title}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ───────────────────────── 학생용 ───────────────────────── */

const STUDENT_TOC = [
  ['s-login', '로그인하기'],
  ['s-list', '평가 목록 보기'],
  ['s-screen', '문제 푸는 화면 살펴보기'],
  ['s-answer', '문제 유형별로 답하는 법'],
  ['s-draw', '그리기 도구 쓰는 법'],
  ['s-save', '자동 저장과 이어 풀기'],
  ['s-submit', '답안 제출하기'],
  ['s-result', '결과 보기'],
  ['s-retake', '오답 재응시 (틀린 문제 다시 풀기)'],
  ['s-alert', '선생님 알림 (🔔)'],
  ['s-exit', '나가기'],
  ['s-icons', '아이콘 · 버튼 한눈에 보기'],
  ['s-faq', '이럴 땐 이렇게 (자주 묻는 질문)'],
];

function StudentGuide() {
  return (
    <>
      <Toc items={STUDENT_TOC} />

      <Step id="s-login" no="1" title="로그인하기">
        <p>첫 화면에서 <B c="primary">학생 로그인</B> 탭이 골라져 있는지 확인하고, 아래 칸을 차례대로 채워요.</p>
        <ol>
          <li><b>학교 이름</b> — 예: <code>광양중동초등학교</code>. <code>광양중동초</code>처럼 줄여 써도 되고, 띄어쓰기는 상관없어요.</li>
          <li><b>학년 · 반 · 번호</b> — 숫자만 써요.</li>
          <li><b>이름</b> — 선생님이 등록한 이름과 <b>한 글자도 틀리지 않게</b> 써요.</li>
          <li>☑ <b>로그인 정보 저장</b> — 체크하면 다음에 이 기기에서 칸이 미리 채워져요. <b>내 기기에서만</b> 체크하세요.</li>
          <li><B c="primary">로그인</B>을 눌러요.</li>
        </ol>
        <Warn>“학생 명단에 없습니다”처럼 빨간 글이 나오면 학교 이름 · 학년 · 반 · 번호 · 이름이 맞는지 다시 확인하고, 그래도 안 되면 선생님께 말씀드려요.</Warn>
      </Step>

      <Step id="s-list" no="2" title="평가 목록 보기">
        <p>로그인하면 <b>볼 수 있는 단원평가</b> 목록이 나와요. 위쪽 오른편에는 내 학년 · 반 · 번호 · 이름과 <B>나가기</B> 버튼이 있어요.</p>
        <p>평가 카드마다 과목 · 학년 · 학기 · 단원, 평가 제목, 문항 수가 보이고 오른쪽 버튼이 상태를 알려 줘요.</p>
        <IconTable rows={[
          [<B c="primary">평가 시작</B>, '아직 안 본 평가예요. 누르면 문제 풀기가 시작돼요.'],
          [<B c="done-btn">✔ 응시 완료</B>, '이미 제출한 평가예요. 다시 풀 수는 없어요.'],
          [<B c="result-btn">평가 결과</B>, '내 점수와 채점된 시험지를 볼 수 있어요.'],
        ]} />
        <p>선생님이 마감한 평가는 아래쪽 <b>지난 평가 결과</b>에 모여요. 지금 볼 평가가 없으면 “선생님이 평가를 열 때까지 기다려 주세요”라고 나와요.</p>
        <Tip>선생님이 새 평가를 열거나 마감하면 새로고침하지 않아도 목록이 바로 바뀌고, 화면 위에 🔔 알림이 떠요.</Tip>
      </Step>

      <Step id="s-screen" no="3" title="문제 푸는 화면 살펴보기">
        <p><B c="primary">평가 시작</B>을 누르면 한 화면에 <b>한 문제씩</b> 나와요. 화면은 세 부분으로 나뉘어요.</p>
        <h3>① 위쪽</h3>
        <ul>
          <li>평가 제목과 내 이름</li>
          <li>저장 상태: <span className="muted">저장 중…</span> → <span style={{ color: '#1f8a4c' }}>✓ 자동 저장됨</span> (인터넷이 잠깐 끊기면 <b>✓ 이 기기에 저장됨</b>)</li>
          <li><b>답한 문항 3/10</b>과 파란 진행 막대 — 몇 문제에 답했는지 보여 줘요.</li>
        </ul>
        <h3>② 가운데</h3>
        <ul>
          <li>문제지에서 그 문제만 잘라 크게 보여 줘요. 지문(“다음 글을 읽고…”)이 있으면 함께 나와요.</li>
          <li>답 칸에는 <b>○번</b>과 문제 유형 · 배점(예: 객관식 · 5점)이 적혀 있어요. 태블릿을 가로로 두면 답 칸이 오른쪽에, 세로로 두면 아래쪽에 나와요.</li>
        </ul>
        <h3>③ 아래쪽</h3>
        <IconTable rows={[
          [<B>← 이전</B>, '앞 문제로 가요.'],
          [<span className="guide-qnav"><span>1</span><span className="done">2</span><span className="current">3</span><span className="missing">4</span></span>, '문제 번호 버튼. 누르면 그 문제로 바로 가요. 흰색 = 아직 안 풂, 파란색 = 답함, 굵은 테두리 = 지금 보는 문제, 빨간색 = 답을 안 써서 제출이 안 되는 문제'],
          [<B c="primary">다음 →</B>, '다음 문제로 가요. (마지막 문제에서는 안 보여요)'],
          [<B c="primary">제출하기</B>, '다 풀었으면 눌러요. (7번 설명 참고)'],
        ]} />
      </Step>

      <Step id="s-answer" no="4" title="문제 유형별로 답하는 법">
        <IconTable rows={[
          [<span className="guide-choices"><span className="choice">①</span><span className="choice selected">②</span><span className="choice">③</span></span>,
            <><b>객관식</b> — 답 버튼을 누르면 파란색이 돼요. 같은 버튼을 한 번 더 누르면 취소돼요. “알맞은 것을 모두 고르세요”가 보이면 여러 개를 고를 수 있어요. 보기 기호는 ①②③, ㉠㉡㉢, ㉮㉯㉰, O/X, 왼쪽/오른쪽처럼 문제마다 달라요.</>],
          [<span className="guide-choices"><b>(1)</b> → <span className="choice selected">㉠</span><span className="choice">㉡</span></span>,
            <><b>선 잇기</b> — (1), (2)… 줄마다 이어지는 것을 하나씩 눌러요.</>],
          [<span className="guide-input">답을 입력하세요</span>,
            <><b>단답형</b> — 답을 글자로 써요. “□ 칸마다 순서대로 답을 쓰세요”가 보이면 <b>첫째 칸, 둘째 칸…</b>에 순서대로 하나씩 써요. 수학은 단위(cm, L 등)도 꼭 써요.</>],
          [<span className="guide-input tall">답을 문장으로 써 주세요</span>,
            <><b>서술형</b> — 문장으로 자세히 써요. 핵심 낱말이 들어가야 정답으로 인정돼요.</>],
          [<span className="key-box guide-mini">✏️ 그리기 문항</span>,
            <><b>그리기</b> — 문제 그림 위에 손가락이나 펜으로 직접 그려요. 답 칸이 함께 있으면 길이 같은 답도 써요. 그림을 그렸으면 답 칸은 비워도 제출돼요.</>],
          [<b>(1) (2)</b>,
            <><b>답이 여러 부분인 문제</b> — (1), (2)마다 따로 답해요. 모든 부분이 맞아야 정답이에요.</>],
        ]} />
      </Step>

      <Step id="s-draw" no="5" title="그리기 도구 쓰는 법">
        <p>그리기 문항에서는 답 칸 위에 도구 모음이 나와요. 쓰고 싶은 도구를 누르면 파란색으로 바뀌어요.</p>
        <IconTable rows={[
          [<B>✏️ 펜</B>, '손 가는 대로 자유롭게 그려요.'],
          [<B>📏 직선</B>, '누른 곳에서 뗀 곳까지 곧은 선을 그어요.'],
          [<B>⭕ 컴퍼스</B>, '누른 곳(빨간 점)이 원의 중심이 되고, 끌어간 만큼 반지름이 되는 원을 그려요.'],
          [<B>• 점</B>, '누른 자리에 점을 찍어요.'],
          [<B>🧽 지우개</B>, '지우고 싶은 선 위를 문지르면 그 선이 통째로 지워져요.'],
          [<B>📐 자</B>, '화면에 실제 크기 눈금(cm)이 있는 노란 자를 꺼내요. 자를 끌면 움직이고, 끝의 파란 ↻ 를 끌면 돌아가요. 다시 그리려면 다른 도구를 누르고, 자를 치우려면 📐 자 치우기를 눌러요.'],
          [<B>↩ 되돌리기</B>, '방금 그린 것을 하나씩 취소해요.'],
          [<B>🗑 모두 지우기</B>, '이 문제에 그린 것을 모두 지워요.'],
        ]} />
      </Step>

      <Step id="s-save" no="6" title="자동 저장과 이어 풀기">
        <ul>
          <li>답을 쓰거나 고칠 때마다 <b>자동으로 저장</b>돼요. 저장 버튼은 따로 없어요.</li>
          <li>실수로 창을 닫거나 태블릿이 꺼져도 괜찮아요. 다시 로그인해서 <B c="primary">평가 시작</B>을 누르면 “지난번에 풀던 답 ○문항을 불러왔어요”라는 🔔 알림과 함께 이어서 풀 수 있어요. 다른 기기로 들어가도 이어져요.</li>
        </ul>
      </Step>

      <Step id="s-submit" no="7" title="답안 제출하기">
        <ol>
          <li>모든 문제에 답한 뒤 <B c="primary">제출하기</B>를 눌러요.</li>
          <li>답하지 않은 문제가 있으면 “아직 답하지 않은 문항이 있어 제출할 수 없어요: 3, 5번”이 뜨고, 그 문제로 이동하며 번호가 <span className="guide-qnav"><span className="missing">3</span></span> 빨간색이 돼요. 답을 채운 뒤 다시 눌러요.</li>
          <li>“답안을 제출할까요?” 창이 뜨면
            <ul>
              <li><B>다시 확인하기</B> — 창을 닫고 답을 더 살펴봐요.</li>
              <li><B c="primary">제출</B> — 정말 제출해요.</li>
            </ul>
          </li>
        </ol>
        <Warn>제출하면 답을 고칠 수 없고, 다시 풀 수 없어요. 꼭 한 번 더 확인한 뒤 제출하세요.</Warn>
      </Step>

      <Step id="s-result" no="8" title="결과 보기">
        <p>제출하면 바로 결과 화면으로 가요. 목록에서 <B c="result-btn">평가 결과</B>를 눌러도 볼 수 있어요.</p>
        <ul>
          <li>맨 위에 <b>100점 만점 점수</b>와 “10문항 중 8문항 정답”이 나와요.</li>
          <li>노란 글 “선생님이 확인해야 하는 답이 ○개 있어요”가 보이면, 선생님이 확인한 뒤 점수가 올라갈 수 있어요.</li>
          <li>아래에는 선생님이 채점한 것처럼 표시된 <b>내 시험지</b>가 나와요. 정답은 보여 주지 않아요.</li>
        </ul>
        <IconTable rows={[
          [<PaperMark kind="correct" />, '번호에 빨간 동그라미 — 맞았어요.'],
          [<PaperMark kind="wrong" />, '번호에 빨간 빗금 — 틀렸어요.'],
          [<PaperMark kind="review" />, '노란 형광펜 + “선생님 확인 중” — 선생님이 보고 판단할 답이에요.'],
          [<span style={{ color: '#1c3faa', fontWeight: 700 }}>파란 글씨</span>, '내가 쓴 답이에요.'],
        ]} />
        <Tip>선생님이 답을 확인하거나 정답을 고치면 새로고침하지 않아도 점수가 바로 바뀌고 🔔 알림이 떠요.</Tip>
        <p>위쪽 <B>평가 목록</B> 버튼을 누르면 목록으로 돌아가요.</p>
      </Step>

      <Step id="s-retake" no="9" title="오답 재응시 (틀린 문제 다시 풀기)">
        <p>선생님이 오답 재응시를 열어 주면 결과 화면에 <b>오답 재응시</b> 칸이 생겨요.</p>
        <ol>
          <li><B c="primary">오답 재응시 (3문제)</B>를 누르면 <b>아직 못 맞힌 문제만</b> 다시 나와요. 화면 위에 <Badge c="review">오답 재응시</Badge> 표시가 붙어요.</li>
          <li>푸는 방법과 <B c="primary">제출하기</B>는 처음과 같아요. 제출하면 결과 화면으로 돌아가요.</li>
          <li>또 틀린 문제는 맞힐 때까지 다시 풀 수 있어요.</li>
        </ol>
        <IconTable rows={[
          [<B c="retake-done">선생님 확인 중</B>, '다시 푼 답을 선생님이 보고 있어요. 기다려요.'],
          [<B c="retake-done">✔ 오답 재응시 완료</B>, '틀린 문제를 모두 다시 풀어 맞혔어요!'],
          [<B>재응시 결과 보기</B>, '문제마다 처음 답 · 1차 · 2차… 다시 푼 답과 O / X / ? 결과를 보여 줘요. 다시 누르면(재응시 결과 닫기) 접혀요.'],
        ]} />
        <Tip>오답 재응시를 해도 <b>점수는 처음 제출한 점수 그대로</b>예요. 틀린 문제를 제대로 알고 넘어가기 위한 연습이에요.</Tip>
      </Step>

      <Step id="s-alert" no="10" title="선생님 알림 (🔔)">
        <p>화면 위쪽에 <span className="toast info guide-mini">🔔 알림 내용 <B>확인</B></span> 같은 알림이 떠요. <B>확인</B>을 누르면 닫히고, 잠시 뒤 저절로 사라져요.</p>
        <ul>
          <li><b>새 평가가 열렸어요 / 응시를 마감했어요</b> — 목록이 바뀌었어요.</li>
          <li><b>선생님이 ○번 문제를 고쳤어요</b> — 문제를 푸는 중이면 그 문제를 다시 확인해요. 답 형식이 바뀐 문제는 써 둔 답이 지워지니 다시 답해요.</li>
          <li><b>선생님이 평가를 마감했어요</b> — 푸는 중에 마감되면 더 풀 수 없어요.</li>
          <li><b>선생님이 처음부터 다시 볼 수 있게 했어요</b> — <B>다시 보기</B>를 누르면 처음부터 다시 풀어요.</li>
          <li><b>선생님이 다시 푼 ○번을 맞았다고 했어요! 🎉</b> — 오답 재응시 답을 선생님이 인정했어요.</li>
        </ul>
      </Step>

      <Step id="s-exit" no="11" title="나가기">
        <ul>
          <li>평가 목록 위쪽의 <B>나가기</B>를 누르면 로그아웃되고 첫 화면으로 가요.</li>
          <li>맨 위 <b>📝 온라인 단원평가</b> 글자를 눌러도 첫 화면으로 가요.</li>
          <li>창(탭)을 닫아도 로그아웃돼요. 학교 태블릿처럼 여러 사람이 쓰는 기기에서는 꼭 나가기를 눌러요.</li>
        </ul>
      </Step>

      <Step id="s-icons" no="12" title="아이콘 · 버튼 한눈에 보기">
        <IconTable rows={[
          ['✏️', '첫 화면 학생 로그인 그림'],
          ['📝', '맨 위 “📝 온라인 단원평가” — 누르면 첫 화면'],
          ['📖', '사용설명서 (지금 보는 화면)'],
          [<B c="done-btn">✔ 응시 완료</B>, '이미 제출한 평가'],
          ['✓ 자동 저장됨', '답이 저장되었어요'],
          ['🔔', '선생님이 한 일을 알려 주는 알림'],
          ['← 이전 / 다음 →', '문제 넘기기'],
          ['✏️ 📏 ⭕ • 🧽', '그리기 도구: 펜 · 직선 · 컴퍼스 · 점 · 지우개'],
          ['📐 / ↻', '자 꺼내기 / 자 돌리기 손잡이'],
          ['↩ / 🗑', '되돌리기 / 모두 지우기'],
          [<><M s="correct" /> <M s="wrong" /> <M s="review" /></>, '재응시 결과의 맞음 / 틀림 / 선생님 확인 중'],
          [<Badge c="review">오답 재응시</Badge>, '틀린 문제를 다시 푸는 중'],
          ['🎉', '다시 푼 문제를 맞혔어요'],
        ]} />
      </Step>

      <Step id="s-faq" no="13" title="이럴 땐 이렇게 (자주 묻는 질문)">
        <dl className="guide-faq">
          <dt>로그인이 안 돼요.</dt>
          <dd>학교 이름 · 학년 · 반 · 번호 · 이름을 다시 확인해요. 이름은 선생님 명단과 똑같아야 해요. 그래도 안 되면 선생님께 명단에 있는지 여쭤봐요.</dd>
          <dt>목록에 평가가 없어요.</dt>
          <dd>선생님이 아직 시험을 열지 않았거나, 우리 반이 대상이 아닐 수 있어요. 열리면 자동으로 나타나요.</dd>
          <dt>제출하기를 눌렀는데 제출이 안 돼요.</dt>
          <dd>빨간색 번호 문제에 답을 채워요. 모든 문제에 답해야 제출돼요.</dd>
          <dt>제출한 답을 고치고 싶어요.</dt>
          <dd>제출한 뒤에는 직접 고칠 수 없어요. 선생님께 말씀드리면 다시 볼 수 있게 해 주실 수 있어요.</dd>
          <dt>“지금은 볼 수 없는 평가입니다”라고 나와요.</dt>
          <dd>선생님이 평가를 마감했어요. <B>평가 목록으로</B>를 눌러 돌아가요.</dd>
        </dl>
      </Step>
    </>
  );
}

/* ───────────────────────── 교사용 ───────────────────────── */

const TEACHER_TOC = [
  ['t-start', '시작하기 전에 (전체 흐름)'],
  ['t-login', '교사 로그인 · 비밀번호 변경'],
  ['t-bar', '화면 위쪽 막대 (모든 화면 공통)'],
  ['t-roster', '학생 명단 등록하기'],
  ['t-create1', '새 평가 만들기 ① 문제지 PDF와 평가 정보'],
  ['t-create2', '새 평가 만들기 ② 정답 넣기'],
  ['t-edit', '문항 세부 수정'],
  ['t-save', '저장하기'],
  ['t-open', '시험 개시 · 응시 마감'],
  ['t-list', '내 단원평가 목록'],
  ['t-results', '평가 화면 · 결과 탭'],
  ['t-review', '검토 요청 탭'],
  ['t-retake', '오답 재응시 · 전체 재응시'],
  ['t-analysis', '문항 분석 · 엑셀 내려받기'],
  ['t-fix', '문항·정답 수정 탭 · 설정 탭'],
  ['t-share', '시험지 공유 · 공유 시험지 가져오기'],
  ['t-alert', '실시간 알림 · 바탕화면 알림'],
  ['t-admin', '관리자 기능'],
  ['t-icons', '아이콘 · 버튼 한눈에 보기'],
  ['t-faq', '이럴 땐 이렇게 (자주 묻는 질문)'],
];

function TeacherGuide() {
  return (
    <>
      <Toc items={TEACHER_TOC} />

      <Step id="t-start" no="0" title="시작하기 전에 (전체 흐름)">
        <ol className="guide-flow">
          <li><b>교사 로그인</b> (계정은 관리자가 만들어 줍니다)</li>
          <li><b>학생 명단 등록</b> — 명단에 있는 학생만 로그인할 수 있어요.</li>
          <li><b>새 평가 만들기</b> — 문제지 PDF 올리기 → 정답 엑셀 올리기 → 저장</li>
          <li><B c="ok">시험 개시</B> — 이때부터 학생 목록에 평가가 보여요.</li>
          <li>학생 응시 → <b>자동 채점</b> → 필요한 답만 <b>검토 요청</b>에서 확인</li>
          <li><B c="danger">응시 마감</B> → 결과 확인 · 엑셀 내려받기 · 오답 재응시</li>
        </ol>
      </Step>

      <Step id="t-login" no="1" title="교사 로그인 · 비밀번호 변경">
        <ol>
          <li>첫 화면에서 <B c="primary">교사 로그인</B> 탭을 눌러요.</li>
          <li><b>학교 · 학년 · 반 · 비밀번호</b>를 입력해요. 처음 비밀번호는 관리자가 알려 준 번호(기본 <code>{DEFAULT_TEACHER_PASSWORD}</code>)예요.</li>
          <li>☑ <b>로그인 정보 저장</b>을 체크하면 학교 · 학년 · 반을 기억하고, 브라우저를 닫아도 로그인이 유지돼요.</li>
          <li><B c="primary">로그인</B>을 누르면 <b>내 단원평가</b> 목록으로 가요.</li>
        </ol>
        <p>처음 로그인했다면 위쪽 <B>비밀번호 변경</B>을 눌러 현재 비밀번호 · 새 비밀번호({MIN_TEACHER_PASSWORD}자 이상) · 새 비밀번호 확인을 쓰고 <B c="primary">변경</B>을 눌러요.</p>
        <Tip>이미 로그인된 상태로 첫 화면에 오면 “○○(으)로 로그인되어 있어요”가 나와요. <B c="primary">내 단원평가로</B> 또는 <B>로그아웃</B>을 고르세요.</Tip>
      </Step>

      <Step id="t-bar" no="2" title="화면 위쪽 막대 (모든 화면 공통)">
        <IconTable rows={[
          ['📝 온라인 단원평가', '누르면 내 단원평가 목록으로 가요.'],
          ['학교 ○학년 ○반', '지금 로그인한 선생님'],
          [<B>🔕 바탕화면 알림 켜기</B>, '누르고 브라우저에서 “허용”하면 창을 내려 두어도 Windows 알림으로 학생 제출을 알려 줘요. 켜지면 초록색 🔔 알림 켜짐으로 바뀌고, 한 번 더 누르면 꺼져요.'],
          [<B>비밀번호 변경</B>, '목록 화면에만 있어요.'],
          [<B>목록</B>, '평가 만들기 · 평가 화면 · 학생 명단 화면에서 내 단원평가 목록으로 돌아가요.'],
          [<B>로그아웃</B>, '맨 오른쪽. 로그아웃하고 교사 로그인 화면으로 가요.'],
        ]} />
      </Step>

      <Step id="t-roster" no="3" title="학생 명단 등록하기">
        <p>목록 화면의 <B>👥 학생 명단 추가·수정</B>을 눌러요. 학생은 <b>내 학교 이름 · 학년 · 반 · 번호 · 이름</b>이 명단과 똑같아야 로그인할 수 있어요.</p>
        <h3>방법 1. 엑셀로 한꺼번에 (추천)</h3>
        <ol>
          <li><B>학생 명단 양식 다운로드</B>를 눌러 양식(학년 · 반 · 번호 · 이름)을 받아요.</li>
          <li>엑셀에 학생을 채워 저장해요. 학년 칸이 없으면 옆의 <b>“학년 칸이 없으면 ○학년으로”</b>에서 고른 학년이 들어가요.</li>
          <li>📂 <b>학생 명단 엑셀</b> 칸에 파일을 끌어다 놓거나 눌러서 골라요.</li>
          <li>“엑셀에서 ○명을 찾았습니다”를 확인하고 골라요.
            <ul>
              <li><B c="primary">명단에 추가 (같은 번호는 덮어쓰기)</B> — 지금 명단은 두고 더해요.</li>
              <li><B c="danger">지금 명단을 지우고 새로 바꾸기</B> — 명단을 통째로 바꿔요.</li>
              <li><B>취소</B></li>
            </ul>
          </li>
        </ol>
        <h3>방법 2. 한 명씩</h3>
        <p>학년 · 반 · 번호 · 이름을 쓰고 <B c="primary">+ 학생 추가</B>를 눌러요. 추가하면 번호가 하나씩 저절로 올라가요.</p>
        <h3>고치기 · 지우기</h3>
        <p>표의 <B>수정</B> → 고친 뒤 <B c="primary">저장</B> / <B>취소</B>, <B c="danger">삭제</B>로 지워요(이미 본 평가 결과는 남아요). 반이 여러 개면 오른쪽 위 <b>전체 ▾</b>에서 반을 골라 볼 수 있어요.</p>
        <Warn>같은 학교의 다른 선생님 명단에 이미 있는 학생은 저장되지 않아요. 그 선생님(또는 관리자)이 먼저 지워야 해요.</Warn>
      </Step>

      <Step id="t-create1" no="4" title="새 평가 만들기 ① 문제지 PDF와 평가 정보">
        <p>목록 화면의 <B c="primary">+ 새 평가 만들기</B>를 눌러요.</p>
        <h3>1. 문제지 PDF 올리기</h3>
        <ul>
          <li>📂 <b>문제 PDF</b> 칸에 문제지 PDF를 끌어다 놓거나 눌러서 골라요. (PDF만 올릴 수 있어요)</li>
          <li>올리자마자 <span className="spinner" /> “문제지를 읽는 중… → 문항 이미지를 만드는 중… (3/4)”이 나오며 자동으로 분석해요.</li>
          <li>다 되면 <span className="alert success guide-mini">✔ 4쪽에서 문항 20개를 찾았어요.</span>가 나와요. 문항 번호와 지문(“※ 다음 글을 읽고 물음에 답하시오. (1~4)”)을 찾아 문항별로 잘라 주고, 머리글에서 과목 · 학년 · 학기 · 단원을 찾아 아래 칸을 채워 줘요.</li>
        </ul>
        <h3>2. 평가 정보</h3>
        <IconTable rows={[
          ['과목 *', '목록에서 골라요. “기타”를 고르면 과목 이름을 직접 써요. 수학은 단답형에 단위를 꼭 써야 정답이에요.'],
          ['학년 * · 학기 *', '시험 대상 학년과 학기'],
          ['단원', '예) 2. 생물과 환경'],
          ['평가 제목', '비워 두면 “5학년 1학기 과학 2. 생물과 환경 단원평가”처럼 자동으로 만들어져요.'],
          ['응시할 반', '비워 두면 그 학년 전체. 특정 반만이면 1, 3처럼 써요.'],
          ['서술형·단답형 채점 기준', '엄격 / 보통 / 관대. 관대할수록 모범 답안과 조금 달라도 정답으로 인정해요.'],
        ]} />
        <p>다 채웠으면 <B c="primary">다음: 문항·정답 확인 →</B>을 눌러요.</p>
      </Step>

      <Step id="t-create2" no="5" title="새 평가 만들기 ② 정답 넣기">
        <p>파란 <b>정답 넣기</b> 상자에서 두 단계로 정답을 넣어요.</p>
        <ol>
          <li><b>①</b> <B>정답 엑셀 양식 다운로드 (20문항)</B> — 번호가 미리 적힌 엑셀을 받아요. “답 쓰는 법 (자동 안내)” 열에 문항마다 쓰는 법이 적혀 있어요.</li>
          <li><b>②</b> 번호 옆 <b>“정답”</b> 칸만 채워 저장한 뒤, 📂 <b>정답 엑셀</b> 칸에 올려요. “배점” 칸은 비워 두면 100점을 문항 수로 나눠요.</li>
        </ol>
        <h3>정답 칸에 쓰는 법</h3>
        <div className="table-wrap">
          <table className="data guide-icons">
            <thead><tr><th>문항</th><th>이렇게 쓰기</th></tr></thead>
            <tbody>
              <tr><td>객관식</td><td><code>4</code> 또는 <code>④</code> (답이 여러 개면 <code>2, 4</code>)</td></tr>
              <tr><td>기호로 고르기 · ○표</td><td><code>㉮</code>, <code>(3)</code>, <code>오른쪽</code>(왼쪽 · 가운데 · 위 · 아래)</td></tr>
              <tr><td>선 잇기</td><td><code>(1)-① (2)-②</code></td></tr>
              <tr><td>단답형</td><td>답 그대로 <code>서까래</code> · 여러 답 인정 <code>로제타 선생님 / 로제타</code> · □ 칸이 여러 개면 쉼표로 <code>3, 6, 9</code> (쉼표 수만큼 답 칸이 생겨요)</td></tr>
              <tr><td>서술형</td><td>모범 답안 문장 · 예시 답안은 <code>(예) 우울한 표정 / 걱정하는 목소리</code></td></tr>
              <tr><td>그리기</td><td><code>그리기</code> (길이도 쓰면 <code>그리기 + 3 cm</code>)</td></tr>
              <tr><td>선생님이 직접 채점</td><td><code>검토</code></td></tr>
            </tbody>
          </table>
        </div>
        <h3>문항 카드 확인</h3>
        <ul>
          <li>위쪽에 <b>20문항 · 총점 100점</b>이 보여요. 100점이 아니면 노란색이에요. <B>배점 100점 균등 분배</B>로 똑같이 나눌 수 있어요.</li>
          <li>문항 카드 왼쪽은 잘라 낸 문제, 오른쪽은 <b>학생 화면 미리보기</b>예요. <b>초록색이 정답</b>이에요(<span className="key-check">✓ 정답</span>).</li>
          <li>카드 머리에 <Badge c="draft">객관식</Badge> 같은 유형, <Badge c="review">선생님 채점</Badge>, <Badge c="draft">+ 그리기</Badge> 표시와 <b>배점</b> 칸이 있어요.</li>
          <li>정답이 없는 문항은 카드가 노랗게 되고 <span style={{ color: 'var(--warn)' }}>⚠ 정답이 없습니다</span>가 나와요. 위쪽에도 “정답 없음: 3, 7번”으로 모아 보여 줘요.</li>
          <li>잘못 인식된 문항은 <B>세부 수정 ▾</B>을 눌러 고쳐요(다음 설명). 닫을 때는 <B>세부 수정 닫기 ▴</B>.</li>
        </ul>
      </Step>

      <Step id="t-edit" no="6" title="문항 세부 수정">
        <IconTable rows={[
          [<B c="primary">🔄 답안 유형 다시 인식하기</B>, '인식이 틀렸으면 눌러요. 누를 때마다 다른 방법으로 다시 읽어요(예: 다시 인식 1/3).'],
          ['번호 · 유형 · 배점 · 쪽 · 문제 요약', '유형은 객관식(고르기) · 단답형 · 서술형 · 선 잇기 · 그리기 중에서 골라요.'],
          [<B c="danger">삭제</B>, '이 문항을 지워요.'],
          [<B>선생님이 직접 채점</B>, '켜면 노란 ✔ 선생님이 직접 채점 (켜짐)이 되고, 학생 답이 모두 검토 요청으로 와요. 정답은 비워도 돼요.'],
          ['☑ 그리기도 함께 하는 문항', '단답형 · 서술형에서 그림도 그리게 해요(예: 반지름을 그어 보고 길이 쓰기).'],
          [<B c="primary">+ 답 유형 추가</B>, '한 문제에 답이 여러 부분(1)(2)일 때. 모든 부분이 맞아야 정답이에요. 부분마다 이 부분 삭제로 지워요.'],
        ]} />
        <h3>객관식 보기 편집</h3>
        <IconTable rows={[
          [<><B>①②③</B> <B>(1)(2)(3)</B> <B>㉮㉯㉰</B> <B>㉠㉡㉢</B></>, '보기 기호 모양을 바꿔요. 왼쪽/오른쪽, O / X, 직접 입력(가 / 참 / 사과처럼 직접 쓰기)도 있어요.'],
          [<><B>−</B> <b>5</b> <B>+</B></>, '보기 수를 줄이거나 늘려요. + 보기 추가도 같아요.'],
          [<><span className="key-toggle">정답</span> <span className="key-toggle on">✓ 정답</span></>, '누르면 그 보기가 정답(초록)이 돼요.'],
          [<B c="danger">✕</B>, '그 보기를 지워요.'],
          ['☑ 학생 화면 버튼에 보기 내용도 표시', '버튼에 기호와 보기 글을 함께 보여 줘요.'],
          ['☑ 여러 개 고르는 문제', '정답이 2개 이상이면 저절로 켜져요.'],
        ]} />
        <h3>다른 유형</h3>
        <ul>
          <li><b>단답형</b> — 정답 칸에 쓰고, 여러 답 인정은 <code>/</code>로 나눠요. <b>답 칸 수</b>를 2 이상으로 하면 첫째 칸 · 둘째 칸… 칸마다 정답을 쓰고, ☑ <b>순서가 달라도 정답으로 인정</b>을 고를 수 있어요.</li>
          <li><b>서술형</b> — 모범 답안과 핵심어(쉼표로 구분, 같은 뜻은 <code>증발|기화</code>)를 써요. <B>모범 답안에서 핵심어 다시 뽑기</B>로 자동으로 뽑을 수 있어요. ☑ <b>예시 답안</b>을 켜면 예시와 다른 답은 선생님 확인으로 와요.</li>
          <li><b>선 잇기</b> — 잇는 개수를 정하고 (1) → ①, (2) → ② 처럼 짝을 눌러요(초록이 정답).</li>
          <li><b>그리기</b> — 학생이 문제 그림 위에 그리고, 제출하면 선생님 확인으로 와요.</li>
        </ul>
      </Step>

      <Step id="t-save" no="7" title="저장하기">
        <ul>
          <li>맨 아래 <B c="primary">저장</B>을 누르면 문제지 이미지까지 저장하고 평가 화면으로 가요. 처음에는 <Badge c="draft">개시 전</Badge> 상태라 학생에게 아직 안 보여요.</li>
          <li>고칠 곳이 있으면 화면 가운데 <b>⚠️ 저장하지 못했어요</b> 창이 떠요. <b>“5번: 정답을 입력해 주세요. →”</b>처럼 번호가 있는 줄이나 <B>첫 번째 문항으로 가기</B>를 누르면 그 문항으로 이동해 반짝 표시해 줘요.</li>
          <li><B>← 다시 올리기</B>를 누르면 1단계로 돌아가요(올린 문제지와 인식 결과는 그대로).</li>
        </ul>
      </Step>

      <Step id="t-open" no="8" title="시험 개시 · 응시 마감">
        <p>평가 화면 오른쪽 위 버튼으로 시험 상태를 바꿔요. 지금 누를 수 없는 버튼은 흐리게 보여요.</p>
        <IconTable rows={[
          [<B c="ok">시험 개시</B>, <>학생 목록에 평가가 보이고 응시할 수 있어요. 상태 <Badge c="open">응시 중</Badge></>],
          [<B c="danger">응시 마감</B>, <>확인 창 뒤 마감. 학생 목록에서 빠지고, 제출한 학생은 결과만 볼 수 있어요. 상태 <Badge c="closed">마감</Badge></>],
          [<B c="ok">시험 다시 개시</B>, '마감한 평가를 다시 열어요.'],
        ]} />
      </Step>

      <Step id="t-list" no="9" title="내 단원평가 목록">
        <p>로그인하면 처음 보이는 화면이에요. 위쪽에 <B>👥 학생 명단 추가·수정</B> <B c="primary">+ 새 평가 만들기</B> <B>📥 공유 시험지 가져오기</B> 버튼이 있고, 아래 표의 열은 이렇게 읽어요.</p>
        <IconTable rows={[
          ['평가', '제목을 누르면 평가 화면으로 가요. 아래 작은 글은 단원(가져온 시험지면 “공유 시험지(누구)”).'],
          ['과목 · 대상', '과목과 학년 · 학기 · 응시할 반'],
          [<><Badge c="draft">개시 전</Badge> <Badge c="open">응시 중</Badge> <Badge c="closed">마감</Badge></>, '상태'],
          ['응시 · 평균', '제출한 학생 수와 100점 기준 평균 (실시간으로 바뀌어요)'],
          [<Badge c="review">3건</Badge>, '검토 요청 수. 누르면 바로 검토 요청 탭으로 가요.'],
          [<><B>공유</B> <B c="shared-on">✓ 공유 중</B></>, '시험지 공유 켜기 / 끄기 (15번 설명)'],
          [<B c="danger">삭제</B>, '두 번 확인한 뒤 평가와 학생 답안을 모두 지워요. 되돌릴 수 없어요.'],
        ]} />
      </Step>

      <Step id="t-results" no="10" title="평가 화면 · 결과 탭">
        <p>평가 제목을 누르면 평가 화면이 열려요. 위쪽에 <b>응시 · 평균(100점) · 문항 · 검토 요청</b> 숫자 상자와, <b>결과 · 검토 요청 · 문항 분석 · 문항·정답 수정 · 설정</b> 탭이 있어요.</p>
        <p><b>결과</b> 탭 표에는 반 · 번 · 이름 · 점수 · 오답 재응시 · 결과지와 문항별 채점 표시가 나와요.</p>
        <IconTable rows={[
          [<><M s="correct" /> <M s="wrong" /> <M s="review" /></>, '정답 / 오답 / 확인 필요. 마우스를 올리면 학생 답과 채점 이유가 보여요.'],
          [<M s="correct" over />, <>누를 때마다 <b>자동 → 정답 → 오답 → 자동</b>으로 판정이 바뀌어요. 테두리가 있으면 선생님이 직접 판정한 것이에요.</>],
          [<B>📄 보기</B>, '그 학생의 채점된 시험지를 크게 열어요.'],
        ]} />
        <h3>학생 상세 창</h3>
        <ul>
          <li><B>채점된 시험지 보기</B> ↔ <B>표로 보기</B>로 바꿔 볼 수 있어요. 시험지에는 빨간 동그라미(정답) · 빨간 빗금(오답) · 노란 형광(확인 필요)과 함께 학생 답(파란 글씨), 정답(빨간 글씨)이 보여요.</li>
          <li>표에서는 문항마다 <B>O</B> <B>X</B> 로 판정하고, 직접 판정했던 것은 <B>자동</B>으로 되돌려요.</li>
          <li><B>닫기</B> 또는 바깥을 누르면 닫혀요.</li>
        </ul>
        <Tip>학생이 제출하면 새로고침하지 않아도 표에 바로 들어와요.</Tip>
      </Step>

      <Step id="t-review" no="11" title="검토 요청 탭">
        <p>자동 채점으로 판단하기 어려운 답이 모여요(철자가 비슷함, 정답과 일부만 일치, 단위가 다름, 그린 그림, 선생님이 직접 채점하는 문항 등). 탭 이름 옆 괄호에 개수가 보여요.</p>
        <ul>
          <li>왼쪽에 문제(지문이 있으면 <b>지문 보기 ▸</b>를 눌러 펼침)와 학생이 그린 그림, 오른쪽에 <b>학생 답</b>과 <b>정답</b>이 나와요.</li>
          <li><B c="ok">정답 인정</B> 또는 <B c="bad">오답 처리</B>를 누르면 학생 점수에 바로 반영되고 목록에서 빠져요.</li>
          <li>오답 재응시에서 다시 푼 답은 <Badge c="review">1차 오답 재응시</Badge> 표시와 함께 위쪽에 따로 나와요. 정답 인정하면 그 문제는 다 맞힌 것으로, 오답 처리하면 학생이 다시 풀게 돼요(처음 점수는 그대로).</li>
          <li>다 확인하면 “검토할 답안이 없습니다. 👍”가 나와요.</li>
        </ul>
      </Step>

      <Step id="t-retake" no="12" title="오답 재응시 · 전체 재응시">
        <IconTable rows={[
          [<B c="primary">오답만 재응시</B>, '결과 표 오른쪽 끝. 그 학생이 틀린 문제만 맞힐 때까지 다시 풀게 해요. 점수는 처음 제출한 점수 그대로예요. 켜면 오답 재응시 끄기로 바뀌어요.'],
          [<B>전체 학생 오답만 재응시 (12명)</B>, '틀린 문제가 있는 학생 모두에게 한 번에 켜요.'],
          [<B c="danger">전체 재응시</B>, '그 학생의 응시 기록을 모두 지워 처음부터 다시 보게 해요(점수도 새로 매겨져요).'],
        ]} />
        <p>결과 표의 <b>오답 재응시</b> 열은 진행 상황을 보여 줘요.</p>
        <IconTable rows={[
          [<Badge c="review">남은 2문제 · 1회</Badge>, '아직 못 맞힌 문제 수와 다시 푼 횟수'],
          [<Badge c="review">확인 필요 1</Badge>, '다시 푼 답을 선생님이 검토 요청 탭에서 확인해야 해요.'],
          [<Badge c="open">완료 · 2회</Badge>, '틀린 문제를 모두 맞혔어요.'],
          ['-', '오답 재응시가 꺼져 있어요.'],
        ]} />
      </Step>

      <Step id="t-analysis" no="13" title="문항 분석 · 엑셀 내려받기">
        <ul>
          <li><b>문항 분석</b> 탭: 문항마다 유형 · 정답 · 정답률 막대(50% 미만은 빨강, 이상은 초록)와 검토 대기 수를 보여 줘요.</li>
          <li><B c="primary">결과받기(엑셀)</B>(오른쪽 위): 제출한 학생이 있을 때 눌러요. 엑셀에 <b>성적</b>(점수 · 득점 · 맞은 개수 · 등수 · 제출 시각 · 문항별 O/X), <b>답안</b>(학생이 쓴 답), <b>문항분석</b>(정답 수 · 오답 수 · 정답률) 시트가 들어 있어요.</li>
        </ul>
      </Step>

      <Step id="t-fix" no="14" title="문항·정답 수정 탭 · 설정 탭">
        <h3>문항·정답 수정</h3>
        <ul>
          <li>만들 때와 같은 화면에서 정답 · 배점 · 유형을 고치고 맨 아래 <B c="primary">문항·정답 저장</B>을 눌러요. 저장되면 옆에 <span className="save-ok">✓ 저장했어요</span>가 보여요.</li>
          <li>고칠 곳이 있으면 <B c="danger">⚠️ 고칠 곳 3개 보기</B>가 생겨요.</li>
          <li>이미 응시한 학생이 있어도 괜찮아요. 저장하면 <b>모든 학생이 새 정답으로 다시 채점</b>되고, 시험을 보는 중인 학생 화면에는 “선생님이 ○번 문제를 고쳤어요” 알림이 떠요.</li>
        </ul>
        <h3>설정</h3>
        <ul>
          <li>과목 · 학년 · 학기 · 단원 · 제목 · 응시할 반 · 채점 기준을 고치고 <B c="primary">설정 저장</B>.</li>
          <li><b>문제지 이미지 고화질로 바꾸기</b> — 문제가 흐리게 보이면 <b>같은 문제지 PDF</b>(쪽수가 같아야 함)를 📂 칸에 올려요. 문항 · 정답 · 응시 기록은 그대로예요.</li>
          <li><b>평가 삭제</b> — <B c="danger">삭제</B>. 필요하면 먼저 엑셀로 내려받으세요.</li>
        </ul>
      </Step>

      <Step id="t-share" no="15" title="시험지 공유 · 공유 시험지 가져오기">
        <h3>내 시험지 공유하기</h3>
        <p>목록 표의 <B>공유</B>를 누르고 확인하면 <B c="shared-on">✓ 공유 중</B>이 돼요. 모든 학교 선생님이 문항 · 정답 · 문제지를 가져갈 수 있어요(학생 답안은 공유되지 않아요). 다시 누르면 공유를 그만둬요. 다른 선생님에게서 가져온 시험지는 다시 공유할 수 없어요(버튼이 흐림).</p>
        <h3>다른 선생님 시험지 가져오기</h3>
        <ol>
          <li><B>📥 공유 시험지 가져오기</B>를 눌러요.</li>
          <li>찾기 칸에 과목 · 단원 · 제목 · 학년 등을 써서 찾아요(여러 낱말은 띄어 쓰기).</li>
          <li><B c="primary">가져오기</B>를 누르면 내 평가로 복사되고 <Badge c="draft">개시 전</Badge> 상태로 평가 화면이 열려요. 내용을 확인한 뒤 <B c="ok">시험 개시</B>를 누르세요.</li>
        </ol>
      </Step>

      <Step id="t-alert" no="16" title="실시간 알림 · 바탕화면 알림">
        <ul>
          <li>선생님 화면 어디에 있든 학생이 제출하거나 오답 재응시 답을 내면 화면 위에 <span className="toast success guide-mini">🔔 3반 5번 홍길동 학생이 제출했어요. <B>보기</B> <B>확인</B></span> 알림이 떠요. <B>보기</B>를 누르면 그 평가(확인할 답이 있으면 검토 요청 탭)로 가요.</li>
          <li>창을 내려 두거나 다른 프로그램을 쓰는 동안에도 알림을 받으려면 위쪽 <B>🔕 바탕화면 알림 켜기</B>를 눌러 켜 두세요(<B c="alerts-on">🔔 알림 켜짐</B>).</li>
        </ul>
        <Warn>알림이 차단되어 있으면 주소창 왼쪽 <b>자물쇠(사이트 정보) 아이콘 → 알림 → “허용”</b>으로 바꾼 뒤 다시 눌러 주세요.</Warn>
      </Step>

      <Step id="t-admin" no="17" title="관리자 기능">
        <p>교사 로그인 탭 아래 <b>관리자 로그인 →</b>을 눌러 관리자 비밀번호로 로그인해요(☑ 로그인 상태 유지). 처음 화면은 <b>선생님 관리</b>예요.</p>
        <ul>
          <li><b>선생님 추가</b> — 학교 · 학년 · 반 · 이름(선택)을 쓰고 <B c="primary">+ 선생님 추가</B>. 처음 비밀번호는 <code>{DEFAULT_TEACHER_PASSWORD}</code>이에요.</li>
          <li><b>비밀번호</b> — <B>••••</B>를 누르면 비밀번호가 보이고, <B>변경</B>으로 새 비밀번호를 정해 <B c="primary">저장</B>해요.</li>
          <li><B c="primary">방 들어가기</B> — 그 선생님 화면을 대신 볼 수 있어요. 들어가 있는 동안 위에 <span className="view-banner guide-mini">🔑 관리자로 ○○ 선생님 방을 보고 있습니다. <B>관리자 화면으로</B></span> 줄이 보여요.</li>
          <li><B>수정</B> · <B c="danger">삭제</B> — 선생님 정보를 고치거나 계정을 지워요(그 선생님의 평가와 학생 명단은 남아요).</li>
          <li><b>예전 평가·명단 옮기기</b> — 관리자 계정으로 만든 예전 자료가 있으면 나타나요. 옮길 선생님(학교 · 학년 · 반)을 쓰고 <B c="primary">이 선생님 방으로 옮기기</B>.</li>
        </ul>
      </Step>

      <Step id="t-icons" no="18" title="아이콘 · 버튼 한눈에 보기">
        <IconTable rows={[
          ['🧑‍🏫', '첫 화면 교사 로그인 그림'],
          ['📝', '맨 위 로고 — 누르면 내 단원평가 목록'],
          ['📖', '사용설명서 (지금 보는 화면)'],
          ['🔕 / 🔔', '바탕화면 알림 꺼짐 / 켜짐 · 🔔 는 화면 위 실시간 알림에도 쓰여요'],
          ['👥', '학생 명단 추가·수정'],
          ['+', '새 평가 만들기 · 학생 추가 · 보기 추가 · 답 유형 추가 · 선생님 추가'],
          ['📥', '공유 시험지 가져오기'],
          ['📂', '파일을 끌어다 놓거나 눌러서 고르는 칸 (PDF · 엑셀)'],
          [<span className="spinner" />, '처리하는 중이에요. 잠시 기다려요.'],
          ['✔ / ✓', '완료 · 켜짐 · 정답 표시 (✔ 분석 완료, ✓ 정답, ✓ 공유 중, ✓ 저장했어요)'],
          ['⚠ / ⚠️', '정답이 없거나 고칠 곳이 있어요'],
          ['🔄', '답안 유형 다시 인식하기'],
          ['▾ / ▴', '세부 수정 열기 / 닫기'],
          ['− / + / ✕', '보기 수 줄이기 / 늘리기 / 보기 삭제'],
          ['① ②', '정답 넣기 순서 (양식 받기 → 올리기)'],
          ['📄', '학생 결과지 보기'],
          [<><M s="correct" /> <M s="wrong" /> <M s="review" /> <M s="correct" over /></>, '정답 / 오답 / 확인 필요 / 선생님이 직접 판정'],
          [<><PaperMark kind="correct" /><PaperMark kind="wrong" /><PaperMark kind="review" /></>, '채점된 시험지: 빨간 동그라미 정답 · 빨간 빗금 오답 · 노란 형광 확인 필요'],
          ['👍', '검토할 답안이 없어요'],
          ['🔑', '관리자가 선생님 방을 보고 있어요'],
          ['→ / ←', '그 화면으로 이동 · 앞 화면으로'],
        ]} />
      </Step>

      <Step id="t-faq" no="19" title="이럴 땐 이렇게 (자주 묻는 질문)">
        <dl className="guide-faq">
          <dt>학생이 로그인을 못 해요.</dt>
          <dd>👥 학생 명단에 그 학생이 있는지, 이름이 똑같은지 확인하세요. 학생은 선생님 계정의 학교 이름과 같은 학교 이름을 써야 해요.</dd>
          <dt>학생 목록에 평가가 안 보여요.</dt>
          <dd>평가 상태가 <Badge c="open">응시 중</Badge>인지(시험 개시를 눌렀는지), 설정의 학년 · 응시할 반이 맞는지 확인하세요.</dd>
          <dt>문항이 잘못 잘렸거나 유형이 틀렸어요.</dt>
          <dd>세부 수정 ▾ → 🔄 답안 유형 다시 인식하기를 눌러 보고, 그래도 다르면 유형 · 보기 · 정답을 직접 고치세요.</dd>
          <dt>시험 중에 정답이 틀린 걸 알았어요.</dt>
          <dd>문항·정답 수정 탭에서 고쳐 저장하면 이미 제출한 학생까지 모두 다시 채점돼요.</dd>
          <dt>학생이 실수로 제출했어요.</dt>
          <dd>결과 탭에서 그 학생의 <B c="danger">전체 재응시</B>를 누르면 처음부터 다시 볼 수 있어요.</dd>
          <dt>비밀번호를 잊었어요.</dt>
          <dd>관리자에게 비밀번호 변경을 부탁하세요.</dd>
          <dt>“Firebase 보안 규칙…” 오류가 나와요.</dt>
          <dd>관리자에게 알려 주세요. 서버 규칙을 새로 게시해야 하는 경우예요.</dd>
        </dl>
      </Step>
    </>
  );
}

/** 사용설명서 화면 */
export default function Guide() {
  const nav = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const who = params.get('who') === 'teacher' ? 'teacher' : 'student';

  return (
    <>
      <TopBar>
        <button type="button" className="btn sm" onClick={() => goBackTo(nav, location, '/')}>로그인 화면으로</button>
      </TopBar>
      <div className="container guide">
        <div className="home-hero">
          <div className="emoji">📖</div>
          <h1>사용설명서</h1>
          <p className="muted">처음 쓰는 분도 순서대로 따라 하면 돼요. 아래에서 학생용 · 교사용을 골라 보세요.</p>
        </div>
        <div className="login-tabs guide-tabs" role="tablist">
          {WHO.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={who === k}
              className={who === k ? 'active' : ''}
              onClick={() => {
                setParams(k === 'teacher' ? { who: 'teacher' } : {}, { replace: true, state: location.state });
                window.scrollTo({ top: 0 });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {who === 'teacher' ? <TeacherGuide /> : <StudentGuide />}
        <div className="center-text" style={{ marginTop: 24 }}>
          <button type="button" className="btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ 맨 위로</button>{' '}
          <button type="button" className="btn primary" onClick={() => goBackTo(nav, location, '/')}>로그인 화면으로</button>
        </div>
      </div>
    </>
  );
}
