/**
 * 生成 9 位随机数字会议号
 * 范围：100000000 ~ 999999999
 */
export function generateMeetingNumber(): string {
  const num = Math.floor(Math.random() * 900000000) + 100000000;
  return String(num);
}
