---
title: "태그 push — 로컬 태그를 원격에 올리기"
description: "git push로 태그를 원격 저장소에 올리는 방법과 --tags, --follow-tags 옵션 차이를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "push", "annotated tag", "릴리스"]
featured: false
draft: false
---

[지난 글](/posts/git-push-force-with-lease/)에서 `--force-with-lease`로 안전하게 force push하는 방법을 다뤘다. 이번에는 **태그(tag) push**를 살펴본다. `git push`는 기본적으로 태그를 원격에 올리지 않는다. 이 동작을 제대로 이해하지 못하면 릴리스 태그를 로컬에만 만들고 원격에는 없는 상황이 생긴다.

## 태그는 자동으로 push되지 않는다

```bash
# 태그 생성 (주석 태그)
git tag -a v1.0.0 -m "First stable release"

# 일반 push로는 태그가 원격에 올라가지 않음
git push origin main
# 태그 없음!

# 원격 태그 확인
git ls-remote --tags origin
# (비어 있음)
```

이 동작은 의도적인 설계다. 실험적 태그나 로컬 전용 태그를 원격에 올리지 않도록 개발자가 명시적으로 선택하게 한다.

## 단일 태그 push

특정 태그 하나만 원격에 올리는 가장 기본적인 방법이다.

```bash
git push origin v1.0.0
```

이 형식은 일반 브랜치 push와 동일하다. Git이 `v1.0.0`을 태그로 인식하고 `refs/tags/v1.0.0`을 원격에 전송한다.

## 모든 태그 push: --tags

```bash
# 로컬의 모든 태그를 원격에 올림
git push origin --tags
```

`--tags`는 주석 태그(annotated tag)와 경량 태그(lightweight tag) 모두를 포함한다. 원격에 이미 있는 태그는 건너뛴다. 한꺼번에 태그를 동기화할 때 유용하다.

단점: 실험적으로 만든 로컬 전용 태그까지 모두 올라간다. 공개 저장소에서는 불필요한 태그가 노출될 수 있다.

![태그 push 3가지 방법 비교](/assets/posts/git-push-tags-methods.svg)

## 커밋 연관 태그만 push: --follow-tags

```bash
git push --follow-tags origin main
```

`--follow-tags`는 **현재 push하는 커밋들에 직접 연결된 주석 태그**만 선별하여 함께 전송한다. 경량 태그는 포함되지 않는다.

릴리스 워크플로에서 가장 적합한 옵션이다. 새 커밋을 push할 때 그 커밋의 릴리스 태그가 함께 올라가고, 관련 없는 태그는 포함되지 않는다.

```bash
# 릴리스 커밋에 주석 태그 달기
git tag -a v1.2.0 -m "Release v1.2.0"

# 커밋과 태그를 함께 push
git push --follow-tags origin main
```

## --follow-tags를 기본값으로 설정

매번 `--follow-tags`를 타이핑하지 않으려면:

```bash
git config --global push.followTags true
```

이후 `git push`만 실행해도 현재 push에 연결된 주석 태그가 자동으로 함께 전송된다.

## 원격 태그 가져오기

원격에서 태그를 로컬로 가져오는 방법이다.

```bash
# 일반 fetch: 태그도 함께 가져옴 (기본 동작)
git fetch origin

# 태그만 명시적으로 가져오기
git fetch origin --tags

# 특정 태그 하나만
git fetch origin refs/tags/v1.0.0:refs/tags/v1.0.0
```

`git fetch`는 기본적으로 원격의 태그를 자동으로 다운로드하므로 `--tags` 없이도 태그가 로컬에 반영된다.

## 태그 충돌: 원격에 이미 있는 태그 덮어쓰기

원격에 이미 존재하는 태그를 로컬에서 수정(재생성)하고 push하면 거부된다.

```bash
# 로컬에서 태그 재생성
git tag -fa v1.0.0 -m "Updated tag"

# 원격에 push 시도
git push origin v1.0.0
# ! [rejected] v1.0.0 -> v1.0.0 (already exists)

# 강제 덮어쓰기 (신중하게)
git push --force origin v1.0.0
```

원격에 이미 배포된 태그를 변경하는 것은 매우 위험하다. 다른 사람이 해당 태그를 참조하고 있다면 혼란을 야기한다. 실수한 경우라면 새 버전 태그를 만들고, 변경 이유를 릴리스 노트에 기록하는 것이 더 바람직하다.

![태그 push 명령 모음](/assets/posts/git-push-tags-commands.svg)

## 태그 삭제

원격 태그를 삭제해야 하는 경우 (다음 글에서 더 자세히 다룬다):

```bash
# 원격 태그 삭제
git push origin --delete v1.0.0-beta

# 로컬 태그도 삭제
git tag -d v1.0.0-beta
```

## 정리

로컬에서 생성한 태그는 `git push`만으로는 원격에 올라가지 않는다. 단일 태그는 `git push origin <태그명>`, 전체 태그는 `--tags`, 커밋 연관 주석 태그만 선별하려면 `--follow-tags`를 사용한다. 릴리스 워크플로를 자동화하려면 `push.followTags = true` 설정과 `--follow-tags` 옵션을 표준으로 삼는 것이 좋다.

---

**지난 글:** [push --force-with-lease — 안전한 강제 푸시](/posts/git-push-force-with-lease/)

**다음 글:** [원격 브랜치와 태그 삭제하기](/posts/git-push-delete-remote/)

<br>
읽어주셔서 감사합니다. 😊
