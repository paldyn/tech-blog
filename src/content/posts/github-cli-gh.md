---
title: "GitHub CLI(gh): 터미널에서 GitHub 다루기"
description: "gh CLI로 인증, PR 생성·확인·머지, 이슈 관리, 저장소 클론을 브라우저 없이 처리하는 법과 gh api·alias로 워크플로우를 확장하는 실무 패턴을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "gh", "CLI", "PullRequest", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/github-fork-pr-flow/)에서 fork와 Pull Request로 외부 저장소에 기여하는 흐름을 다뤘다. 그 과정에서 PR을 만들려면 매번 브라우저를 열어 변경 사항을 비교하고 폼을 채워야 했다. **GitHub CLI(`gh`)**는 이 모든 작업을 터미널에서 끝낼 수 있게 해주는 공식 명령줄 도구다. 코드를 작성하던 터미널을 벗어나지 않고 PR을 만들고, CI 상태를 확인하고, 리뷰를 남기고, 머지까지 처리할 수 있다.

`gh`는 `git`과 다르다. `git`은 로컬 저장소와 객체를 다루는 버전 관리 도구이고, `gh`는 GitHub라는 **플랫폼의 기능**(PR, 이슈, 액션, 릴리즈)을 다루는 도구다. 내부적으로 GitHub REST/GraphQL API를 호출하며, 인증 토큰을 안전하게 보관한 채로 명령을 중계한다.

![gh가 터미널과 GitHub를 잇는 구조](/assets/posts/github-cli-gh-overview.svg)

## 설치와 인증

대부분의 패키지 매니저로 설치할 수 있다.

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Debian/Ubuntu
sudo apt install gh
```

설치 후 가장 먼저 할 일은 인증이다. 대화형 프롬프트가 브라우저 기반 OAuth 또는 토큰 입력을 안내한다.

```bash
gh auth login
```

이 명령은 HTTPS/SSH 프로토콜 선택, 인증 방식, 토큰 저장까지 한 번에 처리한다. 인증이 끝나면 `gh`가 발급한 토큰이 git 자격 증명 헬퍼로도 등록되어, 이후 `git push`/`git pull`에서 별도 비밀번호 입력이 필요 없어진다. 현재 인증 상태는 다음으로 확인한다.

```bash
gh auth status
```

## PR 워크플로우를 터미널에서

`gh`의 진가는 PR 작업에서 드러난다. 기능 브랜치를 push한 뒤, 브라우저를 열지 않고 바로 PR을 만들 수 있다.

![gh pr 명령으로 진행하는 PR 흐름](/assets/posts/github-cli-gh-pr-flow.svg)

```bash
# 현재 브랜치를 base 브랜치 대상으로 PR 생성
gh pr create --title "결제 모듈 추가" --body "리뷰 부탁드립니다"

# 커밋 메시지로 제목/본문을 자동 채우고 웹에서 열기
gh pr create --fill --web
```

생성한 PR의 상태와 CI 결과는 다음으로 확인한다.

```bash
# 현재 브랜치에 연결된 PR 상태 요약
gh pr status

# CI 체크 결과 (실패 시 비정상 종료 코드 반환)
gh pr checks

# PR 목록 조회
gh pr list --state open
```

리뷰와 머지도 명령 한 줄이다. `--squash`, `--rebase`, `--merge`로 머지 방식을 고르고, `--delete-branch`로 머지 후 브랜치까지 정리한다.

```bash
gh pr review 42 --approve --body "LGTM"
gh pr merge 42 --squash --delete-branch
```

특정 PR을 로컬에서 직접 검토하고 싶을 때는 `gh pr checkout`이 해당 브랜치를 받아와 체크아웃해 준다. 포크에서 온 PR도 자동으로 처리된다.

```bash
gh pr checkout 42
```

## 이슈와 저장소 관리

PR뿐 아니라 이슈도 다룬다.

```bash
gh issue create --title "로그인 실패 버그" --label bug
gh issue list --assignee @me
gh issue close 17
```

저장소 자체를 다루는 명령도 있다. 클론 시 `owner/name` 축약형을 쓸 수 있어 전체 URL을 외울 필요가 없다.

```bash
gh repo clone cli/cli
gh repo create my-project --public --clone
gh repo view --web
```

## gh api와 alias로 확장하기

`gh`가 기본 명령으로 제공하지 않는 기능은 `gh api`로 직접 API를 호출해 메울 수 있다. 인증이 이미 처리되어 있으므로 토큰을 신경 쓸 필요가 없다.

```bash
# 저장소의 최근 워크플로우 실행 조회 (jq로 필터링)
gh api repos/cli/cli/actions/runs --jq '.workflow_runs[0].status'
```

자주 쓰는 명령 조합은 `gh alias`로 단축어를 만들어 둘 수 있다.

```bash
# gh prc 한 단어로 PR 생성 + 자동 채움
gh alias set prc 'pr create --fill'
```

이렇게 만든 alias는 설정에 저장되어 어느 저장소에서나 동작한다. 터미널 중심으로 일하는 개발자라면 `gh`를 익혀두는 것만으로 컨텍스트 전환 비용이 크게 줄어든다. 다음 글에서는 이렇게 관리하는 저장소를 정적 사이트로 배포하는 **GitHub Pages**를 다룬다.

---

**지난 글:** [Fork & Pull Request 워크플로우: 오픈소스 기여 흐름](/posts/github-fork-pr-flow/)

**다음 글:** [GitHub Pages: 정적 사이트 배포하기](/posts/github-pages-deploy/)

<br>
읽어주셔서 감사합니다. 😊
