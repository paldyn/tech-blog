---
title: "GitHub Actions로 PR 검사 자동화하기"
description: "PR마다 테스트·린트·빌드를 자동 실행해 머지 게이트로 삼는 방법, pull_request 트리거와 필수 상태 검사(required status checks) 연동, 매트릭스로 여러 환경을 병렬 검사하는 패턴, 그리고 검사 속도를 높이는 팁을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "GitHub Actions", "CI", "Pull Request", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/github-actions-basics/)에서 첫 워크플로우를 만들어 봤다. 이제 그 워크플로우를 PR 흐름에 단단히 묶을 차례다. 목표는 명확하다 — **검증되지 않은 변경이 main에 들어가지 못하게** 하는 것이다. PR이 열릴 때마다 테스트·린트·빌드를 자동으로 돌리고, 그 결과를 머지의 전제 조건으로 삼는다.

## pull_request 트리거로 검사 실행하기

PR 검사의 출발점은 `on: pull_request` 트리거다. PR이 열리거나 업데이트될 때마다 워크플로우가 실행된다.

```yaml
# .github/workflows/pr-check.yml
name: PR Check

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

이 워크플로우가 돌면 PR 화면 하단에 각 잡이 **체크(check)** 로 표시된다. 통과하면 초록 체크, 실패하면 빨간 X가 뜬다.

## 검사를 머지 게이트로 만들기

체크가 단순히 "표시"에 그치면 의미가 약하다. 실패한 채로도 머지가 가능하기 때문이다. 이를 강제하려면 브랜치 보호 규칙에서 **"Require status checks to pass before merging"** 을 켜고, 필수로 만들 체크를 선택한다.

![PR 검사가 머지를 게이팅한다](/assets/posts/github-actions-pr-checks-gate.svg)

이렇게 하면 지정한 검사가 모두 통과하기 전까지 머지 버튼이 비활성화된다. 함께 켜면 좋은 옵션이 하나 더 있다.

```text
- Require branches to be up to date before merging
  → PR 브랜치가 최신 main을 포함해야 머지 가능
  → "내 PR에선 통과했는데 머지하니 깨지는" 상황을 예방
```

다만 이 옵션은 PR이 많을 때 "main 갱신 → 재검사 → 머지" 사이클을 반복하게 만들 수 있어, 머지 큐(merge queue)와 함께 운영하는 팀도 많다.

## 매트릭스로 여러 환경 병렬 검사

라이브러리처럼 여러 런타임 버전을 지원해야 한다면, **매트릭스(matrix)** 로 같은 잡을 여러 조합으로 펼칠 수 있다.

![매트릭스로 검사를 펼치기](/assets/posts/github-actions-pr-checks-matrix.svg)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
```

각 조합은 독립된 러너에서 **동시에** 실행되므로, 세 버전을 순차로 도는 것보다 훨씬 빠르게 끝난다. `matrix.node` 변수가 각 잡에 다른 값으로 주입된다.

## 검사를 빠르고 효율적으로

PR 검사는 자주 도는 만큼 속도와 비용이 중요하다.

```yaml
# 변경된 경로에서만 검사 실행
on:
  pull_request:
    paths:
      - 'src/**'
      - 'package.json'

# 같은 PR에 새 푸시가 오면 이전 실행 취소
concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

- `cache: 'npm'`으로 의존성 캐싱 → 설치 시간 단축
- `paths` 필터로 무관한 변경에는 검사 생략
- `concurrency`로 중복 실행 취소 → 러너 시간 절약

이렇게 구성한 PR 검사는 코드 리뷰의 절반을 기계가 대신하게 해 준다. 사람은 로직과 설계에, 기계는 테스트·스타일·빌드 무결성에 집중하는 분업이 만들어진다. 다음 글에서는 코드 변경 이전 단계 — 할 일과 버그를 추적하는 **GitHub Issues** — 를 살펴본다.

---

**지난 글:** [GitHub Actions 기초: 워크플로우 자동화 첫걸음](/posts/github-actions-basics/)

**다음 글:** [GitHub Issues: 작업과 버그를 추적하는 법](/posts/github-issues/)

<br>
읽어주셔서 감사합니다. 😊
