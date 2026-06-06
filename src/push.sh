#!/bin/bash
set -e

GITHUB_USERNAME=hlocuwu
export GITHUB_USERNAME

# Yêu cầu GitHub Token để đăng nhập vào ghcr.io
if [ -z "$GITHUB_TOKEN" ]; then
  echo "🔑 Nhập GitHub Personal Access Token (cần quyền write:packages):"
  read -s GITHUB_TOKEN
fi

echo ""
echo "🔐 Đang đăng nhập vào ghcr.io..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

echo ""
echo "🔨 Đang build tất cả images..."
docker compose build

echo ""
echo "📤 Đang push lên ghcr.io/$GITHUB_USERNAME/..."
docker compose push

echo ""
echo "✅ Hoàn thành! Các images đã được push lên:"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-inventory:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-waitingroom:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-booking:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-event:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-notification:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-auth:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-payment:latest"
echo "   ghcr.io/$GITHUB_USERNAME/ticket-booking-frontend:latest"
