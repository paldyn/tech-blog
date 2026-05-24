---
title: "Git packed-refs: ref를 압축 저장하는 파일"
description: ".git/packed-refs 파일의 포맷, loose ref와의 우선순위 관계, git pack-refs·gc·fetch --prune으로 ref를 관리하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "packed-refs", "pack-refs", "gc", "ref", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-head-essence/)에서 HEAD와 symbolic ref를 살펴봤다. 저장소에 브랜치와 태그가 수백 개 생기면 `.git/refs/`의 개별 파일들이 부담이 된다. Git은 이를 **packed-refs**로 해결한다.

## packed-refs란

Git은 ref를 두 가지 방식으로 저장한다.

- **loose ref**: `.git/refs/heads/main`처럼 ref 하나당 파일 하나
- **packed refs**: `.git/packed-refs` 파일 하나에 모든 ref를 모아 저장

수천 개의 태그나 브랜치가 생기면 loose ref 방식은 inode를 많이 소비하고 디렉터리 읽기가 느려진다. packed-refs는 이를 단일 파일로 해결한다.

```bash
# packed-refs 파일 확인
cat .git/packed-refs
```

![packed-refs 포맷](/assets/posts/git-packed-refs-format.svg)

## packed-refs 파일 포맷

파일의 첫 줄은 헤더다.

```
# pack-refs with: peeled fully-peeled sorted
```

이후 각 줄은 `{SHA40} {refname}` 형태다.

```
abc123def456789abcdef1234567890abcdef12  refs/heads/main
ttt999fff888777666555444333222111000aaa  refs/tags/v1.0.0
^abc123def456789abcdef1234567890abcdef12
```

`^`로 시작하는 줄은 **peeled ref**다. annotated tag 바로 다음에 나타나며, tag 오브젝트가 가리키는 실제 commit SHA를 나타낸다. `git rev-parse v1.0.0^{}`와 같은 값이다. lightweight tag는 peeled 줄이 없다.

## loose ref와 packed-refs의 우선순위

Git이 ref를 조회할 때 규칙은 단순하다.

```
1. .git/refs/{경로}에 파일이 있으면 → loose ref 사용
2. 없으면 → packed-refs에서 해당 refname 검색
```

즉 loose ref가 항상 우선한다. `git branch -d` 같은 명령으로 브랜치를 삭제할 때 loose 파일 제거만으로는 부족한 경우가 있다. packed-refs에 남은 줄도 제거해야 완전히 사라진다. Git이 이를 자동으로 처리한다.

```bash
# 브랜치 삭제 시 내부 동작
git branch -d old-feature
# → .git/refs/heads/old-feature 파일 삭제
# → packed-refs에서 해당 줄 제거 (있는 경우)
```

## pack-refs 명령

```bash
# 모든 loose ref를 packed-refs로 통합
git pack-refs --all

# 새로 생긴 loose ref만 통합 (기본 동작)
git pack-refs

# git gc는 내부적으로 pack-refs --all 을 호출
git gc
```

`git gc` 실행 시 loose refs를 packed-refs로 자동으로 통합한다. 커밋을 많이 하다 보면 `.git/refs/` 아래 파일이 쌓이는데, `git gc` 후에는 대부분 packed-refs로 이동한다.

![packed-refs 명령](/assets/posts/git-packed-refs-commands.svg)

## 원격 추적 ref 정리

원격 저장소에서 삭제된 브랜치의 추적 ref(refs/remotes/origin/...)가 로컬에 남는 경우가 있다. fetch 시 `--prune` 옵션으로 정리한다.

```bash
# fetch + 삭제된 원격 브랜치 추적 ref 정리
git fetch --prune

# 또는 fetch 없이 정리만
git remote prune origin

# 기본값으로 항상 --prune 적용
git config fetch.prune true
```

이 명령은 packed-refs에서도 해당 항목을 제거한다.

## packed-refs 직접 수정은 금지

packed-refs는 텍스트 파일이지만, 직접 편집해서는 안 된다. 파일이 손상되면 Git이 모든 ref를 읽지 못해 저장소가 망가질 수 있다. 항상 Git 명령을 통해 조작한다.

다음 글에서는 오브젝트 저장 방식인 **loose 오브젝트와 pack 파일**의 차이를 살펴본다.

---

**지난 글:** [Git HEAD의 본질: symbolic ref와 detached HEAD](/posts/git-head-essence/)

**다음 글:** [Git Loose 오브젝트 vs Pack 파일: 오브젝트 저장 방식](/posts/git-loose-vs-pack/)

<br>
읽어주셔서 감사합니다. 😊
