---
title: "대규모 코드베이스 전략"
description: "수백 개 모듈과 여러 패키지가 얽힌 대규모 TypeScript 프로젝트를 다루는 구조적 전략을 정리한다. 프로젝트 레퍼런스로 의존성을 쪼개 부분 빌드를 가능하게 하는 법, composite·incremental로 캐시를 활용하는 설정, 그리고 폴더 구조와 배럴 파일에 대한 현실적인 조언을 담았다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "모노레포", "프로젝트 레퍼런스", "빌드", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-checking-performance/)에서 타입 체크 성능을 수치로 진단하고 줄이는 법을 다뤘다. 프로젝트가 작을 때는 그런 미세 조정만으로 충분하다. 하지만 코드가 수백 개 모듈, 여러 패키지로 불어나면 문제의 성격이 달라진다. 파일 하나를 고쳤을 뿐인데 전체를 다시 검사하느라 빌드가 1분씩 걸리고, 어디서 무엇을 import 하는지 추적이 안 되는 순간이 온다. 이번 글은 대규모 코드베이스를 **구조적으로** 다루는 전략, 그중에서도 가장 강력한 도구인 프로젝트 레퍼런스를 중심으로 살펴본다.

## 단일 컴파일의 한계

기본 설정에서 `tsc`는 프로젝트를 하나의 거대한 컴파일 단위로 본다. 파일 하나만 바꿔도 전체 그래프를 다시 검사하고, 부분만 빌드할 방법이 없다. 또한 모든 파일이 서로를 자유롭게 import 할 수 있어서, 아키텍처상 "UI는 서버 내부를 몰라야 한다" 같은 경계를 컴파일러가 강제해 주지 못한다. 규모가 커지면 이 두 가지가 동시에 발목을 잡는다.

해법은 코드베이스를 의존성 방향이 명확한 여러 조각으로 쪼개고, 컴파일러에게 그 경계를 알려 주는 것이다.

![프로젝트 레퍼런스 의존성 그래프](/assets/posts/ts-large-codebase-strategies-project-refs.svg)

`shared`는 공통 타입과 유틸을 담고, `ui`와 `api`는 각자 `shared`에만 의존하며, 최종 `app`이 둘을 합친다. 이 방향이 코드에 박히면 `api`가 실수로 `ui`를 import 하는 일이 컴파일 단계에서 막힌다.

## 프로젝트 레퍼런스 설정

각 패키지는 자기 `tsconfig.json`을 가지고, 의존하는 패키지를 `references`로 가리킨다. 의존 대상이 되는 패키지는 `composite: true`여야 한다.

```json
// app/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  },
  "references": [
    { "path": "../shared" },
    { "path": "../ui" },
    { "path": "../api" }
  ]
}
```

이렇게 구성한 뒤 루트에서 `tsc --build`(줄여서 `tsc -b`)를 실행하면, 컴파일러가 의존성 그래프를 따라 **올바른 순서로** 각 패키지를 빌드한다. `shared`를 먼저 빌드하고, 그 결과를 `ui`·`api`가 참조하는 식이다.

```bash
tsc --build           # 전체를 의존성 순서대로
tsc --build --watch   # 변경분만 감시하며 재빌드
tsc --build --clean   # 산출물 정리
```

핵심 이점은 **부분 빌드**다. `ui`만 고쳤다면 `shared`는 그대로 두고 `ui`와 그에 의존하는 `app`만 다시 빌드한다. 패키지가 많아질수록 이 절약 효과는 커진다.

## composite와 incremental

프로젝트 레퍼런스가 동작하려면 `composite: true`가 필요하고, 이 옵션은 자동으로 `incremental`을 켠다. 빌드 결과의 메타데이터를 `.tsbuildinfo` 파일에 저장해 두고, 다음 빌드 때 변경되지 않은 부분을 건너뛰는 구조다.

![composite와 incremental 설정](/assets/posts/ts-large-codebase-strategies-incremental.svg)

단일 프로젝트라도 `incremental: true`만 켜면 두 번째 빌드부터는 캐시 덕을 본다. 여기에 앞 글에서 다룬 `skipLibCheck`를 더하면 CI 빌드 시간을 의미 있게 줄일 수 있다. 한 가지 주의할 점은 `.tsbuildinfo`를 빌드 캐시로 보존하되 버전 관리에는 넣지 않는 것이다. CI에서 이 파일을 캐싱하면 매번 처음부터 빌드하지 않아도 된다.

## 폴더 구조와 배럴 파일

구조 이야기에서 빠지지 않는 것이 `index.ts`로 모든 것을 다시 export 하는 **배럴 파일**이다. 편리해 보이지만 대규모에서는 양날의 검이다.

```typescript
// shared/index.ts — 배럴
export * from "./user";
export * from "./order";
export * from "./payment";
// ...수십 개
```

배럴 하나를 import 하면 거기서 export 하는 모든 모듈이 그래프에 끌려 들어온다. 작은 파일 하나만 쓰려 해도 전체가 따라오면서 타입 검사 범위와 번들 크기가 모두 불어난다. 순환 참조의 온상이 되기도 한다. 대규모에서는 배럴을 최소화하고, 필요한 모듈을 경로로 직접 import 하는 편이 빌드에도 추적에도 유리하다.

## 무엇을 기억할까

규모가 커지면 미세 최적화보다 **구조**가 답이다. 코드베이스를 의존성 방향이 분명한 패키지로 쪼개고, 프로젝트 레퍼런스로 그 경계를 컴파일러에 알려 주면, 부분 빌드와 아키텍처 강제라는 두 마리 토끼를 동시에 잡는다. `composite`·`incremental`·`skipLibCheck`로 캐시를 활용하고, 배럴 파일은 절제해서 쓴다. 이렇게 구조가 잡히면, 코드가 더 늘어나도 빌드와 이해 가능성이 함께 무너지지 않는다. 다음 글에서는 그런 큰 코드베이스에서 매일 마주하는 컴파일러의 에러 메시지를 어떻게 빠르게 읽어 낼지 다룬다.

---

**지난 글:** [타입 체크 성능 끌어올리기](/posts/ts-type-checking-performance/)

**다음 글:** [자주 만나는 에러 메시지 읽기](/posts/ts-common-error-messages/)

<br>
읽어주셔서 감사합니다. 😊
