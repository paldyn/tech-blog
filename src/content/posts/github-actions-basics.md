---
title: "GitHub Actions 기초: 워크플로우 자동화 첫걸음"
description: "GitHub Actions의 핵심 개념(워크플로우·이벤트·잡·스텝·액션), YAML 워크플로우 파일의 구조와 위치, 첫 CI 워크플로우 작성, 그리고 실행 결과를 확인하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "GitHub Actions", "CI/CD", "자동화", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/github-codeowners/)에서 CODEOWNERS로 리뷰어를 자동 배정하는 법을 다뤘다. 사람이 리뷰를 자동화했다면, 이제 기계가 할 수 있는 검증 — 테스트·린트·빌드 — 도 자동화할 차례다. **GitHub Actions**는 저장소에서 일어나는 이벤트(push, PR 등)에 반응해 워크플로우를 실행하는 GitHub 내장 CI/CD 도구다. 별도 서버 없이 저장소 안의 YAML 파일 하나로 시작할 수 있다.

## 핵심 개념 다섯 가지

Actions를 이해하려면 다섯 단어의 관계를 알면 된다.

- **Event(이벤트)**: 워크플로우를 깨우는 방아쇠. `push`, `pull_request`, `schedule` 등
- **Workflow(워크플로우)**: 이벤트에 반응해 실행되는 자동화 단위. YAML 파일 하나가 워크플로우 하나
- **Job(잡)**: 워크플로우 안의 작업 묶음. 각 잡은 독립된 가상 머신(runner)에서 실행
- **Step(스텝)**: 잡 안에서 순서대로 실행되는 명령 하나
- **Action(액션)**: 스텝에서 재사용하는 패키지된 작업 (예: `actions/checkout`)

![Workflow의 구조](/assets/posts/github-actions-basics-anatomy.svg)

잡들은 기본적으로 **병렬**로 실행되고, 잡 안의 스텝들은 **순차**로 실행된다. 잡 사이에 순서가 필요하면 `needs` 키워드로 의존 관계를 건다.

## 첫 워크플로우 만들기

워크플로우 파일은 반드시 `.github/workflows/` 디렉터리 안에 둬야 한다. 파일 이름은 자유지만 `.yml` 또는 `.yaml` 확장자를 쓴다.

![워크플로우 YAML 한눈에 보기](/assets/posts/github-actions-basics-yaml.svg)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

각 부분을 읽어 보자.

- `on`: 언제 실행할지 — `main`에 push되거나 PR이 열릴 때
- `runs-on`: 어떤 환경에서 — GitHub이 제공하는 Ubuntu 가상 머신
- `steps`: 무엇을 — 코드를 체크아웃하고, Node를 설치하고, 의존성 설치 후 테스트
- `uses`: 미리 만들어진 액션을 가져다 쓴다 (`@v4`로 버전 고정)
- `run`: 셸 명령을 직접 실행한다

이 파일을 커밋해 push하면 GitHub이 자동으로 인식하고 워크플로우를 실행한다.

## 실행 결과 확인하기

워크플로우가 돌면 저장소의 **Actions 탭**에서 실행 기록과 각 스텝의 로그를 볼 수 있다. CLI로도 확인할 수 있다.

```bash
# 최근 워크플로우 실행 목록
gh run list

# 특정 실행의 상세 로그
gh run view 1234567 --log

# 실패한 실행을 다시 실행
gh run rerun 1234567
```

스텝 중 하나라도 실패하면(0이 아닌 종료 코드) 잡이 실패로 표시되고, 이후 스텝은 기본적으로 건너뛴다. PR에서는 이 결과가 체크(check)로 표시되어, 브랜치 보호와 연동하면 통과 전까지 머지를 막을 수 있다.

```yaml
# 환경 변수와 조건부 실행 예시
- name: Deploy
  if: github.ref == 'refs/heads/main'
  run: ./deploy.sh
  env:
    NODE_ENV: production
```

Actions의 표현력은 훨씬 넓다 — 매트릭스 빌드, 캐시, 시크릿, 아티팩트, 재사용 워크플로우 등. 하지만 출발점은 언제나 위처럼 작은 CI 워크플로우 하나다. 다음 글에서는 이 워크플로우를 **PR 검사**로 연결해, 변경마다 자동으로 품질 게이트를 거치게 만드는 법을 살펴본다.

---

**지난 글:** [CODEOWNERS: 코드 영역별 자동 리뷰어 지정](/posts/github-codeowners/)

**다음 글:** [GitHub Actions로 PR 검사 자동화하기](/posts/github-actions-pr-checks/)

<br>
읽어주셔서 감사합니다. 😊
