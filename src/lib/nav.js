// 브라우저 뒤로가기가 자연스럽게 되도록 하는 이동 도우미
//  - 앞으로 갈 때 state.back 에 "돌아올 곳"을 적어 둔다
//  - [목록] 같은 버튼은 바로 그곳에서 왔으면 기록을 하나 되돌리고(nav(-1)), 아니면 그곳으로 이동
//    → 목록 ↔ 평가를 오가도 기록이 쌓이지 않아 뒤로가기가 꼬이지 않는다

/** 앞으로 이동할 때 Link/nav 에 넣을 state */
export function backState(location) {
  return { back: location.pathname + location.search };
}

/** [목록] 등: path 에서 왔으면 뒤로, 아니면 path 로 이동 */
export function goBackTo(nav, location, path) {
  const from = location.state?.back;
  if (from && (from === path || from.split('?')[0] === path) && (window.history.state?.idx ?? 0) > 0) nav(-1);
  else nav(path);
}
