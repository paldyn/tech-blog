---
title: "Docker로 셀프 호스팅 — Next.js를 직접 배포하는 방법"
description: "Next.js standalone 출력 모드와 Docker 멀티스테이지 빌드를 결합해 ~120MB 경량 이미지를 만들고, Nginx 리버스 프록시로 프로덕션 서버를 구성하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 62
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "Docker", "셀프호스팅", "standalone", "Nginx", "docker-compose", "배포"]
featured: false
draft: false
---

[지난 글](/posts/next-deployment-vercel/)에서 Vercel로 간편하게 배포하는 방법을 살펴봤다. Vercel은 편리하지만 벤더 종속성이 생기고 트래픽이 많아지면 비용이 높아진다. 인프라를 직접 제어해야 하거나 사내 서버·클라우드 VM에 배포해야 한다면 **Docker 셀프 호스팅**이 답이다.

## standalone 출력 모드

Docker 이미지 크기를 줄이는 핵심은 `output: 'standalone'`이다. 이 설정을 켜면 Next.js가 `.next/standalone` 폴더에 실행에 필요한 파일만 추출한다. `node_modules` 전체를 복사하지 않아도 된다.

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

## Docker 멀티스테이지 빌드

![Docker 멀티스테이지 빌드 흐름](/assets/posts/next-self-hosting-docker-build.svg)

세 스테이지로 나누면 최종 이미지에 빌드 도구가 포함되지 않는다.

```dockerfile
# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: 최소 실행 이미지
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# non-root 사용자로 실행 (보안)
RUN addgroup --system nodejs && adduser --system nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

`npm ci`는 `package-lock.json`을 그대로 사용해 재현 가능한 설치를 보장한다. CI 환경에서는 반드시 `npm install` 대신 `npm ci`를 쓴다.

## docker-compose + Nginx

![셀프 호스팅 배포 아키텍처](/assets/posts/next-self-hosting-docker-arch.svg)

Nginx가 TLS 종료와 리버스 프록시를 담당하고, Next.js 컨테이너는 순수 HTTP로 3000 포트만 열어둔다.

```yaml
# docker-compose.yml
services:
  app:
    build: .
    image: my-nextjs-app:latest
    ports:
      - "3000:3000"
    env_file: .env.production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    restart: unless-stopped
```

```nginx
# nginx.conf 핵심 부분
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

## 빌드 및 실행

```bash
# 이미지 빌드
docker build -t my-nextjs-app:latest .

# 빌드 결과 확인 (크기 비교)
docker images my-nextjs-app

# 컨테이너 스택 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f app
```

## 환경 변수 관리

`.env.production` 파일은 절대 Git에 커밋하지 않는다. `.gitignore`에 추가하고, 배포 시 서버에서 직접 생성하거나 Secret Manager를 사용한다.

```bash
# .env.production 예시
DATABASE_URL=postgresql://user:pass@db:5432/mydb
NEXTAUTH_SECRET=super-secret-value
NEXTAUTH_URL=https://example.com
NEXT_PUBLIC_API_URL=https://api.example.com
```

## 헬스 체크 추가

컨테이너 오케스트레이터(Kubernetes, ECS)가 앱 상태를 알 수 있도록 헬스 체크 엔드포인트를 만든다.

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

```dockerfile
# Dockerfile에 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

## Vercel vs 셀프 호스팅 비교

| 항목 | Vercel | 셀프 호스팅 |
|------|--------|------------|
| ISR | 완전 지원 | revalidatePath만 (파일 캐시) |
| Edge Functions | 글로벌 엣지 | 단일 서버 |
| 초기 설정 비용 | 낮음 | 높음 |
| 운영 비용 | 트래픽 기반 | 서버 고정비 |
| 인프라 제어 | 제한적 | 완전 제어 |

---

**지난 글:** [Vercel 배포 — Next.js 앱을 프로덕션에 올리는 최선의 방법](/posts/next-deployment-vercel/)

**다음 글:** [프로덕션 ISR — 점진적 정적 재생성 실전 패턴](/posts/next-production-isr/)

<br>
읽어주셔서 감사합니다. 😊
