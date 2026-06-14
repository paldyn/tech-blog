---
title: "프로젝트 레퍼런스 — 모노레포를 위한 빌드 분할"
description: "TypeScript 프로젝트 참조(project references)를 정리합니다. references 선언과 의존 그래프, tsc -b의 빌드 순서 계산, composite 요구사항, 모노레포에서의 효과와 주의점을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "project-references", "모노레포", "composite", "tsc-build", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/ts-composite-incremental/)에서 `composite`가 프로젝트를 "다른 프로젝트가 참조할 수 있는 독립 단위"로 만드는 옵션이라고 했다. 이제 그 단위들을 실제로 엮을 차례다. 하나의 거대한 `tsconfig`로 모든 코드를 한꺼번에 컴파일하는 대신, 코드베이스를 여러 프로젝트로 나누고 그 사이의 의존 관계를 선언하는 것 — 이것이 **프로젝트 참조(project references)** 다. 모노레포에서 특히 빛을 발한다.

## 무엇을 해결하나

큰 코드베이스를 단일 프로젝트로 두면 두 가지가 괴롭다. 첫째, 작은 변경에도 전체가 다시 컴파일된다. 둘째, 패키지 간 경계가 타입 레벨에서 강제되지 않아 아무 곳이나 import하게 된다. 프로젝트 참조는 코드를 논리적 단위로 쪼개고, 각 단위를 독립적으로(그리고 증분으로) 빌드하며, 단위 간 의존 방향을 명시하게 만든다.

![app이 ui와 core를 참조하는 의존 그래프](/assets/posts/ts-project-references-graph.svg)

위 그림처럼 `app`이 `ui`와 `core`를 참조하고 `ui`가 다시 `core`를 참조하면, 빌드 도구는 이 그래프를 위상 정렬해 `core → ui → app` 순서로 빌드한다. 그리고 변경된 프로젝트와 그에 **의존하는** 프로젝트만 다시 빌드한다.

## references 선언하기

참조는 각 프로젝트의 `tsconfig.json`에 `references` 배열로 적는다. 그리고 참조 **대상**(`ui`, `core`)은 `composite: true`여야 한다.

![app의 tsconfig.json에 references를 선언한 예시](/assets/posts/ts-project-references-config.svg)

```json
// app/tsconfig.json
{
  "compilerOptions": { "composite": true },
  "references": [
    { "path": "../ui" },
    { "path": "../core" }
  ]
}
```

```json
// core/tsconfig.json — 참조 대상은 composite 필수
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

`path`는 참조 대상의 `tsconfig.json`이 있는 디렉터리(또는 파일)를 가리킨다. 핵심은 `app`이 `core`의 **소스를 다시 컴파일하지 않는다**는 점이다. `core`가 미리 만들어 둔 `.d.ts`(선언 파일)와 `.tsbuildinfo`를 읽어 타입만 가져온다. 그래서 참조 대상은 반드시 `declaration: true`로 `.d.ts`를 내보내야 한다(`composite`가 이를 요구한다).

## tsc -b로 빌드하기

프로젝트 참조의 빌드는 일반 `tsc`가 아니라 **빌드 모드 `tsc -b`** 로 한다.

```bash
# 루트 또는 app 디렉터리에서
tsc -b

# 깨끗이 다시 빌드
tsc -b --clean && tsc -b

# 감시 모드
tsc -b --watch
```

`tsc -b`는 참조 그래프를 따라가며 각 프로젝트의 `.tsbuildinfo`를 확인한다. 변경이 없는 프로젝트는 통째로 건너뛰고, 변경된 프로젝트와 그 상위 의존자만 다시 빌드한다. 모노레포에서 한 패키지만 고쳤을 때 관련된 일부만 빌드되므로, 전체 재빌드보다 훨씬 빠르다.

## 흔한 함정

**첫째, 참조 대상이 `composite`가 아니면** `tsc -b`가 거부한다. "Referenced project must have setting composite: true" 류의 에러가 나면 대상의 `tsconfig`를 확인하자.

**둘째, 일반 `tsc`로 빌드하면** 참조가 무시된다. 프로젝트 참조의 빌드 순서·증분 효과는 `tsc -b`에서만 동작한다.

**셋째, 런타임 모듈 해석은 별개다.** `references`는 빌드 순서와 타입 해석을 위한 것이지, 런타임에 `import { x } from '@my/core'`가 실제로 어디서 로드될지를 정하지 않는다. 그건 패키지 매니저의 워크스페이스 설정(`pnpm`/`yarn`/`npm` workspaces)이나 번들러가 담당한다. 보통 워크스페이스 + 프로젝트 참조를 **함께** 써서, 런타임 해석은 워크스페이스가, 타입·빌드 순서는 프로젝트 참조가 맡게 한다.

## 언제 도입할까

프로젝트 참조는 공짜가 아니다. `tsconfig`가 여러 개로 늘고, 빌드 명령이 `tsc -b`로 바뀌며, 설정 실수에 따른 디버깅 비용이 생긴다. 그래서 **여러 패키지가 서로 의존하는 모노레포**, 또는 **빌드 시간이 정말 문제가 되는 대형 단일 저장소**에서 가치가 분명하다. 패키지가 둘셋뿐이거나 빌드가 충분히 빠르다면, `incremental`만으로도 충분한 경우가 많다.

여기까지로 `tsconfig` 중심의 빌드·설정 주제를 일단락한다. 다음부터는 코드 품질로 시선을 옮긴다. 다음 글에서는 `typescript-eslint`로 타입 정보를 활용한 린팅을 설정해, 컴파일러가 잡지 못하는 문제까지 잡아내는 법을 다룬다.

---

**지난 글:** [composite와 incremental — 증분 빌드의 기초](/posts/ts-composite-incremental/)

**다음 글:** [typescript-eslint — 타입 인식 린팅 설정하기](/posts/ts-eslint-typescript/)

<br>
읽어주셔서 감사합니다. 😊
