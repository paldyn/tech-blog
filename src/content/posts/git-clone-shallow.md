---
title: "얕은 복제로 빠르게 시작하기 — git clone --depth"
description: "git clone --depth 옵션으로 히스토리 일부만 내려받아 복제 속도를 크게 단축하는 방법과 활용 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "clone", "shallow", "depth", "CI/CD", "대형 저장소"]
featured: false
draft: false
---

[지난 글](/posts/git-push-delete-remote/)에서 원격 브랜치와 태그를 삭제하는 방법을 살펴봤다. 이번에는 반대로 처음 저장소를 받아올 때 히스토리 전체가 아닌 최근 N개 커밋만 내려받는 **얕은 복제(shallow clone)**를 다룬다. 수만 개의 커밋이 쌓인 대형 오픈소스 프로젝트를 처음 다운로드할 때, 혹은 CI 파이프라인에서 매 빌드마다 `git clone`을 수행할 때 얕은 복제는 시간과 디스크 용량을 극적으로 줄여준다.

## --depth 옵션의 동작 원리

`git clone --depth <n>` 은 원격 저장소에서 HEAD를 기준으로 최근 N개의 커밋 객체만 전송받는다. 그보다 오래된 커밋은 로컬에 존재하지 않는다. Git은 이 단절 지점을 **shallow commit**으로 표시하여, 히스토리 탐색 시 해당 지점 이전이 없다고 처리한다.

```bash
# 최근 1개 커밋만 복제 (CI에 가장 흔히 사용)
git clone --depth 1 https://github.com/org/repo.git

# 최근 5개 커밋 복제
git clone --depth 5 https://github.com/org/repo.git
```

`depth 1`은 HEAD 커밋 하나만 가져오기 때문에 저장소 크기를 수십 MB에서 수백 KB로 줄이는 경우도 드물지 않다. 단, **`git log`로 볼 수 있는 커밋이 그 수만큼만 보인다**는 점을 기억해야 한다.

![전체 복제 vs 얕은 복제](/assets/posts/git-clone-shallow-depth.svg)

## 특정 브랜치만 받기

`--single-branch`를 함께 사용하면 다른 원격 브랜치 정보를 아예 받지 않아 용량을 더 줄일 수 있다.

```bash
# main 브랜치만, 최근 1개 커밋으로 복제
git clone --depth 1 --branch main --single-branch \
  https://github.com/org/repo.git
```

GitHub Actions의 `actions/checkout` 액션이 기본으로 `fetch-depth: 1`을 사용하는 이유가 바로 이 패턴이다. 빌드·테스트 목적으로는 최신 코드만 있으면 충분하다.

## 히스토리 나중에 채우기

처음에는 얕게 받았지만 나중에 `git log`나 `git blame` 등으로 전체 히스토리가 필요해지면 그 자리에서 확장할 수 있다.

```bash
# N개 커밋 더 추가
git fetch --deepen 20

# 전체 히스토리 복원 (완전한 저장소로 전환)
git fetch --unshallow
```

`--unshallow`를 실행하면 이후부터는 일반 저장소와 동일하게 동작한다. CI 환경에서 `git blame` 단계나 변경 이력 분석 단계에 도달했을 때만 `--unshallow`를 실행하는 전략도 자주 쓰인다.

## 얕은 복제의 제한 사항

```bash
# 주의: 얕은 저장소에서 rebase 시 이슈 발생 가능
git rebase origin/main  # shallow boundary에서 충돌할 수 있음

# tag 참조도 일부 누락될 수 있음
git describe  # 오래된 태그를 찾지 못할 수 있음
```

얕은 복제는 **빌드·테스트 목적**에는 최적이지만, 이력 기반 작업(rebase, describe, bisect)에는 제한이 있다. 개발 작업 중에는 가급적 완전한 복제를 사용하고, 얕은 복제는 CI/CD 환경에서 시간 단축 목적으로 활용하는 것이 원칙이다.

## CI/CD 실전 패턴

GitHub Actions 기준 예시다.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1        # 기본값, 얕은 복제

# 변경 이력이 필요한 단계에서만 unshallow
- run: git fetch --unshallow
  if: steps.need_history.outputs.required == 'true'
```

GitLab CI에서는 `GIT_DEPTH: 1` 변수를 `.gitlab-ci.yml`에 설정하면 같은 효과를 얻는다.

![얕은 복제 주요 명령어](/assets/posts/git-clone-shallow-commands.svg)

## 정리

`git clone --depth 1`은 대형 저장소나 CI 환경에서 복제 시간을 대폭 줄여주는 강력한 옵션이다. 나중에 히스토리가 필요해지면 `--deepen`이나 `--unshallow`로 언제든지 채울 수 있으므로, 처음부터 전체를 받아야 한다는 부담을 가질 필요가 없다. 단, `rebase`나 `describe` 같은 이력 기반 작업이 포함된 워크플로에서는 제한이 생기므로 사용 목적을 먼저 파악하고 적용한다.

---

**다음 글:** [Bare 저장소란 무엇인가 — git clone --bare](/posts/git-clone-bare/)

<br>
읽어주셔서 감사합니다. 😊
