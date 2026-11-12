// 그리기 문항 화면이 그려지는지 (그리기 판에서 오류가 나면 학생 화면 전체가 하얗게 된다)
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DrawLayer, DrawToolbar } from '../src/components/Drawing.jsx';

describe('그리기 문항', () => {
  it('그리기 판과 도구 막대가 오류 없이 그려진다', () => {
    const strokes = [{ t: 'pen', p: [1, 2, 30, 40] }, { t: 'dot', p: [5, 5] }, { t: 'circle', p: [100, 100, 20] }];
    const html = renderToString(createElement(DrawLayer, { ratio: 0.6, strokes, onChange: () => {}, ruler: { show: true, x: 0, y: 0, a: 0 }, ppc: 40 }));
    expect(html).toContain('draw-layer');
    expect(html).toContain('polyline');
    const bar = renderToString(createElement(DrawToolbar, { tool: 'pen', setTool: () => {}, ruler: {}, setRuler: () => {}, onUndo: () => {}, onClear: () => {}, canUndo: true }));
    expect(bar).toContain('되돌리기');
  });
});
