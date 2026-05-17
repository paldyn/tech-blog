---
title: "Playwright vs Cypress — E2E 테스트 프레임워크 완전 비교"
description: "Playwright와 Cypress의 아키텍처 차이, 브라우저 지원, 네트워크 인터셉터, 시각 회귀 테스트, 병렬 실행, CI 통합을 심층 비교하고 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Playwright", "Cypress", "E2E테스트", "크로스브라우저", "시각회귀", "CI", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/test-testing-library/)에서 사용자 관점의 컴포넌트 테스트를 다뤘습니다. 이번에는 **E2E(End-to-End) 테스트** 프레임워크인 Playwright와 Cypress를 비교합니다. 두 도구 모두 실제 브라우저에서 사용자 시나리오를 자동화하지만, 아키텍처와 철학에 근본적인 차이가 있습니다.

---

## 아키텍처의 차이

**Playwright**는 외부 프로세스에서 브라우저를 제어합니다. Chrome DevTools Protocol(CDP)이나 WebDriver BiDi를 통해 브라우저 프로세스와 통신하며, 테스트 코드는 브라우저 외부에서 실행됩니다. 이 구조는 여러 브라우저, 여러 탭, 여러 도메인에 걸친 시나리오를 자연스럽게 처리합니다.

**Cypress**는 테스트 코드가 브라우저 내 iframe 안에서 직접 실행됩니다. 앱과 테스트가 동일한 JavaScript 이벤트 루프를 공유하므로 동기적 DOM 조작에서 안정적이지만, same-origin 제약이 있고 다중 탭 시나리오 처리가 복잡합니다.

![Playwright vs Cypress 비교](/assets/posts/test-playwright-cypress-comparison.svg)

---

## Playwright 설치와 설정

```bash
npm init playwright@latest
# 또는 기존 프로젝트에 추가
npm install -D @playwright/test
npx playwright install  # 브라우저 바이너리 다운로드
```

`playwright.config.ts`에서 프로젝트(브라우저), baseURL, 타임아웃 등을 설정합니다.

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

`webServer` 옵션을 사용하면 테스트 실행 전 개발 서버를 자동으로 시작하고 종료합니다.

---

## Playwright 테스트 작성

```typescript
import { test, expect, Page } from '@playwright/test'

// 로그인 상태를 fixture로 재사용
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'alice@test.com')
  await page.fill('[name=password]', 'secret')
  await page.click('button[type=submit]')
  await expect(page).toHaveURL('/dashboard')
})

test('상품 목록이 표시된다', async ({ page }) => {
  await page.goto('/products')
  // getByRole로 접근성 기반 요소 탐색
  const items = page.getByRole('listitem')
  await expect(items).toHaveCount(10)
})

test('검색 기능이 동작한다', async ({ page }) => {
  await page.goto('/products')
  await page.getByPlaceholder('검색어를 입력하세요').fill('노트북')
  await page.keyboard.press('Enter')
  await expect(page.getByText('검색 결과')).toBeVisible()
})
```

Playwright의 `expect`는 자동으로 최대 5초(기본값) 동안 재시도해 비동기 DOM 변화를 처리합니다. 별도의 `waitFor`나 `sleep`이 불필요합니다.

---

![Playwright 테스트 코드 패턴](/assets/posts/test-playwright-cypress-code.svg)

---

## 네트워크 인터셉트와 API 목킹

```typescript
test('API 에러 처리', async ({ page }) => {
  // 특정 경로의 응답을 오버라이드
  await page.route('**/api/products', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: '서버 오류' }),
    })
  })

  await page.goto('/products')
  await expect(page.getByText('데이터를 불러올 수 없습니다')).toBeVisible()
})

// 느린 응답 시뮬레이션
await page.route('**/api/slow', async (route) => {
  await new Promise(r => setTimeout(r, 3000))
  await route.continue()
})
```

---

## Cypress 비교

```javascript
// cypress/e2e/login.cy.js
describe('로그인', () => {
  it('성공적으로 로그인한다', () => {
    cy.visit('/login')
    cy.get('[name=email]').type('alice@test.com')
    cy.get('[name=password]').type('secret')
    cy.get('button[type=submit]').click()
    cy.url().should('include', '/dashboard')
  })

  // Cypress: 네트워크 인터셉트
  it('API 에러를 처리한다', () => {
    cy.intercept('GET', '/api/products', { statusCode: 500 }).as('getProducts')
    cy.visit('/products')
    cy.wait('@getProducts')
    cy.contains('데이터를 불러올 수 없습니다').should('be.visible')
  })
})
```

Cypress의 체이닝 API는 직관적이고 에러 메시지가 명확합니다. 하지만 비동기 처리가 내부적으로 자동화되어 있어 Promise를 직접 다루는 방식과 혼용하면 예상치 못한 동작이 발생할 수 있습니다.

---

## Playwright Codegen — 테스트 자동 생성

```bash
npx playwright codegen http://localhost:3000
```

브라우저가 열리고 실제 사용자 동작을 기록해 자동으로 테스트 코드를 생성합니다. 생성된 코드를 기반으로 수정해 사용하면 테스트 작성 속도를 크게 높일 수 있습니다.

---

## Trace Viewer — 실패 진단

```bash
npx playwright show-trace trace.zip
```

테스트 실패 시 `trace: 'on-first-retry'` 설정으로 기록된 트레이스 파일을 Trace Viewer에서 분석합니다. 각 액션의 스크린샷, 네트워크 요청, 콘솔 로그, DOM 스냅샷을 타임라인으로 확인할 수 있습니다.

---

## 선택 기준 정리

| 필요 조건 | 추천 |
|-----------|------|
| 크로스 브라우저(Safari 포함) | Playwright |
| 모바일 디바이스 에뮬레이션 | Playwright |
| CI 무료 병렬 실행 | Playwright |
| 시각적 디버거 / 타임 트래블 | Cypress |
| 팀이 E2E 테스트 처음 도입 | Cypress |
| 복잡한 네트워크 목킹 | 둘 다 가능 |
| 컴포넌트 테스트 (iframe 기반) | Cypress Component |
| 파일 다운로드 / 팝업 처리 | Playwright |

---

**지난 글:** [Testing Library — 사용자 관점 UI 컴포넌트 테스트](/posts/test-testing-library/)

**다음 글:** [테스트 피라미드 — 전략적 테스트 포트폴리오 구성](/posts/test-pyramid/)

<br>
읽어주셔서 감사합니다. 😊
