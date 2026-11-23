import { formatTime, parseTime } from './time';

describe('parseTime', () => {
  it('parses 24-hour times with or without a leading zero', () => {
    expect(parseTime('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTime('8:05')).toEqual({ hour: 8, minute: 5 });
    expect(parseTime(' 23:59 ')).toEqual({ hour: 23, minute: 59 });
    expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('rejects out-of-range and malformed input', () => {
    for (const bad of ['', '24:00', '12:60', '1230', '12:5', 'ab:cd', '-1:30', '12:30pm']) {
      expect(parseTime(bad)).toBeNull();
    }
  });
});

describe('formatTime', () => {
  it('zero pads', () => {
    expect(formatTime({ hour: 7, minute: 5 })).toBe('07:05');
  });
});
