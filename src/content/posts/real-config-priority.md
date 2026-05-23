---
title: "설정 우선순위 — 환경별 설정 오버라이드 전략"
description: "코드 기본값, .env 파일, OS 환경 변수, CLI 인자에 이르는 설정 우선순위 레이어를 설명하고, 환경별 설정 분기와 레이어 병합 패턴을 실용 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "설정관리", "환경변수", "우선순위", "Node.js", "dotenv", "실전", "배포"]
featured: false
draft: false
---

[지난 글](/posts/real-env-vars/)에서 환경 변수를 파일에서 읽어 `process.env`에 주입하는 방법을 살펴봤습니다. 이번에는 **설정 우선순위(Configuration Priority)**를 다룹니다. 실제 프로젝트에서는 기본값, `.env` 파일, OS 환경 변수, CI/CD Secrets, 명령줄 인자 등 여러 소스가 동시에 존재합니다. 이것들이 어떤 순서로 적용되는지, 충돌 시 어떤 값이 이기는지 명확하게 정의해야 합니다.

![설정 우선순위 레이어](/assets/posts/real-config-priority-layers.svg)

## 우선순위 피라미드

설정 소스는 다음 순서로 우선순위를 가집니다(낮은 숫자가 높은 우선순위).

1. **CLI 인자 / 런타임 변수**: `PORT=9000 node app.js`처럼 명령줄 인라인으로 전달한 값
2. **OS 환경 변수**: `export PORT=8080` 또는 docker/systemd가 주입한 값
3. **`.env.local`**: 개인 개발 환경 오버라이드 (gitignore 필수)
4. **`.env.[mode]`** (`.env.production`, `.env.test`): 환경별 공유 설정
5. **`.env`**: 공통 기본값 (git 커밋 가능, 비밀 정보 금지)
6. **코드 기본값**: `const PORT = process.env.PORT ?? 3000`

오른쪽(높은 우선순위) 소스가 왼쪽을 덮어씁니다. dotenv는 기본적으로 이미 설정된 OS 환경 변수를 덮어쓰지 않습니다(`override: false`가 기본).

---

## dotenv 우선순위 제어

```javascript
import dotenv from 'dotenv';

// 기본: OS 환경 변수 유지 (파일이 이기지 않음)
dotenv.config({ path: '.env' });

// override: true — .env 파일이 OS 환경 변수를 덮어씀 (로컬 개발 시 유용)
dotenv.config({ path: '.env.local', override: true });

// 여러 파일 순서 적용
['.env', `.env.${process.env.NODE_ENV}`, '.env.local'].forEach(f => {
  dotenv.config({ path: f, override: true });
});
```

나중에 `config`를 호출할수록 높은 우선순위입니다. `.env.local`을 마지막으로 로드하면 개인 설정이 팀 공통 설정을 덮어씁니다.

---

## 환경별 설정 파일 분기

![설정 병합 구현 패턴](/assets/posts/real-config-priority-code.svg)

각 환경마다 다른 값이 필요한 경우 JavaScript 객체로 분기합니다.

```javascript
// src/config/index.js
const env = process.env.NODE_ENV ?? 'development';

const base = {
  port:     Number(process.env.PORT ?? 3000),
  logLevel: 'info',
  db: {
    pool:    { min: 2, max: 10 },
    timeout: 30_000,
  },
};

const envOverrides = {
  development: {
    logLevel: 'debug',
    db: { pool: { min: 1, max: 3 } },
  },
  test: {
    port:     4000,
    db: { pool: { min: 1, max: 1 } },
  },
  production: {
    logLevel: 'warn',
    db: { pool: { min: 5, max: 20 } },
  },
};

// 깊은 병합 (shallow spread는 중첩 객체를 날림)
function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, val] of Object.entries(override)) {
    result[key] = val !== null && typeof val === 'object' && !Array.isArray(val)
      ? deepMerge(base[key] ?? {}, val)
      : val;
  }
  return result;
}

export const config = deepMerge(base, envOverrides[env] ?? {});
```

`Object.assign` 또는 `{ ...base, ...override }`는 최상위 키만 병합해 중첩 객체를 덮어씁니다. `db.pool` 같은 중첩 설정은 `deepMerge`가 필요합니다.

---

## 설정 오버라이드 실전 패턴

### 1. CI/CD에서 환경 변수 주입

GitHub Actions에서 `env:` 블록으로 주입한 값은 OS 환경 변수가 되어 `.env` 파일보다 우선순위가 높습니다.

```yaml
# .github/workflows/deploy.yml
- name: Run tests
  env:
    NODE_ENV: test
    DATABASE_URL: ${{ secrets.TEST_DB_URL }}
    PORT: 4000
  run: npm test
```

### 2. 단위 테스트에서 환경 변수 격리

```javascript
// test/helpers/setup.js
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV:     'test',
    DATABASE_URL: 'postgresql://localhost/test_db',
  };
});

afterEach(() => {
  process.env = originalEnv;
});
```

테스트마다 독립적인 환경 변수 스냅샷을 사용합니다. `jest.resetModules()`는 설정 모듈 캐시를 초기화해 각 테스트에서 새로 로드하도록 합니다.

### 3. 런타임 설정 오버라이드 — 기능 플래그

환경 변수로 기능을 켜고 끄는 패턴입니다.

```javascript
export const flags = {
  enableNewDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
  maxUploadSize:      Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  maintenanceMode:    process.env.MAINTENANCE === 'true',
};

// 코드에서
if (flags.maintenanceMode) {
  return res.status(503).json({ message: '점검 중' });
}
```

배포 없이 환경 변수만 변경해 기능을 즉시 활성화·비활성화합니다.

---

## 설정 충돌 디버깅

설정이 예상과 다를 때 어떤 레이어에서 왔는지 추적하기 어렵습니다. 다음 방법으로 진단합니다.

```javascript
// 개발 환경에서만 설정 출처 출력
if (process.env.NODE_ENV === 'development') {
  console.log('[CONFIG]', {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    // 비밀 값은 마스킹
    DATABASE_URL: process.env.DATABASE_URL ? '[SET]' : '[MISSING]',
    JWT_SECRET:   process.env.JWT_SECRET   ? '[SET]' : '[MISSING]',
  });
}
```

```bash
# 셸에서 현재 환경 변수 확인
printenv | grep -E "^(NODE_ENV|PORT|DATABASE)"

# dotenv 파일 우선순위 디버깅
node -e "require('dotenv').config({debug: true})"
```

---

## 우선순위 충돌 방지 규칙

| 규칙 | 이유 |
|---|---|
| `.env`에 기본값, 비밀 정보 금지 | git에 커밋 가능한 파일에는 민감 정보 없어야 함 |
| `.env.local`은 항상 gitignore | 개인 DB·토큰이 팀 저장소에 노출되면 안 됨 |
| CI/CD에서 override: false | CI 환경 변수가 가장 높은 우선순위여야 함 |
| 테스트는 독립적 환경 변수 | 테스트 간 설정 오염 방지 |
| 설정을 읽는 지점은 하나 | `config/index.js` 한 파일에서만 `process.env` 접근 |

---

**지난 글:** [환경 변수 실전 — Node.js와 브라우저에서 설정 관리하기](/posts/real-env-vars/)

**다음 글:** [로깅 실전 — 구조화 로그와 레벨 전략](/posts/real-logging/)

<br>
읽어주셔서 감사합니다. 😊
