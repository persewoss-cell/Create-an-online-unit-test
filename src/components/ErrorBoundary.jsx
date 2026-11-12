import { Component } from 'react';

/** 화면을 그리다 오류가 나도 하얀 화면 대신 안내와 "다시 열기" 버튼을 보여 준다 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('화면 오류', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="container narrow" style={{ paddingTop: 60 }}>
        <div className="card stack" role="alert" style={{ textAlign: 'center' }}>
          <h2>화면을 여는 중에 문제가 생겼어요</h2>
          <p className="muted" style={{ margin: 0 }}>
            <b>다시 열기</b>를 눌러 주세요. 그래도 안 되면 선생님께 이 화면을 보여 주세요.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary lg" onClick={() => window.location.reload()}>다시 열기</button>
            <button className="btn lg" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>첫 화면으로</button>
          </div>
          <div className="small muted" style={{ wordBreak: 'break-all' }}>오류 내용: {String(error?.message || error)}</div>
        </div>
      </div>
    );
  }
}
