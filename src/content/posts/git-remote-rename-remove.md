---
title: "원격 저장소 이름 변경과 삭제"
description: "git remote rename, git remote remove 명령어로 원격 저장소의 이름을 바꾸거나 삭제하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "remote", "git remote rename", "git remote remove", "set-url"]
featured: false
draft: false
---

[지난 글](/posts/git-remote-add/)에서 `git remote add`로 원격 저장소를 등록하는 방법을 살펴봤다. 등록 이후에도 이름이나 URL을 수정해야 하는 상황은 자주 생긴다. 저장소가 다른 조직으로 이전되거나, 포크한 프로젝트를 더 명확한 이름으로 관리하고 싶을 때가 그 예다. 이번 글에서는 `git remote rename`, `git remote remove`, `git remote set-url`을 다룬다.

## 원격 이름 변경: git remote rename

```bash
git remote rename <기존이름> <새이름>
```

이름을 바꾸면 `.git/config`의 섹션 제목이 변경되는 것은 물론, 해당 원격에 연결된 **모든 추적 브랜치 레퍼런스**도 자동으로 갱신된다. 예를 들어 `origin`을 `backup`으로 바꾸면 `refs/remotes/origin/*`가 `refs/remotes/backup/*`으로 일괄 이동된다.

```bash
# 예시: origin을 upstream으로 rename
git remote rename origin upstream

# 확인
git remote -v
# upstream  https://github.com/original/repo.git (fetch)
# upstream  https://github.com/original/repo.git (push)

# 로컬 브랜치의 추적 설정도 확인
git branch -vv
# main  abc1234 [upstream/main] ...
```

추적 브랜치 이름이 자동 변경되므로 기존에 설정해 둔 업스트림(tracking) 관계가 끊기지 않는다. 단, `push.default`가 `upstream`으로 설정돼 있고 이름을 `upstream`으로 변경하면 혼동이 생길 수 있으므로 주의한다.

![rename/remove 전후 .git/config 변화](/assets/posts/git-remote-rename-remove-before-after.svg)

## 원격 URL 변경: git remote set-url

이름은 유지하면서 접속 URL만 바꿀 때 사용한다. 대표적인 사례가 HTTPS ↔ SSH 전환이다.

```bash
# HTTPS → SSH 전환
git remote set-url origin git@github.com:user/repo.git

# SSH → HTTPS 전환
git remote set-url origin https://github.com/user/repo.git

# 변경 확인
git remote -v
```

저장소가 GitHub에서 다른 호스팅 서비스로 이전됐을 때도 `set-url`로 URL만 갱신하면 된다. 로컬 커밋 히스토리와 추적 브랜치는 그대로 유지된다.

**push URL만 별도로 설정하는 경우:**

```bash
# fetch는 읽기 전용 미러, push는 본 저장소로
git remote set-url --push origin git@github.com:user/repo.git
```

fetch URL과 push URL이 다른 경우 `git remote -v`에서 각각 별도 줄로 표시된다.

## 원격 삭제: git remote remove

```bash
git remote remove <이름>
# 또는 단축형:
git remote rm <이름>
```

`git remote remove`는 `.git/config`에서 해당 섹션을 제거하고, 로컬에 저장된 **원격 추적 브랜치(`refs/remotes/<이름>/*`)도 함께 삭제**한다. 로컬 브랜치나 커밋 데이터는 건드리지 않는다.

```bash
# upstream 원격 삭제
git remote remove upstream

# 삭제 확인
git remote -v
# (upstream이 더 이상 보이지 않음)

# upstream을 추적하던 브랜치 목록도 사라짐
git branch -r
# (origin/* 만 남음)
```

삭제 후 해당 원격을 추적하던 로컬 브랜치에 `git pull`을 시도하면 "no tracking information" 오류가 발생한다. `git branch --set-upstream-to`로 다른 원격 브랜치에 재연결하거나 추적 설정을 제거해야 한다.

![rename/remove 주요 명령 모음](/assets/posts/git-remote-rename-remove-commands.svg)

## git remote show로 상세 정보 확인

원격 조작 전후에 현재 상태를 파악할 때 유용한 명령이다.

```bash
git remote show origin
```

출력 예시:

```
* remote origin
  Fetch URL: git@github.com:user/repo.git
  Push  URL: git@github.com:user/repo.git
  HEAD branch: main
  Remote branches:
    develop tracked
    main    tracked
  Local branches configured for 'git pull':
    main merges with remote main
  Local refs configured for 'git push':
    main pushes to main (up to date)
```

추적 브랜치 상태, HEAD 브랜치, push·pull 설정을 한눈에 볼 수 있어 원격 이름이나 URL을 변경하기 전 현재 상태를 점검하는 데 적합하다.

## 흔한 실수와 주의사항

**이름 충돌**: 이미 존재하는 이름으로 rename하면 오류가 발생한다.

```bash
git remote rename origin origin  # 에러
git remote rename origin backup  # backup이 이미 있으면 에러
```

**삭제 후 추적 브랜치 정리**: `git remote remove` 후에도 로컬 브랜치 목록에는 사라진 원격을 참조하는 브랜치가 남아 있을 수 있다. `git branch -vv`로 `[gone]` 표시를 확인하고, 필요 없으면 삭제한다.

```bash
# gone 상태인 로컬 브랜치 찾기
git branch -vv | grep '\[gone\]'
# 해당 브랜치 삭제
git branch -d feature/old
```

## 정리

`git remote rename`은 이름만, `git remote set-url`은 URL만 바꾼다. `git remote remove`는 설정과 추적 브랜치를 모두 지운다. 세 명령 모두 **로컬 커밋과 워킹 트리에는 영향을 주지 않으므로** 안심하고 사용할 수 있다.

---

**지난 글:** [git remote add — 원격 저장소 추가하기](/posts/git-remote-add/)

**다음 글:** [fetch와 pull의 차이 — 안전하게 동기화하기](/posts/git-fetch-vs-pull/)

<br>
읽어주셔서 감사합니다. 😊
