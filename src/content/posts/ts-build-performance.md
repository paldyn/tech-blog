---
title: "TypeScript 빌드 성능 최적화 — 컴파일 속도 끌어올리기"
description: "TypeScript 컴파일이 느려지는 원인과 해결책을 정리합니다. incremental·skipLibCheck·isolatedModules 옵션, 타입 검사와 트랜스파일 분리, project references, 그리고 tsc --diagnostics로 병목을 찾는 법까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "빌드", "성능", "incremental", "skipLibCheck", "esbuild"]
featured: false
draft: false
---

[지난 글](/posts/ts-error-handling/)에서 타입 안전한 에러 처리를 다뤘다. 코드베이스가 커지면 새로운 고통이 찾아온다. 바로 **느린 컴파일**이다. 타입 검사에 수십 초가 걸리기 시작하면 개발 피드백 루프가 무너지고, CI 시간도 함께 늘어난다. 이번 글에서는 TypeScript 빌드가 느려지는 원인과 실전 최적화 기법을 정리한다.

## 타입 검사와 트랜스파일을 분리하라

가장 큰 인식 전환은 이것이다. **`tsc`가 하는 일은 두 가지**다 — (1) 타입 검사, (2) JavaScript로 트랜스파일. 그런데 트랜스파일만 놓고 보면 `esbuild`나 `swc` 같은 도구가 `tsc`보다 10~100배 빠르다. 타입을 지우는 작업은 타입 검사 없이도 가능하기 때문이다.

```bash
# 트랜스파일은 빠른 도구에 맡기고
esbuild src/index.ts --bundle --outfile=dist/index.js

# 타입 검사는 tsc가 출력 없이 전담
tsc --noEmit
```

이렇게 역할을 나누면 빌드(번들)는 매우 빨라지고, 타입 검사는 별도 프로세스로 돌릴 수 있다. CI에서는 두 작업을 병렬로 실행해 전체 시간을 줄인다.

![타입 검사와 트랜스파일 분리](/assets/posts/ts-build-performance-flow.svg)

## incremental로 재빌드 캐싱

`incremental: true`는 이전 빌드 정보를 `.tsbuildinfo` 파일에 저장해, 다음 빌드에서 바뀐 부분만 다시 검사한다. 전체 재검사 대신 증분 검사로 두 번째 빌드부터 크게 빨라진다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsbuildinfo"
  }
}
```

`.tsbuildinfo`는 캐시이므로 `.gitignore`에 넣고, CI에서는 캐시 디렉터리를 보존하면 효과가 커진다.

## skipLibCheck로 d.ts 검사 건너뛰기

`node_modules`의 수많은 `.d.ts` 선언 파일을 매번 검사하면 큰 시간이 든다. `skipLibCheck: true`는 선언 파일 간 타입 검사를 건너뛴다. 내 코드의 타입 검사는 그대로 유지되므로, 거의 모든 프로젝트에서 켜는 것이 권장된다.

![빌드 속도 tsconfig 옵션](/assets/posts/ts-build-performance-code.svg)

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true
  }
}
```

서로 다른 라이브러리가 충돌하는 타입을 가질 때 발생하던 무관한 오류도 사라지므로, 실용적인 이점이 크다.

## isolatedModules와 단일 파일 트랜스파일

`esbuild`·`swc`·Babel처럼 한 파일씩 독립적으로 변환하는 도구는 전체 타입 정보를 보지 않는다. 이런 도구가 안전하게 동작하도록 `isolatedModules: true`를 켜면, 단일 파일 변환에서 문제가 되는 패턴(예: `const enum` 재내보내기, 타입과 값을 구분 못 하는 re-export)을 컴파일러가 미리 막아 준다.

```typescript
// isolatedModules: true 에서 권장되는 형태
import { type User, createUser } from "./user";
export { type User }; // 타입은 type 키워드로 명시
```

타입 전용 임포트를 `type` 키워드로 명시하면, 트랜스파일러가 무엇을 지워야 할지 명확히 알 수 있다.

## project references로 큰 코드베이스 쪼개기

모노레포나 대형 프로젝트는 `project references`로 빌드 단위를 나눌 수 있다. 각 하위 프로젝트가 독립적으로 빌드·캐싱되어, 변경된 패키지와 그에 의존하는 패키지만 다시 빌드된다.

```json
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" }
  ]
}
```

`tsc --build`(빌드 모드)로 실행하면 의존성 그래프를 따라 필요한 부분만 증분 빌드한다.

## 병목을 측정하라

추측 대신 측정이 먼저다. `tsc`의 진단 플래그로 어디서 시간이 드는지 확인한다.

```bash
# 단계별 소요 시간과 메모리
tsc --noEmit --extendedDiagnostics

# 타입별 검사 비용 추적 (느린 타입 찾기)
tsc --noEmit --generateTrace ./trace
```

`--extendedDiagnostics`는 검사·바인딩·출력 단계의 시간을, `--generateTrace`는 Chrome 트레이스 뷰어로 열 수 있는 상세 프로파일을 만든다. 보통 과도하게 복잡한 조건부 타입이나 거대한 유니온이 병목으로 드러난다.

정리하면, 빌드 최적화의 핵심 전략은 ① 검사와 트랜스파일 분리, ② `incremental`·`skipLibCheck` 캐싱, ③ `project references`로 분할, ④ 측정 기반 개선이다. 다음 글부터는 분위기를 바꿔, 타입 시스템 자체를 가지고 노는 **타입 레벨 프로그래밍** — type-challenges 입문으로 들어간다.

---

**지난 글:** [TypeScript 에러 핸들링 — unknown catch와 타입 안전한 예외 처리](/posts/ts-error-handling/)

**다음 글:** [type-challenges 입문 — 타입 레벨 프로그래밍 연습](/posts/ts-type-challenges-intro/)

<br>
읽어주셔서 감사합니다. 😊
