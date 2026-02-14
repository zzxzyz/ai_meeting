/**
 * 全局测试设置
 * 在所有测试开始前执行一次
 */

module.exports = async () => {
  console.log('\n🚀 开始测试环境初始化...\n');

  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5433/open_meeting_test';
  process.env.REDIS_URL = 'redis://localhost:6380';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';

  // 等待 Docker 服务就绪
  await waitForServices();

  console.log('✅ 测试环境初始化完成\n');
};

async function waitForServices() {
  const maxRetries = 30;
  const retryDelay = 1000;

  console.log('⏳ 等待 Docker 服务启动...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      // 检查 PostgreSQL
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      // 检查 Redis
      const redis = require('redis');
      const redisClient = redis.createClient({
        url: process.env.REDIS_URL,
      });
      await redisClient.connect();
      await redisClient.ping();
      await redisClient.quit();

      console.log('✅ 所有服务已就绪');
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error('等待服务超时,请确保 Docker Compose 已启动: docker-compose -f docker-compose.test.yml up -d');
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}
