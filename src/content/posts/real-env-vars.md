---
title: "환경 변수 실전 — Node.js와 브라우저에서 설정 관리하기"
description: "dotenv부터 Node 20의 --env-file, Vite의 import.meta.env까지 환경 변수 로딩 메커니즘을 설명하고, 검증·기본값·타입 변환을 포함한 설정 모듈 패턴을 실용 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "환경변수", "dotenv", "Node.js", "Vite", "설정관리", "보안", "실전"]
featured: false
draft: false
---

[지난 글](/posts/pattern-mediator-mixin/)에서 미디에이터·믹스인 패턴으로 컴포넌트를 조율하고 기능을 합성하는 방법을 살펴봤습니다. 이번부터는 **실전(Real-world)** 주제를 다룹니다. 첫 번째는 **환경 변수**입니다. 데이터베이스 URL·API 키·포트 번호처럼 배포 환경마다 달라지는 설정을 코드에 하드코딩하지 않고, 안전하게 주입하고 사용하는 방법을 정리합니다.

![환경 변수 공급 체계](/assets/posts/real-env-vars-overview.svg)

## 왜 환경 변수인가

- **보안**: DB 비밀번호·API 키를 소스코드에 넣으면 git 히스토리에 영구히 남습니다.
- **이식성**: 개발(localhost)·스테이징·프로덕션 환경에서 동일한 코드를 실행할 수 있습니다.
- **12-Factor App**: 설정을 환경에서 분리하는 것은 클라우드 네이티브 앱의 핵심 원칙입니다.

---

## Node.js에서 환경 변수 로딩

### 1. dotenv — 가장 널리 사용되는 방법

```bash
npm install dotenv
```

```javascript
// 진입점(index.js, server.js)의 최상단에서 로드
import 'dotenv/config'; // ESM
// 또는
require('dotenv').config(); // CJS

console.log(process.env.DATABASE_URL); // .env에서 읽은 값
```

`.env` 파일:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
PORT=3000
NODE_ENV=development
```

`.env`는 반드시 `.gitignore`에 추가합니다. 공개 저장소에 커밋하면 비밀 정보가 노출됩니다.

### 2. Node 20.6+ — 라이브러리 없이 `--env-file`

Node.js 20.6부터 dotenv 없이 `.env`를 로드할 수 있습니다.

```bash
node --env-file=.env server.js
# 여러 파일 (뒤가 우선)
node --env-file=.env --env-file=.env.local server.js
```

패키지에 의존성을 추가하지 않아도 됩니다.

### 3. dotenvx — 암호화·다중 환경 지원

```bash
npm install @dotenvx/dotenvx
```

```bash
# .env 파일의 민감한 값만 암호화
dotenvx encrypt -f .env
# 개발 환경 실행
dotenvx run -- node server.js
```

암호화된 `.env.vault` 파일은 git에 커밋해도 안전합니다.

---

## 브라우저(Vite)에서 환경 변수

브라우저 번들에는 `process.env`가 없습니다. Vite는 **빌드 타임에** `.env` 파일을 읽어 `import.meta.env`로 치환합니다.

```
# Vite .env 파일
VITE_API_BASE=https://api.example.com
VITE_APP_VERSION=1.0.0
# VITE_ 접두사 없는 변수는 번들에 포함되지 않음
SECRET_DB=postgresql://...  ← 클라이언트에 노출 안 됨
```

```javascript
// 브라우저 코드
const apiBase = import.meta.env.VITE_API_BASE;
const isDev   = import.meta.env.DEV;     // Vite 기본 제공
const isProd  = import.meta.env.PROD;

fetch(`${apiBase}/users`);
```

**중요**: `VITE_` 접두사가 붙은 변수는 번들에 포함되어 **누구나 볼 수 있습니다**. 데이터베이스 비밀번호·내부 API 키처럼 민감한 값은 절대 `VITE_` 접두사를 붙이지 마세요.

Next.js에서는 `NEXT_PUBLIC_` 접두사가 같은 역할을 합니다.

---

## 설정 모듈 패턴 — 검증과 타입 변환

![설정 모듈 코드 예시](/assets/posts/real-env-vars-code.svg)

환경 변수는 모두 **문자열**입니다. 앱에서 직접 `process.env.PORT`를 읽으면 타입 변환·기본값·검증이 코드 곳곳에 흩어집니다. 대신 진입점에서 **한 번**만 읽고 검증·변환해 내보내는 설정 모듈을 만드세요.

```javascript
// src/config/env.js
import { z } from 'zod'; // 검증 라이브러리 (선택)

const schema = z.object({
  NODE_ENV:     z.enum(['development', 'test', 'production']).default('development'),
  PORT:         z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET:   z.string().min(32),
  LOG_LEVEL:    z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('환경 변수 설정 오류:');
  result.error.issues.forEach(i => {
    console.error(`  ${i.path.join('.')}: ${i.message}`);
  });
  process.exit(1);
}

export const config = result.data;
```

```javascript
// 사용처 — process.env를 직접 읽지 않음
import { config } from './config/env.js';

const server = createServer({ port: config.PORT });
const db     = createDbConnection(config.DATABASE_URL);
```

zod 없이도 간단하게 구현할 수 있습니다.

```javascript
// 경량 버전
function requireEnv(key, defaultVal) {
  const val = process.env[key] ?? defaultVal;
  if (val === undefined) throw new Error(`필수 환경 변수 누락: ${key}`);
  return val;
}

export const config = {
  port:     Number(requireEnv('PORT', '3000')),
  dbUrl:    requireEnv('DATABASE_URL'),
  isDev:    process.env.NODE_ENV !== 'production',
  logLevel: requireEnv('LOG_LEVEL', 'info'),
};
```

앱이 시작할 때 즉시 실패(Fail Fast)하므로, 누락된 환경 변수를 프로덕션에 배포한 뒤에야 발견하는 상황을 방지합니다.

---

## .env 파일 계층 구조

dotenv와 Vite 모두 여러 `.env` 파일을 지원하며, 우선순위가 있습니다.

| 파일 | 용도 | git 커밋 |
|---|---|---|
| `.env` | 모든 환경 공통 기본값 | ✓ (민감 정보 금지) |
| `.env.local` | 로컬 개발용 오버라이드 | ✗ |
| `.env.development` | 개발 환경 전용 | ✓ |
| `.env.production` | 프로덕션 전용 | ✓ (민감 정보 금지) |
| `.env.test` | 테스트 전용 | ✓ |

우선순위: `.env.local` > `.env.[mode]` > `.env` (뒤에 오는 파일이 앞의 것을 오버라이드)

---

## 보안 체크리스트

```bash
# .gitignore — 반드시 포함
.env
.env.local
.env*.local
```

- 비밀 값은 CI/CD의 Secrets 기능(GitHub Actions secrets, Vercel env)에 등록합니다
- `VITE_` / `NEXT_PUBLIC_` 접두사 변수에는 공개해도 되는 값만 넣습니다
- Secret Manager(AWS Parameter Store, HashiCorp Vault)를 사용하면 `.env` 파일 없이 안전하게 런타임에 주입받습니다
- `printenv` 또는 앱 로그에 환경 변수 내용을 통째로 출력하지 않습니다

---

**지난 글:** [미디에이터·믹스인 패턴 — 협력과 조합](/posts/pattern-mediator-mixin/)

**다음 글:** [설정 우선순위 — 환경별 설정 오버라이드 전략](/posts/real-config-priority/)

<br>
읽어주셔서 감사합니다. 😊
