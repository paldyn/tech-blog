---
title: "전역 gitignore: 모든 저장소에 적용되는 무시 규칙"
description: "core.excludesFile로 전역 gitignore를 설정해 IDE 파일, OS 메타데이터 같은 개인 도구 파일을 모든 저장소에서 자동으로 제외하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "gitignore", "global", "core.excludesFile", "개인설정", ".DS_Store"]
featured: false
draft: false
---

[지난 글](/posts/git-gitignore-patterns/)에서 `.gitignore` 패턴 문법을 익혔다. 이번에는 저장소마다 반복해서 작성하지 않아도 되는 **전역 gitignore** 설정을 알아본다.

## 왜 전역 gitignore가 필요한가

팀 저장소의 `.gitignore`에 `.DS_Store`나 `.idea/` 같은 개인 도구 파일을 추가하면 문제가 생긴다. macOS를 사용하지 않는 팀원에게는 의미 없는 규칙이 쌓이고, IDE가 다른 팀원의 패턴도 추가해야 한다. 결국 `.gitignore`가 거대해지고 관리가 어려워진다.

해결책은 **개인 환경에 종속된 패턴은 전역 gitignore에, 프로젝트에 종속된 패턴은 저장소 `.gitignore`에** 각각 분리하는 것이다.

## gitignore 계층 구조

![gitignore 범위별 계층 구조](/assets/posts/git-gitignore-global-hierarchy.svg)

| 파일 | 범위 | 공유 여부 |
|---|---|---|
| `~/.config/git/ignore` | 내 모든 저장소 | 개인 |
| `<저장소>/.gitignore` | 이 저장소 | 팀 공유 (커밋됨) |
| `.git/info/exclude` | 이 저장소 | 개인 (커밋 안 됨) |

## 전역 gitignore 설정

![전역 gitignore 설정 방법](/assets/posts/git-gitignore-global-setup.svg)

기본 경로는 `~/.config/git/ignore`다. 다른 경로를 원한다면 `core.excludesFile`로 지정한다.

```bash
# 방법 1: 기본 경로 사용 (별도 설정 불필요)
mkdir -p ~/.config/git
touch ~/.config/git/ignore

# 방법 2: 커스텀 경로 지정
git config --global core.excludesFile ~/.gitignore_global

# 현재 설정 확인
git config --global core.excludesFile
```

## 전역 gitignore 내용

```
# ====== macOS ======
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
.AppleDouble
.LSOverride

# ====== Windows ======
Thumbs.db
ehthumbs.db
Desktop.ini
$RECYCLE.BIN/

# ====== Linux ======
*~
.nfs*

# ====== JetBrains IDE ======
.idea/
*.iml
*.iws
*.ipr

# ====== VS Code ======
.vscode/
*.code-workspace

# ====== Vim / Emacs ======
*.swp
*.swo
*.bak
\#*\#
.#*

# ====== 기타 도구 ======
.direnv/
.envrc
.tool-versions
.node-version
```

## .git/info/exclude: 저장소 로컬 무시

전역 설정보다 더 좁은 범위로 특정 저장소에서만 개인적으로 무시할 파일을 지정한다.

```bash
# 저장소 루트에서
cat >> .git/info/exclude << 'EOF'
# 내가 임시로 쓰는 파일
scratch.md
my-debug-config.json
local-test/
EOF
```

`.git/info/exclude`는 커밋되지 않으므로 팀원에게 영향을 주지 않는다.

## 전역 vs 저장소 분리 원칙

팀 `.gitignore`에 넣어야 할 것:
- 프로젝트 빌드 결과물 (`dist/`, `build/`, `*.class`)
- 패키지 디렉터리 (`node_modules/`, `vendor/`)
- 언어 캐시 (`__pycache__/`, `.pytest_cache/`)
- 환경 변수 파일 (`.env`, `.env.local`)
- 프레임워크 생성 파일

전역 gitignore에 넣어야 할 것:
- OS 메타데이터 (`.DS_Store`, `Thumbs.db`)
- IDE/에디터 설정 (`.idea/`, `.vscode/`, `*.swp`)
- 개인 작업 파일 (`scratch.*`, `notes.md`)

## 검증

```bash
# 전역 설정이 제대로 동작하는지 확인
touch test-ignore-check.DS_Store
git check-ignore -v test-ignore-check.DS_Store
# 전역 gitignore 경로:1:... test-ignore-check.DS_Store
rm test-ignore-check.DS_Store
```

---

**지난 글:** [.gitignore 패턴 문법 완전 정복](/posts/git-gitignore-patterns/)

**다음 글:** [빈 디렉터리 Git에서 유지하기](/posts/git-keep-empty-dir/)

<br>
읽어주셔서 감사합니다. 😊
