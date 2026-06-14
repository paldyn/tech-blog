---
title: "composite와 incremental — 증분 빌드의 기초"
description: "TypeScript의 incremental과 composite 옵션을 정리합니다. .tsbuildinfo로 증분 빌드를 구성하는 법, composite가 켜는 제약, 두 옵션의 관계와 프로젝트 참조로 이어지는 흐름을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "incremental", "composite", "tsconfig", "증분빌드", "tsbuildinfo"]
featured: false
draft: false
---

[지난 글](/posts/ts-isolated-modules/)에서 파일을 하나씩 빠르게 변환하기 위한 `isolatedModules` 제약을 다뤘다. 이번엔 빌드 속도를 다른 각도에서 공략한다. 코드베이스가 커지면 `tsc`가 매번 처음부터 전체를 다시 컴파일하는 비용이 무시할 수 없어진다. 대부분의 빌드에서는 사실 **몇 개 파일만** 바뀌는데 말이다. `incremental`과 `composite`는 "바뀐 것만 다시 한다"는 증분 빌드의 토대다.

## incremental: 빌드 상태를 기억한다

`incremental: true`를 켜면 `tsc`는 빌드가 끝날 때 **`.tsbuildinfo`** 라는 파일에 이번 빌드의 상태(어떤 파일이 어떻게 생겼는지, 의존 관계 등)를 저장한다. 다음 빌드에서 이 파일을 읽어, 바뀌지 않은 파일은 재컴파일을 건너뛴다.

![incremental 빌드가 .tsbuildinfo를 통해 변경분만 다시 빌드하는 흐름](/assets/posts/ts-composite-incremental-flow.svg)

첫 빌드는 여전히 전체를 컴파일하므로 느리다. 효과는 **두 번째 빌드부터** 나타난다. 변경된 파일과 그에 영향받는 파일만 다시 처리하므로, 큰 프로젝트에서 빌드 시간이 극적으로 줄어든다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsbuildinfo"
  }
}
```

`.tsbuildinfo`는 빌드 산출물이므로 **버전 관리에서 제외**(`.gitignore`)하는 것이 보통이다. CI 캐시에 포함시키면 CI에서도 증분 효과를 볼 수 있다. 위치는 `tsBuildInfoFile`로 바꿀 수 있는데, `outDir`이 깔끔하게 유지되도록 캐시 디렉터리로 빼두는 경우가 많다.

## composite: 더 엄격한 증분

`composite: true`는 `incremental`을 한 단계 더 밀어붙인 옵션이다. `composite`를 켜면 `incremental`이 **자동으로 켜지고**, 추가로 몇 가지 제약과 요구사항이 따라온다.

![incremental과 composite 설정 예시](/assets/posts/ts-composite-incremental-config.svg)

`composite: true`가 요구하는 대표적인 것들은 다음과 같다.

- `declaration: true` — 이 프로젝트가 내보내는 타입 선언(`.d.ts`)을 반드시 생성한다. 다른 프로젝트가 이 프로젝트를 참조할 때 그 `.d.ts`를 쓰기 때문이다.
- `rootDir`의 명확화 — 입력 파일의 루트가 분명해야 한다.
- 모든 입력 파일이 `include`/`files`로 명시적으로 포함되어야 한다.

왜 이런 제약이 붙을까? `composite`는 단순한 빌드 캐시를 넘어, 이 프로젝트를 **"다른 프로젝트가 의존할 수 있는 독립 단위"** 로 만들기 위한 옵션이기 때문이다. 즉 `composite`의 진짜 목적은 **프로젝트 참조(project references)** 다.

## 두 옵션의 관계

정리하면 이렇다. `incremental`은 "단일 프로젝트의 빌드를 빠르게 하는" 캐시이고, `composite`는 거기에 더해 "이 프로젝트를 다른 프로젝트가 참조 가능한 빌드 단위로 만드는" 옵션이다.

```text
incremental  → 같은 프로젝트의 재빌드를 빠르게
composite    → incremental + 참조 가능한 독립 단위로 승격
```

따라서 단일 패키지를 빠르게 빌드하고 싶을 뿐이라면 `incremental`만으로 충분하다. 모노레포처럼 여러 프로젝트가 서로 의존하는 구조에서 "변경된 패키지와 그에 의존하는 패키지만" 다시 빌드하고 싶다면 `composite`가 필요하다.

## --build 모드와의 짝

증분 빌드의 효과를 제대로 보려면 `tsc -b`(또는 `tsc --build`) 모드를 함께 쓰는 흐름이 자연스럽다. 일반 `tsc`도 `incremental`을 지원하지만, `tsc -b`는 `composite` 프로젝트들의 의존 순서를 계산해 **필요한 것만, 올바른 순서로** 빌드한다.

```bash
# 일반 컴파일 (incremental 캐시 활용)
tsc

# 빌드 모드 — composite/프로젝트 참조의 정석
tsc -b
```

`tsc -b`는 각 프로젝트의 `.tsbuildinfo`를 보고 "이 프로젝트는 변경이 없으니 건너뛴다"를 프로젝트 단위로 판단한다. 이 동작이 진가를 발휘하는 곳이 바로 다음 주제다.

`composite`로 프로젝트를 독립 단위로 만들 준비를 마쳤으니, 이제 그 단위들을 실제로 엮을 차례다. 다음 글에서 **프로젝트 참조(project references)** 로 모노레포의 빌드를 분할하고 의존 관계를 선언하는 법을 다룬다.

---

**지난 글:** [isolatedModules — 파일 단위 트랜스파일을 위한 제약](/posts/ts-isolated-modules/)

**다음 글:** [프로젝트 레퍼런스 — 모노레포를 위한 빌드 분할](/posts/ts-project-references/)

<br>
읽어주셔서 감사합니다. 😊
