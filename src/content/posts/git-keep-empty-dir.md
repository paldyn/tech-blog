---
title: "Git에서 빈 디렉터리 유지하기: .gitkeep과 .gitignore 활용"
description: "Git이 빈 디렉터리를 추적하지 않는 이유와 .gitkeep 관례, .gitignore 패턴을 이용해 디렉터리 구조를 저장소에 보존하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "gitkeep", "empty-directory", "gitignore", "디렉터리"]
featured: false
draft: false
---

[지난 글](/posts/git-gitignore-global/)에서 전역 gitignore 설정을 알아봤다. 이번에는 Git이 왜 빈 디렉터리를 추적하지 않는지와 디렉터리 구조를 저장소에 보존하는 두 가지 방법을 살펴본다.

## 왜 Git은 빈 디렉터리를 무시하는가

Git은 **파일의 내용을 추적**하지, 디렉터리 자체를 추적하지 않는다. 내부 오브젝트 모델에서 디렉터리는 `tree` 오브젝트로 표현되는데, tree는 최소 하나의 `blob`(파일) 또는 하위 `tree`를 포함해야 한다. 내용이 없는 tree는 저장되지 않는다.

따라서 `git add src/empty-dir/`를 실행해도 해당 디렉터리는 스테이징되지 않으며 커밋에도 포함되지 않는다.

![Git은 빈 디렉터리를 추적하지 않는다](/assets/posts/git-keep-empty-dir-concept.svg)

## 언제 빈 디렉터리가 필요한가

빈 디렉터리를 유지해야 하는 상황은 생각보다 많다.

- 프로젝트 구조를 미리 잡아두고 싶을 때 (`uploads/`, `logs/`, `tmp/`)
- 프레임워크가 특정 경로 존재를 요구할 때
- CI 환경에서 빌드 출력 디렉터리가 미리 있어야 할 때
- 팀원이 클론 후 즉시 작업 가능한 구조를 유지하고 싶을 때

## 해결법 1: .gitkeep 관례

가장 널리 쓰이는 방법이다. 디렉터리에 빈 `.gitkeep` 파일을 넣어두면 Git이 해당 디렉터리를 추적한다.

```bash
# 단일 디렉터리
touch src/assets/.gitkeep

# 여러 디렉터리 한 번에
mkdir -p uploads logs tmp
touch uploads/.gitkeep logs/.gitkeep tmp/.gitkeep

# 커밋
git add .
git commit -m "chore: add .gitkeep to preserve directory structure"
```

`.gitkeep`은 Git 공식 파일 이름이 아니다. `.placeholder`, `.keep`, `.githold` 등 팀에서 원하는 이름을 써도 된다. 다만 `.gitkeep`이 가장 널리 사용되는 관례이므로 특별한 이유가 없으면 이것을 쓴다.

파일에 실제 내용을 넣어두는 팀도 있다.

```
# This file exists only to preserve this directory in git.
# Do not commit any files here.
```

## 해결법 2: .gitignore 방식

디렉터리 안에 파일이 생기더라도 저장소에는 포함하고 싶지 않을 때 유용하다. `.gitignore` 파일 자체가 디렉터리를 유지하는 역할을 한다.

![빈 디렉터리 유지 방법 비교](/assets/posts/git-keep-empty-dir-solutions.svg)

```bash
# src/uploads/.gitignore 생성
cat > src/uploads/.gitignore << 'EOF'
# uploads 아래 모든 파일 무시 (이 파일 제외)
*
!.gitignore
EOF
```

이 방식은 `uploads/` 디렉터리가 생성되고, 하위에 어떤 파일이 생기든 Git이 추적하지 않지만 디렉터리 자체는 유지된다. 사용자가 업로드한 파일이나 빌드 결과물이 들어가는 폴더에 적합하다.

## 방법 선택 기준

```bash
# 상황별 권장
# 1. 빈 구조 폴더 (콘텐츠 나중에 추가 예정)
touch logs/.gitkeep
touch config/environments/.gitkeep

# 2. 런타임 생성 파일 폴더 (절대 커밋 안 됨)
# tmp/.gitignore 내용:
# *
# !.gitignore

# 3. 선택적 무시 (일부 파일만 추적)
# data/.gitignore 내용:
# *.csv
# !sample.csv
# !.gitignore
```

| 상황 | 권장 방법 |
|---|---|
| 빈 구조를 문서화하고 싶다 | `.gitkeep` |
| 디렉터리 내 파일을 모두 무시하고 싶다 | `.gitignore` (`* + !.gitignore`) |
| 일부 파일만 무시하고 싶다 | `.gitignore` (부정 패턴 활용) |

## .gitkeep 자동화

여러 디렉터리에 `.gitkeep`을 추가할 때 `find`를 활용한다.

```bash
# 저장소 내 빈 디렉터리 찾아 .gitkeep 추가
find . -type d -empty -not -path "./.git/*" \
  -exec touch {}/.gitkeep \;

# 결과 확인
git status
```

---

**지난 글:** [전역 gitignore 설정](/posts/git-gitignore-global/)

**다음 글:** [Git 줄 끝 변환 처리](/posts/git-eol-conversion/)

<br>
읽어주셔서 감사합니다. 😊
