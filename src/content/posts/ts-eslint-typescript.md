---
title: "typescript-eslint — 타입 인식 린팅 설정하기"
description: "typescript-eslint로 TypeScript 코드를 린팅하는 법을 정리합니다. 컴파일러와 린터의 역할 차이, 타입 인식 규칙의 동작 원리, flat config 설정과 projectService, 성능 고려사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "ESLint", "typescript-eslint", "린팅", "flat-config", "코드품질"]
featured: false
draft: false
---

[지난 글](/posts/ts-project-references/)까지 `tsconfig`로 빌드와 프로젝트 구조를 정비했다. 이제 코드 품질로 넘어간다. "타입 체크를 통과하면 충분하지 않나?"라고 생각하기 쉽지만, 컴파일러와 린터는 잡는 문제가 다르다. `tsc`는 **타입 오류**를 잡고, ESLint는 **스타일·관용·잠재적 버그**를 잡는다. 그리고 `typescript-eslint`는 여기에 한 가지를 더한다 — 타입 정보를 읽어서 더 똑똑하게 검사하는 **타입 인식(type-aware) 린팅**이다.

## 컴파일러가 못 잡는 것들

`tsc`는 타입이 맞는지를 본다. 하지만 타입이 맞아도 위험하거나 나쁜 코드가 있다. 예를 들면 이런 것들이다.

```typescript
// 타입은 통과하지만 ESLint가 잡아야 하는 것들
async function load() {
  fetchData();          // 떠다니는 Promise (await 누락)
  if (user == null) {}   // == vs ===
  const x = y!;          // 불필요한 non-null 단언
}
```

이런 패턴은 타입 시스템상으로는 합법이지만 버그의 온상이다. `typescript-eslint`의 규칙들이 이를 잡아준다. 특히 `await` 없이 방치된 Promise(floating promise)는 에러를 삼켜버리는 흔한 버그인데, 이걸 잡으려면 **그 표현식이 Promise인지** 알아야 하고, 그러려면 타입 정보가 필요하다.

## 타입 인식 린팅의 원리

일반 ESLint는 코드를 파싱한 구문 트리(AST)만 본다. `typescript-eslint`는 전용 파서로 AST를 만들되, **TypeScript 프로그램에 연결해 타입 정보까지** 함께 제공한다. 덕분에 규칙이 "이 변수의 타입이 무엇인지"를 질의할 수 있다.

![typescript-eslint가 타입 정보를 활용해 린팅하는 파이프라인](/assets/posts/ts-eslint-typescript-pipeline.svg)

이것이 타입 인식 규칙(`no-floating-promises`, `no-misused-promises`, `no-unsafe-assignment` 등)이 동작하는 방식이다. 타입 정보를 쓰지 않는 규칙도 많지만, `typescript-eslint`의 진짜 가치는 이 타입 인식 규칙들에 있다.

## flat config 설정

최신 ESLint는 `eslint.config.js`(flat config)를 쓴다. `typescript-eslint`는 설정을 간편하게 묶어주는 헬퍼를 제공한다.

![typescript-eslint의 flat config 설정 예시](/assets/posts/ts-eslint-typescript-config.svg)

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
);
```

`recommendedTypeChecked`는 타입 인식 규칙까지 포함한 추천 세트다. 타입 정보가 필요 없는 가벼운 세트만 원하면 `recommended`를 쓰면 된다. 핵심 설정은 `parserOptions.projectService: true`다. 이것이 파서를 TypeScript 프로젝트에 연결해 타입 정보를 제공하게 한다. (예전에는 `project: './tsconfig.json'`을 직접 지정했지만, `projectService`가 더 간편하고 권장된다.)

## 성능을 의식하기

타입 인식 린팅은 타입 정보를 계산해야 하므로 **느리다**. 사실상 린팅 중에 타입 체크에 준하는 작업이 일어난다. 큰 코드베이스에서 린트가 느리다면 다음을 고려한다.

- 타입 인식이 **필요 없는 파일**(설정 파일, 스크립트)은 타입 인식 규칙에서 제외한다.
- 일부 무거운 규칙만 골라 켠다(전체 `recommendedTypeChecked` 대신).
- CI에서는 전체를, 로컬 에디터에서는 가벼운 세트를 쓰는 분리 전략.

```javascript
// 특정 파일은 타입 인식에서 제외
{
  files: ['**/*.js', '*.config.ts'],
  ...tseslint.configs.disableTypeChecked,
}
```

## tsc와 ESLint를 함께

마지막으로 역할 분담을 분명히 하자. **타입 체크는 `tsc --noEmit`이, 린팅은 ESLint가** 맡는 것이 깔끔하다. ESLint로 타입 오류까지 잡으려 하면 느리고 메시지도 덜 친절하다. 반대로 컴파일러에게 스타일을 강제하려 해도 안 된다. 둘을 CI 파이프라인에 나란히 두는 구성이 표준이다.

```bash
tsc --noEmit && eslint .
```

여기까지로 TypeScript의 설정·빌드·품질 도구를 한 바퀴 돌았다. 다음 글부터는 이 모든 기초를 실전에 적용하는 영역으로 들어간다. 그 첫걸음으로, 가장 많은 사람이 TypeScript를 실제로 만나는 무대 — **React** 의 타이핑을 시작한다. 컴포넌트와 props에 타입을 입히는 법부터 다룬다.

---

**지난 글:** [프로젝트 레퍼런스 — 모노레포를 위한 빌드 분할](/posts/ts-project-references/)

**다음 글:** [React 타이핑 시작 — 컴포넌트와 props의 타입](/posts/ts-typing-react/)

<br>
읽어주셔서 감사합니다. 😊
