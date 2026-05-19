---
title: "git filter-repo — 히스토리 완전 재작성"
description: "git filter-repo로 전체 커밋 히스토리에서 파일 삭제, 비밀 정보 제거, 서브디렉터리 추출까지 히스토리를 완전히 재작성하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "filter-repo", "히스토리 재작성", "비밀 정보 제거", "보안"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-drop-commit/)에서 `drop` 명령으로 특정 커밋을 삭제하는 방법을 살펴봤다. 이번에는 규모를 키워 **전체 히스토리에 걸쳐** 파일을 제거하거나 저장소를 재구성하는 `git filter-repo`를 다룬다. 과거에 실수로 커밋된 비밀번호, 불필요하게 커밋된 빌드 산출물, 모노레포 분리 작업에 사용한다.

## git filter-repo란

`git filter-repo`는 Git 공식 문서에서도 권장하는 히스토리 재작성 도구다. 과거 `git filter-branch`를 대체했으며, 속도와 안전성 모두 월등히 개선됐다. 기본 Git에 포함되지 않으므로 별도 설치가 필요하다.

```bash
# 설치 방법
pip install git-filter-repo

# macOS (Homebrew)
brew install git-filter-repo

# 버전 확인
git filter-repo --version
```

![filter-repo 주요 시나리오](/assets/posts/git-filter-repo-concept.svg)

## 파일·디렉터리 제거

특정 파일을 **모든 커밋**에서 제거한다.

```bash
# 단일 파일 제거
git filter-repo --path secrets.env --invert-paths

# 여러 파일 제거
git filter-repo --path secrets.env --path .env.production --invert-paths

# 디렉터리 제거
git filter-repo --path dist/ --invert-paths
git filter-repo --path vendor/ --invert-paths
```

`--invert-paths`는 "이 경로를 제외한 나머지를 남겨라"는 뜻이다. 이것 없이 `--path`만 쓰면 반대로 그 경로만 남기고 나머지를 지운다.

## 비밀 정보 제거

파일 자체를 지우는 것이 아니라 파일 내용 중 특정 문자열만 교체할 수도 있다.

```bash
# 파일 내 특정 문자열 교체
git filter-repo \
  --replace-text <(echo "ghp_XXXXXXXXXXXXXX==>REMOVED")

# 정규식으로 패턴 매칭
git filter-repo \
  --replace-text <(echo "regex:password=\S+==>password=REDACTED")
```

`--replace-text`는 텍스트 파일(바이너리 제외)에서 동작한다. 실제 비밀 노출 사고라면 키를 반드시 교체해야 하고, 히스토리 정리는 부가 조치다.

## 서브디렉터리 추출 — 모노레포 분리

```bash
# packages/core 디렉터리를 루트로 만들어 추출
git filter-repo --subdirectory-filter packages/core
```

이 명령 후엔 `packages/core` 안의 내용이 저장소 루트가 된다. 모노레포에서 패키지를 별도 저장소로 독립시킬 때 유용하다.

## 실전 워크플로

![filter-repo 실전 워크플로](/assets/posts/git-filter-repo-usage.svg)

```bash
# 1. 작업 디렉터리에 fresh clone
git clone --no-local my-repo my-repo-clean
cd my-repo-clean

# 2. filter-repo 실행
git filter-repo --path secrets.env --invert-paths

# 3. 원격 재설정
# filter-repo는 safety 차원에서 remote를 제거한다
git remote add origin git@github.com:org/repo.git

# 4. 모든 브랜치와 태그 force push
git push --force-with-lease --all origin
git push --force-with-lease --tags origin
```

`--no-local` 옵션으로 clone하면 filter-repo가 "이건 already clean"이라고 거부하는 상황을 방지한다.

## 주의: .gitignore에 추가도 잊지 않는다

히스토리에서 지웠어도 `.gitignore`에 추가하지 않으면 다시 커밋될 수 있다.

```bash
echo "secrets.env" >> .gitignore
echo ".env.production" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore 보안 파일 추가"
```

## GitHub cache 주의

GitHub에서 force push해도 pull request나 포크에서 이전 SHA를 통해 이전 내용에 잠시 접근할 수 있다. 비밀 노출이 확인됐다면:

1. GitHub 지원팀에 cache 삭제 요청
2. 해당 키·비밀번호 즉시 revoke 및 교체
3. `.gitignore`에 추가

히스토리 정리는 필요하지만 충분조건이 아니다.

---

**지난 글:** [git rebase -i — drop으로 커밋 삭제](/posts/git-rebase-drop-commit/)

**다음 글:** [BFG Repo-Cleaner — 대용량·비밀 파일 제거](/posts/git-bfg-cleaner/)

<br>
읽어주셔서 감사합니다. 😊
