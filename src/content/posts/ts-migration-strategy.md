---
title: "TypeScript 마이그레이션 전략"
description: "기존 자바스크립트 코드베이스를 TypeScript로 옮기는 전체 전략을 다룬다. 한 번에 strict로 가지 않고 빌드 연결·파일 변환·strict 강화·완료의 4단계로 나누는 로드맵, 의존성 말단부터 변환하는 순서, ts-nocheck를 활용한 점진 전환까지 큰 그림을 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "마이그레이션", "JavaScript", "전환", "전략"]
featured: false
draft: false
---

[지난 글](/posts/ts-semantic-versioning-types/)에서 타입 라이브러리의 버저닝을 다뤘다. 지금까지는 처음부터 TypeScript로 작성한다는 전제였지만, 현실에서 더 흔한 상황은 "이미 수만 줄의 자바스크립트가 돌아가고 있는데 여기에 타입을 입혀야 한다"는 쪽이다. 이번 글은 그 마이그레이션의 큰 그림을 다룬다. 세부 도구(allowJs, strict 플래그, any 제거)는 이어지는 글들에서 깊이 보고, 여기서는 **전체 로드맵과 순서**에 집중한다.

## 한 번에 가지 않는다

마이그레이션의 가장 큰 실수는 "전부 멈추고 한 번에 strict TypeScript로 바꾸겠다"는 빅뱅 접근이다. 큰 코드베이스에서 이는 수천 개의 에러를 한꺼번에 마주하게 만들고, 그동안 기능 개발은 멈추며, 결국 중도 포기로 이어지기 쉽다. 핵심 원칙은 **언제나 빌드가 통과하는 상태를 유지하면서 단계적으로 전진하는 것**이다.

![마이그레이션 4단계](/assets/posts/ts-migration-strategy-phases.svg)

크게 네 단계로 나눌 수 있다. 1단계는 빌드 파이프라인에 TypeScript를 끼워 넣되 기존 JS가 그대로 동작하게 두는 것, 2단계는 파일을 하나씩 `.ts`로 옮기는 것, 3단계는 strict 플래그를 하나씩 켜며 타입을 단단히 하는 것, 4단계는 `any`를 제거하고 완전한 strict에 도달하는 것이다.

## 1단계: 빌드에 TypeScript 연결

첫 단계의 목표는 "타입을 입히는 것"이 아니라 "JS와 TS가 한 빌드 안에서 공존하게 만드는 것"이다. `allowJs`를 켜면 TypeScript 컴파일러가 `.js` 파일도 함께 처리하므로, 모든 파일을 한꺼번에 바꿀 필요 없이 점진적으로 옮길 토대가 생긴다. 이때 strict는 끈 채로 둔다.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

이 단계가 끝나면 "TypeScript가 프로젝트를 인식하고, 빌드는 여전히 초록불"인 상태가 된다. 여기서부터는 한 파일씩 옮겨도 전체가 멈추지 않는다.

## 2단계: 의존성 말단부터 변환

파일을 어떤 순서로 옮길지가 효율을 좌우한다. 정답은 **의존성 그래프의 말단(leaf)부터** 올라가는 것이다. 다른 파일에 의존하지 않는 유틸·상수·타입 정의 파일을 먼저 `.ts`로 바꾼다.

![말단부터 변환하는 이유](/assets/posts/ts-migration-strategy-order.svg)

이유는 추론의 전파에 있다. 말단 파일에 정확한 타입을 입히면, 그 파일을 import하는 상위 파일들은 별도 작업 없이도 더 나은 추론을 얻는다. 반대로 진입점(entry)부터 손대면, import하는 모듈들이 아직 `any`라서 타입이 위에서 끊겨 버린다. 아래에서 위로 올라가면 매 단계가 다음 단계를 도와준다.

```bash
# .js를 .ts로 개명 (의존성 말단부터)
git mv src/utils/format.js src/utils/format.ts
# 컴파일 → 드러나는 에러를 그 파일 범위에서 정리
```

당장 타입을 다 못 채우는 파일은 상단에 `// @ts-nocheck`를 붙여 검사에서 일시적으로 빼 둘 수 있다. 확장자만 `.ts`로 바꿔 두고 내용은 나중에 채우는 식이다. 이렇게 하면 "파일 개명"과 "타입 작성"을 분리해, 큰 PR을 작은 단위로 쪼갤 수 있다.

```typescript
// @ts-nocheck — 이 파일은 추후 타이핑 예정
// 우선 .ts로 옮겨만 두고 검사는 건너뜀
export function legacyHelper(a, b) {
  return a + b;
}
```

## 3~4단계: strict 강화와 완료

모든(또는 대부분의) 파일이 `.ts`가 되면, 이제 타입의 정밀도를 높일 차례다. `strict`를 한 번에 켜는 대신, 안에 든 플래그들(`noImplicitAny`, `strictNullChecks` 등)을 하나씩 켜며 그때그때 드러나는 에러를 정리한다. 이 점진적 strict 강화와 `any` 제거는 워낙 중요해서 각각 별도 글로 다룬다.

큰 코드베이스라면 변환 자체를 도와주는 도구도 있다. Airbnb의 `ts-migrate`는 `.js`를 `.ts`로 일괄 개명하고, 추론 가능한 부분에 타입을 채우며, 나머지에는 `@ts-expect-error`나 `any`를 자동으로 달아 "일단 컴파일되는 상태"를 만들어 준다. 완벽하진 않지만, 초기 대량 변환의 지루함을 크게 줄여 준다.

```bash
# ts-migrate로 폴더 단위 초기 변환
npx ts-migrate-full <project-path>
```

## 진행 상황을 측정하라

마이그레이션은 길게 이어지므로, "얼마나 왔는지"를 숫자로 보면 동력이 유지된다. 남은 `.js` 파일 수, 코드 내 `any`의 개수, `@ts-nocheck` 파일 수 같은 지표를 CI에서 추적하고, 이 숫자가 늘지 않도록(절대 후퇴하지 않도록) 가드를 거는 것이 좋다.

```bash
# 남은 자바스크립트 파일 수 추적
find src -name "*.js" | wc -l
# any 사용 추이 추적
grep -rn ": any" src | wc -l
```

## 정리

마이그레이션은 빅뱅이 아니라 단계적 전진이다. **빌드에 allowJs로 TypeScript를 연결하고, 의존성 말단부터 파일을 옮기며, `@ts-nocheck`로 큰 작업을 쪼개고, strict 플래그를 하나씩 켜다가, 마지막에 `any`를 제거하고 완전한 strict에 도달한다.** 언제나 빌드가 초록불인 상태를 유지하는 것이 핵심이며, 진행 지표를 측정해 후퇴를 막으면 끝까지 완주할 수 있다. 다음 글에서는 이 여정의 출발점인 `allowJs`와 `checkJs` 옵션을 자세히 들여다본다.

---

**지난 글:** [타입과 시맨틱 버저닝](/posts/ts-semantic-versioning-types/)

**다음 글:** [allowJs와 checkJs](/posts/ts-allowjs-checkjs/)

<br>
읽어주셔서 감사합니다. 😊
