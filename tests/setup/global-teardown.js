/**
 * 全局测试清理
 * 在所有测试结束后执行一次
 */

module.exports = async () => {
  console.log('\n🧹 清理测试环境...\n');

  // 清理数据库连接
  // 清理 Redis 连接
  // 其他清理工作

  console.log('✅ 测试环境清理完成\n');
};
