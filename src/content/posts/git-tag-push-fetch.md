---
title: "태그 Push와 Fetch — 원격 동기화"
description: "git push --tags, --follow-tags, git fetch --tags의 차이를 비교하고, CI에서 태그를 안전하게 원격과 동기화하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "push", "fetch", "원격", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/git-tag-list-create/)에서 태그 목록 조회와 생성 패턴을 살펴봤다. 이번에는 **원격 저장소와 태그를 동기화**하는 방법을 다룬다. `git push`의 기본 동작이 태그를 포함하지 않는다는 사실을 모르면 릴리스 태그가 원격에 없는 상황이 반복된다.

## 기본 동작: push는 태그를 보내지 않는다

`git push`는 코드(브랜치)만 전송한다. 태그는 항상 명시적으로 push해야 한다.

```bash
# 이것만으로는 태그가 origin에 안 올라감
git push origin main

# 태그를 보내려면 별도 명령 필요
git push origin v1.0.0        # 특정 태그만
git push origin --tags        # 모든 태그 (LW + Annotated)
git push --follow-tags        # Annotated만, 현재 커밋 연결 기준
```

![태그 Push / Fetch 흐름](/assets/posts/git-tag-push-fetch-flow.svg)

## push 옵션 비교

```bash
# 1. 단일 태그 push
git push origin v2.0.0

# 2. 모든 로컬 태그 일괄 push
git push origin --tags

# 3. Annotated 태그만 (권장, CI)
git push origin main --follow-tags
```

`--follow-tags`는 현재 push하는 커밋과 **연결된 Annotated 태그**만 포함한다. Lightweight 태그는 무시한다. 릴리스 워크플로에서 코드 배포와 태그를 한 번에 올릴 때 가장 안전한 선택이다.

![push 옵션 비교표](/assets/posts/git-tag-push-fetch-options.svg)

## 원격 태그 가져오기

다른 팀원이 push한 태그는 `git fetch`로 받아야 한다.

```bash
# 코드와 태그 함께 가져오기
git fetch origin --tags

# 특정 태그만 가져오기
git fetch origin refs/tags/v1.0.0:refs/tags/v1.0.0

# 원격 태그 목록만 확인 (fetch 없이)
git ls-remote --tags origin
```

`git fetch` 기본 동작도 대부분의 태그를 자동으로 가져오지만, 명시적으로 `--tags`를 붙이면 원격에 있는 모든 태그를 빠짐없이 가져온다.

## 원격 태그 삭제

원격에 실수로 올린 태그를 삭제해야 할 때가 있다.

```bash
# 원격 태그 삭제 (--delete 방식)
git push origin --delete v1.0.0

# 옛 방식 (같은 효과)
git push origin :refs/tags/v1.0.0
```

삭제 후 다른 팀원의 로컬에는 태그가 남아있다. 삭제를 공지하고 각자 `git tag -d v1.0.0`으로 정리하게 해야 한다.

## --follow-tags를 기본값으로 설정

매번 `--follow-tags`를 입력하기 번거롭다면 설정으로 고정한다.

```bash
# push 시 항상 --follow-tags 적용
git config --global push.followTags true
```

이후 `git push`만 해도 커밋에 연결된 Annotated 태그가 자동으로 올라간다.

## CI에서 태그 push 자동화

GitHub Actions 예시:

```yaml
- name: Push with tags
  run: |
    git tag -a v${{ env.VERSION }} -m "Release v${{ env.VERSION }}"
    git push origin main --follow-tags
```

`--follow-tags`를 쓰면 코드와 태그가 한 명령으로 원격에 올라가고, Lightweight 태그가 섞이는 문제도 예방한다.

## 태그 refspec 이해

원격 태그는 `refs/tags/` 아래에 저장된다. refspec을 직접 지정하면 더 세밀하게 제어할 수 있다.

```bash
# 특정 태그를 다른 이름으로 push
git push origin refs/tags/v1.0.0:refs/tags/v1.0.0-prod

# 원격에서 특정 태그 한 개만 fetch
git fetch origin refs/tags/v1.0.0:refs/tags/v1.0.0
```

이런 패턴은 스테이징 환경과 프로덕션 환경을 별도 태그 네임스페이스로 관리할 때 사용한다.

---

**지난 글:** [태그 목록 조회와 생성 패턴](/posts/git-tag-list-create/)

**다음 글:** [태그 삭제 — 로컬과 원격](/posts/git-tag-delete/)

<br>
읽어주셔서 감사합니다. 😊
