---
title: "Bare 저장소란 무엇인가 — git clone --bare"
description: "작업 트리가 없는 Bare 저장소의 개념과 --bare, --mirror 옵션을 활용해 서버 허브나 백업 미러를 만드는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "clone", "bare", "mirror", "서버", "백업"]
featured: false
draft: false
---

[지난 글](/posts/git-clone-shallow/)에서 얕은 복제로 히스토리 일부만 받아오는 방법을 살펴봤다. 이번에는 **작업 트리(working tree)가 아예 없는 Bare 저장소**를 다룬다. 처음 들으면 생소하지만, GitHub 같은 원격 호스팅 플랫폼이나 자체 서버에서 저장소를 운영할 때 핵심이 되는 개념이다.

## Bare 저장소란

일반 저장소(`git init`)를 만들면 `.git/` 디렉터리와 작업 트리가 함께 생성된다. 반면 **Bare 저장소**는 `.git/` 내용물이 최상위 디렉터리에 바로 놓이고, 작업 트리가 존재하지 않는다. 파일을 직접 편집할 수 없고, `git checkout`도 할 수 없다. 대신 다른 클라이언트가 `push`하고 `fetch`하는 허브 역할에 최적화되어 있다.

관례적으로 Bare 저장소 이름에는 `.git` 확장자를 붙인다(`myproject.git`).

![일반 저장소 vs Bare 저장소 구조 비교](/assets/posts/git-clone-bare-structure.svg)

## --bare로 복제하기

```bash
# 원격 저장소를 bare로 복제
git clone --bare https://github.com/org/repo.git
# → repo.git/ 디렉터리가 생성됨

# 빈 bare 저장소 새로 만들기
git init --bare /srv/repos/myproject.git
```

`--bare`로 복제하면 원격의 refs가 `refs/heads/`, `refs/tags/` 등 그대로 매핑된다. 일반 복제와 달리 `origin` 리모트가 설정되지 않는다는 점이 차이다.

## 팀 서버에서 bare 활용

팀 내 공유 서버에 bare 저장소를 두고 각 개발자가 push/fetch하는 패턴이다.

```bash
# 서버에서 초기 설정
ssh user@server
git init --bare /srv/git/project.git

# 개발 머신에서 원격 추가
git remote add origin ssh://user@server/srv/git/project.git
git push -u origin main
```

이 구성은 GitHub 없이도 팀 내 Git 서버를 운영할 수 있다. Gitolite, Gitea 같은 셀프호스팅 도구들이 내부적으로 이 방식을 사용한다.

## --mirror: 완전 미러링

`--mirror`는 `--bare`의 상위 집합이다. 원격의 모든 refs(브랜치, 태그, 원격 추적 브랜치 등)를 포함해 복제하고, fetch refspec도 자동으로 구성해준다.

```bash
# 완전 미러 복제
git clone --mirror https://github.com/org/repo.git

# 미러 업데이트 (모든 변경 사항 동기화)
cd repo.git
git remote update
```

백업이나 사설 미러 서버 구축에 `--mirror`를 쓰면 원본과 동일한 상태를 유지하기 편하다.

![Bare 저장소 생성 및 활용 명령어](/assets/posts/git-clone-bare-commands.svg)

## Bare 저장소에서 할 수 있는 것과 없는 것

| 작업 | Bare 저장소 | 일반 저장소 |
|---|---|---|
| `git push` 수신 | ✓ | ✓ |
| `git fetch` 제공 | ✓ | ✓ |
| 파일 직접 편집 | ✗ | ✓ |
| `git checkout` | ✗ | ✓ |
| hooks 설정 | ✓ | ✓ |
| `git log` | ✓ | ✓ |

서버 측 hooks(`post-receive`, `update` 등)는 Bare 저장소에서도 완전히 동작한다. CI 트리거나 알림 발송에 활용할 수 있다.

## worktree로 필요할 때 파일 보기

Bare 저장소에서 파일 내용이 필요하다면 `git worktree`를 활용하면 된다.

```bash
# bare 저장소에 임시 worktree 연결
git worktree add /tmp/view-main main

# 파일 확인 후 제거
git worktree remove /tmp/view-main
```

이 방법으로 Bare 저장소를 유지하면서도 특정 시점의 파일을 체크아웃할 수 있다.

## 정리

Bare 저장소는 작업 트리 없이 Git 객체와 refs만 갖는 **push/fetch 허브 전용 저장소**다. 팀 내 서버, 백업 미러, 자동 배포 트리거 등 다양한 시나리오에서 핵심 역할을 한다. `--bare`는 허브 생성, `--mirror`는 완전 백업·동기화에 각각 적합하다.

---

**지난 글:** [얕은 복제로 빠르게 시작하기 — git clone --depth](/posts/git-clone-shallow/)

**다음 글:** [원격 추적 브랜치 이해하기](/posts/git-tracking-branches/)

<br>
읽어주셔서 감사합니다. 😊
