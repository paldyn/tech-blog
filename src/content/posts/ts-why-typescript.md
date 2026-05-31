---
title: "TypeScript, 왜 지금 배워야 하는가"
description: "TypeScript 생태계 현황, 주요 기업의 채택 사례, 그리고 도입 ROI를 구체적인 데이터와 함께 분석합니다. JS 대비 TS가 실질적으로 어떤 이점을 주는지 납득하고 시작하세요."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "생태계", "채택사례", "ROI", "취업"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript가 무엇인지, 컴파일 파이프라인이 어떻게 동작하는지 살펴봤다. 이번에는 한 걸음 더 나아가 "왜 지금 TypeScript를 배워야 하는가"라는 질문에 데이터와 사례로 답한다.

## 채택률이 가파르게 오르고 있다

Stack Overflow 개발자 설문 기준으로 TypeScript 사용률은 2019년 21%에서 2024년 63%를 넘어섰다. 5년 만에 3배다. GitHub에서 가장 많이 쓰이는 언어 순위에서도 JavaScript와 함께 상위권을 꾸준히 유지한다. 단순한 유행이 아니라 **산업 표준으로 자리 잡는 흐름** 이다.

![TypeScript 채택 현황](/assets/posts/ts-why-typescript-adoption.svg)

## 누가 TypeScript를 쓰는가

주요 프레임워크와 툴링이 이미 TypeScript로 작성되어 있다.

- **Angular** — 처음부터 TypeScript를 기본 언어로 채택
- **Vue 3** — Composition API와 코어 전체 TypeScript로 재작성
- **Next.js, NestJS, Prisma, tRPC** — TypeScript-first 설계
- **VS Code** — 마이크로소프트 내부 프로덕트이자 TypeScript로 작성된 최대 규모 앱

기업 채택 사례도 광범위하다. Airbnb는 JS 버그의 38%가 TypeScript로 사전 방지 가능했다는 자체 분석 결과를 2019년에 공개했다. Slack은 수백만 줄 코드베이스를 TypeScript로 마이그레이션하면서 대형 리팩터링 속도가 크게 개선됐다고 밝혔다.

```typescript
// Vue 3 Composition API — TypeScript 없이는 이런 타입 안전성이 불가능
import { ref, computed } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = ref<Todo[]>([])
const remaining = computed(() => todos.value.filter(t => !t.done))
```

## 취업 시장에서의 TypeScript

프론트엔드 채용 공고에서 TypeScript 요구가 빠르게 늘고 있다. 2024년 기준 국내외 주요 테크 기업의 프론트엔드 JD를 분석하면 **60% 이상이 TypeScript 경험을 필수 또는 우대로 명시** 한다. 시니어급으로 갈수록 그 비율은 더 높아진다.

백엔드 Node.js 포지션, 풀스택, BFF(Backend For Frontend) 역할에서도 TypeScript 경험이 점점 기본값이 되어 가고 있다.

## 도입 ROI: 비용 대비 편익

TypeScript 도입에는 분명히 초기 비용이 있다.

- 문법을 새로 익히는 학습 시간 (대략 2주 내외)
- 초반 코드량 증가 — 타입 선언을 추가하는 오버헤드
- tsconfig와 빌드 파이프라인 설정

하지만 장기 편익이 이를 빠르게 상쇄한다.

```typescript
// 타입이 없는 JS — 이 함수가 무엇을 받고 반환하는지 코드를 읽어야만 안다
function processOrder(order, options) {
  // ...
}

// 타입이 있는 TS — 시그니처만 봐도 계약이 명확하다
interface Order {
  id: string
  items: OrderItem[]
  userId: string
}

interface ProcessOptions {
  dryRun?: boolean
  notify?: boolean
}

function processOrder(order: Order, options: ProcessOptions): Promise<OrderResult> {
  // ...
}
```

두 번째 버전은 코드를 읽지 않아도 무엇을 넘겨야 하는지, 무엇이 반환되는지 명확하다. 새 팀원이 이 함수를 처음 봤을 때 이해하는 시간이 줄어든다. 이 절약이 수백 개의 함수에 걸쳐 복리로 쌓이면 팀 전체의 속도가 달라진다.

![TypeScript 도입 ROI](/assets/posts/ts-why-typescript-roi.svg)

## "나는 작은 프로젝트밖에 안 해요"

TypeScript가 대규모 프로젝트에만 유용하다는 인식은 절반만 맞다. 맞는 부분은 대규모 프로젝트에서 효과가 가장 극적이라는 것이다. 하지만 작은 프로젝트에서도 이점은 분명하다.

- 자동완성이 훨씬 잘 된다 — IDE가 타입 정보를 바탕으로 정확한 제안을 한다
- 몇 달 뒤 코드를 다시 열었을 때 자기가 쓴 함수의 의도가 바로 파악된다
- NPM 패키지를 쓸 때 `@types/...` 패키지를 통해 API를 명확하게 파악할 수 있다

무엇보다 중요한 것은 **지금 TypeScript를 배우지 않으면 앞으로 점점 뒤처진다**는 점이다. 생태계가 이미 TypeScript 기반으로 구성되어 있기 때문이다.

## 언제 TypeScript가 부적합한가

TypeScript가 모든 상황에 완벽한 선택은 아니다.

- 스크립트 한 파일 수준의 초소형 유틸리티
- 팀원 전원이 TypeScript 경험 없고 납기가 극단적으로 촉박한 경우
- 타입 정의가 없는 레거시 라이브러리에 심하게 의존하는 경우

그러나 이런 예외적인 상황을 제외하면, 새로 시작하는 JavaScript 프로젝트에 TypeScript를 쓰지 않을 이유를 찾기가 더 어렵다.

다음 글에서는 TypeScript와 JavaScript를 더 깊이 비교하면서, 둘의 관계와 차이를 코드 레벨에서 정리한다.

---

**지난 글:** [TypeScript란 무엇인가 — 본질부터 이해하기](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript — 무엇이 다른가](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
