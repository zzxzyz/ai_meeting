#!/bin/bash

# 生成自签名 SSL 证书 (用于开发/测试)
# 生产环境建议使用 Let's Encrypt 或购买正式证书

echo "正在生成自签名 SSL 证书..."

# 设置证书信息
COUNTRY="CN"
STATE="Beijing"
CITY="Beijing"
ORGANIZATION="AI Meeting"
ORGANIZATIONAL_UNIT="IT"
COMMON_NAME="your-server-ip"  # 修改为您的服务器 IP 或域名
EMAIL="admin@example.com"

# 生成私钥
openssl genrsa -out key.pem 2048

# 生成证书签名请求
openssl req -new -key key.pem -out csr.pem \
  -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/OU=$ORGANIZATIONAL_UNIT/CN=$COMMON_NAME/emailAddress=$EMAIL"

# 生成自签名证书 (有效期 365 天)
openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem

# 清理临时文件
rm csr.pem

echo "✓ SSL 证书生成完成!"
echo "  - 私钥: key.pem"
echo "  - 证书: cert.pem"
echo ""
echo "⚠️  注意: 这是自签名证书，浏览器会显示不安全警告"
echo "   生产环境建议使用 Let's Encrypt 或购买正式证书"
