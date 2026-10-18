import { describe, expect, it } from 'vitest';
import { stripColor } from './colorStrip';
import {
  addNick,
  containsNick,
  indexOfNick,
  organizeByStatus,
  removeNick,
  stripStatus,
  updateNick,
} from './nickList';

/* port of NickNameListTest.java */
describe('nickList', () => {
  it('organizes operators, then voices, then users keeping the order', () => {
    expect(organizeByStatus(['zeca', '+voz', '@op2', 'ana', '@op1', '+voz2'])).toEqual([
      '@op2',
      '@op1',
      '+voz',
      '+voz2',
      'zeca',
      'ana',
    ]);
  });

  it('finds nicknames ignoring status and case', () => {
    const list = ['@Op', '+Voz', 'user'];
    expect(containsNick(list, 'op')).toBe(true);
    expect(containsNick(list, '@VOZ')).toBe(true);
    expect(indexOfNick(list, 'USER')).toBe(2);
    expect(containsNick(list, 'other')).toBe(false);
  });

  it('update keeps the status', () => {
    expect(updateNick(['@old', 'user'], 'old', 'new')).toEqual(['@new', 'user']);
  });

  it('update of an unknown nickname does nothing', () => {
    expect(updateNick(['user'], 'other', 'new')).toEqual(['user']);
  });

  it('removes ignoring status', () => {
    expect(removeNick(['@op', 'user'], 'op')).toEqual(['user']);
  });

  it('adds a nickname once', () => {
    expect(addNick(['@op'], 'user')).toEqual(['@op', 'user']);
    expect(addNick(['@op', 'user'], 'USER')).toEqual(['@op', 'user']);
  });

  it('strips status', () => {
    expect(stripStatus('@op')).toBe('op');
    expect(stripStatus('+voz')).toBe('voz');
    expect(stripStatus('user')).toBe('user');
  });
});

/* port of ColorStripTest.java */
describe('stripColor', () => {
  it('removes colors and styles', () => {
    expect(stripColor('\u000304,01red\u0003 \u0002bold\u0002 \u001funder\u000f')).toBe('red bold under');
    expect(stripColor('\u00033green \u001ditalic\u001d \u0016rev')).toBe('green italic rev');
    expect(stripColor('\u0001ACTION waves\u0001')).toBe('ACTION waves');
    expect(stripColor('plain text')).toBe('plain text');
  });
});
