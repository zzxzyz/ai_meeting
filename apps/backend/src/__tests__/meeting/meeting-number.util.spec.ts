import { generateMeetingNumber } from '@/common/utils/meeting-number.util';

describe('generateMeetingNumber', () => {
  it('应该生成 9 位数字字符串', () => {
    const result = generateMeetingNumber();
    expect(result).toMatch(/^\d{9}$/);
  });

  it('生成的会议号长度应为 9', () => {
    const result = generateMeetingNumber();
    expect(result.length).toBe(9);
  });

  it('生成的会议号应在 100000000 ~ 999999999 范围内', () => {
    const result = generateMeetingNumber();
    const num = parseInt(result, 10);
    expect(num).toBeGreaterThanOrEqual(100000000);
    expect(num).toBeLessThanOrEqual(999999999);
  });

  it('多次生成应有随机性（极小概率全部相同）', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generateMeetingNumber());
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('生成的值应该是字符串类型', () => {
    const result = generateMeetingNumber();
    expect(typeof result).toBe('string');
  });
});
