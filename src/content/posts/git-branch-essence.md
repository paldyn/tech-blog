---
title: "브랜치의 본질: Git 브랜치가 가볍고 빠른 이유"
description: "Git 브랜치가 단순한 커밋 포인터(41바이트 파일)임을 이해하고, 왜 브랜치 생성과 전환이 SVN과 달리 순간적인지 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "브랜치", "포인터", "브랜치 본질", "HEAD"]
featured: false
draft: false
---

[지난 글](/posts/git-shortlog/)에서 기여자별 커밋을 요약하는 `git shortlog`를 다뤘다. 이번부터는 Git의 핵심 기능인 브랜치를 깊이 살펴본다. 브랜치를 자유롭게 다루려면 먼저 그 내부 구조를 이해해야 한다.

## 브랜치는 "포인터"다

Git에서 브랜치는 **특정 커밋 SHA-1 해시를 담은 41바이트 텍스트 파일**이다. 파일 시스템에는 `.git/refs/heads/` 아래에 브랜치 이름으로 저장된다.

```bash
# 브랜치 실체 확인
cat .git/refs/heads/main
# → c7d8e9f1234567890abcdef1234567890abcdef12
```

이것이 전부다. 커밋 객체나 파일 트리를 복사하는 것이 아니라, 특정 커밋을 가리키는 "이름표"만 추가한다.

![브랜치 = 커밋 포인터](/assets/posts/git-branch-essence-pointer.svg)

## 브랜치 생성이 순간적인 이유

SVN 같은 중앙 집중식 VCS에서 브랜치는 파일 트리 전체를 복사하는 비용이 든다. Git은 다르다.

```bash
# 수만 개의 커밋이 있어도 즉각 완료
git branch feature-login

# .git/refs/heads/feature-login 파일 1개가 생길 뿐
ls .git/refs/heads/
# main  feature-login
```

커밋 수와 무관하게 항상 O(1) — 파일 1개 쓰기다.

![브랜치 생성 전후 비교](/assets/posts/git-branch-essence-create.svg)

## HEAD: 현재 위치 표시자

`HEAD`는 현재 체크아웃된 브랜치(또는 커밋)를 가리키는 특별한 포인터다. 브랜치와 마찬가지로 파일 하나다.

```bash
cat .git/HEAD
# → ref: refs/heads/main

# main에 새 커밋을 만들면
# HEAD → main → 새 커밋 SHA-1 (자동 이동)
```

`git switch` 또는 `git checkout`으로 브랜치를 바꾸면 `.git/HEAD`의 내용이 교체된다. 커밋 히스토리는 전혀 건드리지 않는다.

## 브랜치 이동 원리

```bash
# feature 브랜치로 전환
git switch feature

cat .git/HEAD
# → ref: refs/heads/feature
```

체크아웃은 두 가지 일만 한다.

1. `.git/HEAD`를 대상 브랜치로 갱신
2. 워킹 트리를 그 브랜치의 최신 커밋 상태로 동기화

커밋 데이터 자체는 이동하지 않는다. `.git/objects/` 안의 커밋·트리·블롭 객체는 공유된다.

## 브랜치 삭제도 순간적

```bash
git branch -d feature-login
# .git/refs/heads/feature-login 파일 삭제 = 끝
```

커밋 객체는 그대로 남는다. 포인터만 없애는 것이어서, 삭제 후에도 SHA-1 해시를 알면 복구할 수 있다. 이 점은 `git reflog`와 함께 다룬다.

## 왜 자주 브랜치를 써야 하는가

| 항목 | Git 브랜치 |
|------|-----------|
| 생성 비용 | 거의 0 (파일 1개) |
| 삭제 비용 | 거의 0 |
| 전환 비용 | 워킹 트리 동기화만 |
| 격리 수준 | 완전 격리 |

비용이 없으니 실험적인 변경, 버그 수정, 기능 개발마다 각각 브랜치를 만드는 것이 권장된다. 이것이 Git 워크플로의 핵심이다.

---

**지난 글:** [git shortlog: 기여자별 커밋 통계 요약하기](/posts/git-shortlog/)

**다음 글:** [git branch: 브랜치 목록 조회와 생성](/posts/git-branch-list-create/)

<br>
읽어주셔서 감사합니다. 😊
