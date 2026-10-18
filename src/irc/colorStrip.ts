/*
 * pIRC - Cliente de IRC.
 * Copyright (C) 2026 - Ademir Constantino
 * Licensed under the GNU General Public License, version 2 or later.
 */

/**
 * Strip common mIRC colors. Port of ColorStrip.java
 * @author João Pedrosa
 */

/* color (^C fg,bg), bold, reverse, underline, italic, strike, reset and CTCP */
const RE_COLOR = /\u0003(\d{1,2}(,\d{1,2})?)?|[\u0002\u0016\u001f\u001d\u001e\u000f\u0001]/g;

/**
 * Strip common mIRC colors/styles
 * @param s Styled string
 * @return a new string without colors
 */
export function stripColor(s: string): string {
  return s.replace(RE_COLOR, '');
}
