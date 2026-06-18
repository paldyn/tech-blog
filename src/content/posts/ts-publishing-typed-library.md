---
title: "타입을 포함한 라이브러리 배포하기"
description: "TypeScript 라이브러리를 npm에 배포할 때 타입까지 올바르게 전달하는 법을 다룬다. package.json의 exports 맵과 types 조건 순서, ESM/CJS 듀얼 패키지, files 필드, 그리고 attw·publint로 배포 전 자동 검증하는 절차를 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "npm", "라이브러리", "exports", "배포"]
featured: false
draft: false
---

[지난 글](/posts/ts-dts-bundling/)에서 흩어진 선언을 단일 `.d.ts`로 묶는 법을 봤다. 이제 그 결과물을 npm에 올릴 차례다. 라이브러리 배포에서 가장 흔하게 어긋나는 부분이 바로 타입이다. JS는 잘 동작하는데 사용자 에디터에서 타입이 안 잡히거나, ESM에서는 되는데 CommonJS에서는 `any`로 나오는 식이다. 이번 글은 타입까지 정확히 전달되는 라이브러리 배포 설정을 다룬다.

## exports 맵이 모든 것을 결정한다

현대 패키지의 진입점은 `package.json`의 `exports` 필드가 결정한다. `main`과 `types` 같은 옛 필드도 있지만, `exports`가 있으면 Node와 번들러는 이쪽을 우선한다. 핵심은 각 진입점마다 **조건(condition)** 별로 다른 파일을 가리킬 수 있다는 점이다.

![exports 맵 구조](/assets/posts/ts-publishing-typed-library-exports.svg)

여기서 가장 자주 틀리는 규칙이 **조건 순서**다. `types` 조건은 반드시 다른 조건보다 **앞에** 와야 한다. 조건은 위에서 아래로 매칭되는데, TypeScript는 `types`를 먼저 찾아야 타입을 해석한다. `import`나 `require` 뒤에 `types`를 두면 무시될 수 있다.

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

서브 경로를 노출하고 싶으면 `"./utils"`처럼 키를 추가하면 된다. 이렇게 하면 사용자는 `import { x } from "my-lib/utils"`로 접근하고, 그 외 내부 경로는 자동으로 막힌다.

## ESM/CJS 듀얼 패키지의 타입

ESM과 CJS를 모두 지원하면, 두 모듈 형식 각각에 맞는 타입 선언이 필요할 수 있다. 모듈 형식이 다르면 `import`/`export` 문법이 달라서, 한쪽 `.d.ts`가 다른 쪽과 맞지 않을 수 있기 때문이다. 가장 깔끔한 해법은 각 조건에 타입을 명시적으로 짝지어 주는 것이다.

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

ESM 진입점에는 `.d.ts`를, CJS 진입점에는 `.d.cts`를 짝지었다. tsup 같은 도구는 `format: ["esm", "cjs"]`와 `dts: true`로 이 짝을 자동 생성해 준다. 가능하면 ESM 단독으로 배포하는 것이 가장 단순하지만, 폭넓은 호환이 필요하면 이렇게 듀얼로 간다.

## 무엇을 배포에 담을 것인가

배포 패키지에는 빌드 산출물만 들어가야 한다. 소스, 테스트, 설정 파일까지 올리면 패키지가 비대해지고 내부 구조가 노출된다. `files` 필드로 포함할 디렉터리를 명시하는 방식이 가장 안전하다.

```json
{
  "files": ["dist"],
  "sideEffects": false,
  "dependencies": {
    "some-runtime-dep": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0"
  }
}
```

`sideEffects: false`는 번들러에게 트리 셰이킹을 허용한다는 신호다. 그리고 런타임에 실제로 필요한 패키지만 `dependencies`에 두고, 빌드/테스트 도구는 `devDependencies`에 둔다. `@types/*` 패키지는 라이브러리의 공개 타입이 그 타입을 참조한다면 `dependencies`에, 내부 구현에만 쓰면 `devDependencies`에 둔다.

## 배포 전 자동 검증

설정이 옳은지 사람이 눈으로 확인하긴 어렵다. 다행히 검증을 자동화하는 도구가 있다.

![배포 전 점검](/assets/posts/ts-publishing-typed-library-checklist.svg)

**attw**(Are the Types Wrong?)는 패키지를 ESM/CJS 등 여러 해석 환경에서 시뮬레이션해, 타입이 제대로 잡히는지 검사한다. 조건 순서 실수나 듀얼 패키지 타입 불일치 같은, 눈으로 놓치기 쉬운 문제를 콕 집어준다. **publint**는 `package.json`의 배포 설정 전반을 린트한다.

```bash
# 배포 직전 검증
npm pack --dry-run        # 실제로 담길 파일 목록 확인
npx @arethetypeswrong/cli --pack
npx publint
```

이 셋을 `prepublishOnly` 스크립트에 묶어 두면, 검증을 통과하지 못한 패키지는 아예 배포되지 않는다.

```json
{
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "npm run build && publint && attw --pack"
  }
}
```

## 정리

타입 포함 라이브러리 배포의 핵심은 `exports` 맵에 있다. **`types` 조건을 항상 맨 앞에 두고, ESM/CJS 듀얼이면 각 조건에 타입을 짝지으며, `files`로 산출물만 담고, attw와 publint로 배포 전 자동 검증한다.** "내 JS는 동작하는데 사용자 타입이 안 잡힌다"는 흔한 사고는 거의 다 이 설정에서 비롯되므로, 검증 도구를 `prepublishOnly`에 걸어 두는 것만으로도 대부분을 예방할 수 있다. 다음 글에서는 이렇게 배포한 라이브러리의 타입 변경을 시맨틱 버저닝과 어떻게 연결할지 살펴본다.

---

**지난 글:** [.d.ts 번들링](/posts/ts-dts-bundling/)

**다음 글:** [타입과 시맨틱 버저닝](/posts/ts-semantic-versioning-types/)

<br>
읽어주셔서 감사합니다. 😊
