---
title: "커밋 객체 해부: 내부 구조를 손으로 뜯어보기"
description: "git cat-file로 커밋 객체를 직접 열어보며, tree·parent·author·committer 각 필드가 무엇을 의미하는지 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "커밋", "git cat-file", "커밋 객체", "SHA-1"]
featured: false
draft: false
---

[지난 글](/posts/git-first-commit/)에서 첫 커밋을 만들어 봤다. 이번에는 그 커밋이 내부적으로 어떻게 생겼는지 실제로 열어본다. `git cat-file` 명령 하나로 Git의 블랙박스 안을 들여다볼 수 있다.

## 커밋 객체를 직접 열어보기

```bash
git cat-file -p HEAD
```

출력 예시:

```
tree b2c4e8f9da3a71e5c8d0f2b3a4c5d6e7f8a9b0c1
parent 7f1e3c2a8b4d6e0f1a2b3c4d5e6f7a8b9c0d1e2
author PALDYN <dev@paldyn.com> 1746748800 +0900
committer PALDYN <dev@paldyn.com> 1746748800 +0900

feat: add user authentication
```

각 줄이 의미하는 바를 하나씩 해석한다.

## tree 필드

```bash
git cat-file -p b2c4e8f9da
# 100644 blob 3e4a5b6c... README.md
# 100644 blob 9f8e7d6c... src/index.js
# 040000 tree a1b2c3d4... src
```

`tree`는 그 커밋 시점의 **디렉터리 전체 스냅샷**이다. 트리 객체는 파일 이름과 blob 해시의 매핑을 담고 있으며, 하위 디렉터리는 또 다른 트리 객체를 가리킨다. 커밋을 체크아웃하면 Git은 이 트리를 따라가 모든 파일을 복원한다.

![커밋 객체 내부 구조](/assets/posts/git-commit-anatomy-structure.svg)

## parent 필드

대부분의 커밋은 `parent`가 하나다. 예외는 두 가지다.

- **루트 커밋**: `parent` 줄 자체가 없다.
- **병합 커밋**: `parent`가 두 줄 이상 나온다.

```bash
# 병합 커밋 예시
git cat-file -p abc1234
# tree ...
# parent def5678   ← 메인 브랜치
# parent 9ab0123   ← 병합된 브랜치
# author ...
```

`parent`는 Git 히스토리를 방향성 비순환 그래프(DAG)로 만든다. 이 구조 덕분에 `git log`는 최신 커밋에서 뒤로 거슬러 올라가며 전체 역사를 추적할 수 있다.

## author vs committer

두 필드는 이름·이메일·Unix 타임스탬프·타임존 오프셋으로 구성된다.

| 필드 | 의미 |
|------|------|
| `author` | 코드를 **처음 작성한** 사람과 그 시각 |
| `committer` | 저장소에 **최종 기록한** 사람과 그 시각 |

```bash
git log --format="%H %an / %cn"
# a3f9d21 Alice / Bob
```

`git rebase` 이후에는 author는 원 작성자가 유지되지만 committer는 rebase를 실행한 사람으로 바뀐다. `git cherry-pick`도 마찬가지다. 오픈소스 프로젝트에서 패치를 메인테이너가 적용할 때 이 구분이 실제로 사용된다.

## 타임스탬프의 구조

```
1746748800 +0900
```

- `1746748800`: Unix 에포크(1970-01-01 00:00:00 UTC)부터의 초
- `+0900`: 작성자 로컬 타임존

Git은 항상 UTC로 저장하고 타임존을 별도 기록한다. `git log`가 날짜를 표시할 때는 이 두 값을 조합한다.

## SHA-1 해시의 결정 방식

커밋의 해시는 커밋 객체 전체 내용(헤더 포함)을 SHA-1로 계산한 결과다.

```bash
# 직접 확인
git cat-file commit HEAD | sha1sum
# (결과가 git rev-parse HEAD와 동일)
```

`author`, `committer`, `tree`, `parent`, 메시지 중 어느 하나라도 1바이트 다르면 완전히 다른 해시가 된다. 이것이 Git의 무결성 보장 원리다.

![커밋 체인과 HEAD](/assets/posts/git-commit-anatomy-chain.svg)

## 커밋 객체는 불변이다

커밋 객체는 생성 후 수정할 수 없다. `git commit --amend`는 커밋을 수정하는 것이 아니라 **새로운 커밋 객체를 만들고** 브랜치 포인터를 새 객체로 옮기는 것이다. 기존 커밋은 그대로 `.git/objects/`에 남아 있다(나중에 가비지 컬렉션으로 정리될 때까지).

이 불변성이 Git의 신뢰성 근거다. 커밋 해시를 공유하면 상대방이 같은 내용의 커밋을 가지고 있음을 보장할 수 있다.

## 실습: 내 커밋 모두 뜯어보기

```bash
# 최근 5개 커밋의 원시 내용 출력
git log --oneline -5 | awk '{print $1}' | while read h; do
  echo "=== $h ==="
  git cat-file -p $h
  echo
done
```

이 출력을 한 번 읽어보면 Git 히스토리가 실제로 어떻게 연결되어 있는지 눈으로 확인할 수 있다.

---

**지난 글:** [첫 번째 커밋: 변경을 역사에 새기는 순간](/posts/git-first-commit/)

**다음 글:** [커밋 메시지 컨벤션: 좋은 커밋 메시지의 조건](/posts/git-commit-message-conventions/)

<br>
읽어주셔서 감사합니다. 😊
