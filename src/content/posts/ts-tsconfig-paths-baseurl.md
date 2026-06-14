---
title: "paths와 baseUrl — 경로 별칭으로 import 정리하기"
description: "TypeScript의 baseUrl과 paths로 경로 별칭을 만드는 법을 정리합니다. 상대 경로 지옥 해결, 패턴 매핑 문법, paths가 런타임을 바꾸지 않는다는 함정과 번들러·Node 연동까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "tsconfig", "paths", "baseUrl", "경로별칭", "모듈해석"]
featured: false
draft: false
---

[지난 글](/posts/ts-strict-mode-flags/)에서 `strict` 묶음으로 컴파일러를 엄격하게 세팅하는 법을 다뤘다. 이번엔 코드 가독성에 직접 닿는 설정이다. 프로젝트가 커지면 `import { x } from '../../../lib/util'` 같은 상대 경로가 코드 곳곳에 번지기 시작한다. 파일을 한 번 옮기면 모든 경로가 깨지고, `../`가 몇 개인지 세는 데 시간을 쓰게 된다. `baseUrl`과 `paths`는 이 문제를 **경로 별칭(path alias)** 으로 해결한다.

## 무엇이 문제인가

상대 경로의 진짜 비용은 작성할 때가 아니라 **옮길 때** 드러난다.

![깊은 상대 경로를 @ 별칭으로 정리하는 비교](/assets/posts/ts-tsconfig-paths-baseurl-compare.svg)

`@/lib/api`처럼 프로젝트 루트 기준의 안정적인 이름을 쓰면, 파일을 어디로 옮기든 import 구문은 그대로다. 자동 완성과 리팩터링에도 훨씬 강하다.

## baseUrl: 기준점 정하기

`baseUrl`은 모듈 이름을 해석할 기준 디렉터리를 정한다. `"baseUrl": "."`로 두면 `tsconfig.json`이 있는 위치가 기준이 된다. 이 자체만으로도 `baseUrl` 기준의 "비상대(non-relative)" import가 가능해진다.

```typescript
// baseUrl: "." 이고 src/lib/api.ts 가 있을 때
import { api } from "src/lib/api"; // 상대 경로 없이 가능
```

다만 `src/`가 그대로 노출되는 건 별로 깔끔하지 않다. 그래서 보통 `baseUrl`과 함께 `paths`로 별칭을 정의한다.

## paths: 패턴으로 매핑하기

`paths`는 "이 패턴으로 import하면 저 위치로 찾아가라"는 매핑 테이블이다. 와일드카드 `*`를 써서 접두사 단위로 매핑한다.

![baseUrl과 paths 설정 예시](/assets/posts/ts-tsconfig-paths-baseurl-config.svg)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["src/components/*"],
      "@config": ["src/config/index.ts"]
    }
  }
}
```

`"@/*": ["src/*"]`은 `@/lib/api`를 `src/lib/api`로 해석하라는 뜻이다. `*`가 매칭한 부분(`lib/api`)이 오른쪽 `*` 자리에 들어간다. 와일드카드 없이 `"@config"`처럼 정확한 매핑도 가능하다. 배열인 이유는 **여러 후보 위치**를 순서대로 시도할 수 있기 때문이다(앞 후보가 없으면 다음 후보).

참고로 TypeScript 5.0 이후에는 `baseUrl` 없이도 `paths`를 쓸 수 있다. 이 경우 `paths`의 경로는 `tsconfig.json` 위치 기준으로 해석된다.

## 가장 큰 함정: paths는 런타임을 바꾸지 않는다

여기서 거의 모든 사람이 한 번은 넘어진다. `paths`는 **타입 체커가 모듈을 찾는 방식**만 바꾼다. 컴파일된 JavaScript의 import 문자열은 `@/lib/api` 그대로 남는다. Node나 브라우저는 `@`가 뭔지 모르므로, 실행하면 "모듈을 찾을 수 없음" 에러가 난다.

```text
TypeScript 컴파일: 통과 ✅
node dist/index.js  : Cannot find module '@/lib/api' ❌
```

즉 `paths`를 쓰려면 **빌드·실행 도구도 같은 별칭을 알아야** 한다. 도구별로 별도 설정이 필요하다.

- **Vite**: `resolve.alias` 또는 `vite-tsconfig-paths` 플러그인
- **webpack**: `resolve.alias` 또는 `tsconfig-paths-webpack-plugin`
- **Jest/Vitest**: `moduleNameMapper` (또는 vitest의 tsconfig paths 지원)
- **Node 직접 실행**: `tsconfig-paths/register` 또는 `tsc-alias`로 빌드 후 경로 치환

도구가 `tsconfig.json`의 `paths`를 자동으로 읽어주면 한 곳만 관리하면 되지만, 그렇지 않은 도구는 같은 매핑을 두 곳에 적어야 한다. 별칭을 추가했는데 타입은 통과하고 실행만 깨진다면, 십중팔구 이 런타임 쪽 설정이 빠진 것이다.

## 추천 컨벤션

별칭은 적고 일관되게 쓰는 게 좋다. 흔한 패턴은 `@/*` 하나로 `src` 전체를 가리키는 것이다. 그러면 규칙이 단순해 새 멤버도 금방 익힌다.

```json
{ "paths": { "@/*": ["src/*"] } }
```

별칭을 너무 잘게 쪼개면(`@components`, `@hooks`, `@utils`, ...) 오히려 외우기 어렵고 도구 설정만 늘어난다. "루트 별칭 하나 + 필요 시 소수의 추가 별칭"이 유지보수에 가장 편하다.

경로 별칭으로 import를 정리했다면, 다음은 컴파일러가 **어떤 JavaScript로, 어떤 표준 라이브러리를 가정하고** 코드를 변환할지 정하는 차례다. 다음 글에서 `lib`·`target`·`module` 세 옵션을 다룬다.

---

**지난 글:** [strict 모드 플래그 — 엄격함을 구성하는 옵션들](/posts/ts-strict-mode-flags/)

**다음 글:** [lib·target·module — 컴파일 타깃을 결정하는 3대 옵션](/posts/ts-lib-target-module/)

<br>
읽어주셔서 감사합니다. 😊
