---
title: "비대해진 저장소 용량 줄이기: gc부터 히스토리 재작성까지"
description: "clone이 느려질 만큼 커진 Git 저장소의 용량을 진단하고 줄이는 방법을 정리한다. 용량이 작업 트리가 아닌 .git 히스토리에서 오는 이유, git count-objects와 rev-list로 대용량 객체를 찾는 법, gc·prune·repack으로 안전하게 압축하는 길과 filter-repo·BFG로 과거 blob을 제거하는 길, 그리고 force-push 이후 팀이 해야 할 일을 다룬다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "저장소용량", "gc", "filter-repo", "BFG", "packfile"]
featured: false
draft: false
---

[지난 글](/posts/git-fast-forward-only-policy/)에서는 머지 커밋 없이 일직선 히스토리를 강제하는 정책을 살펴봤다. 히스토리를 어떻게 쌓을지 고민하는 단계였다면, 이번에는 그 히스토리가 너무 무거워졌을 때의 이야기다. `git clone`이 몇 분씩 걸리고, CI가 체크아웃에서 시간을 잡아먹고, `.git` 폴더가 작업 파일보다 수십 배 커진 저장소를 한 번쯤은 만나게 된다. 이런 저장소를 어떻게 진단하고, 어디까지 안전하게 줄일 수 있는지 단계별로 짚어 보자.

## 용량은 작업 트리가 아니라 히스토리에서 온다

가장 먼저 바로잡아야 할 오해가 있다. "큰 파일을 커밋했다가 다음 커밋에서 지웠으니 용량은 괜찮겠지"라는 생각이다. Git은 한 번 객체 데이터베이스에 들어온 blob을 **영구적으로 보관**한다. 어떤 커밋에서 파일을 삭제해도 그 파일의 내용(blob)은 과거 커밋이 여전히 참조하므로 `.git` 안에 그대로 남는다.

![저장소 용량은 어디에서 오는가](/assets/posts/git-repo-size-cleanup-anatomy.svg)

즉 디스크에서 보이는 작업 트리(현재 체크아웃된 파일)는 빙산의 일각이고, 진짜 무게는 `.git` 디렉터리에 누적된 모든 과거 버전과 packfile에 있다. 그래서 용량 정리는 "지금 폴더에서 무엇을 지울까"가 아니라 "히스토리에 무엇이 박혀 있나"를 푸는 문제다.

## 1단계: 현재 상태 진단하기

무작정 명령을 던지기 전에 저장소가 정말 큰지, 무엇 때문에 큰지부터 측정한다. `git count-objects`는 객체 수와 packfile 크기를 한눈에 보여준다.

```bash
# -v: 상세, -H: 사람이 읽기 좋은 단위
git count-objects -vH
```

출력에서 `size-pack`이 압축된 packfile의 총 크기, `count`/`size`가 아직 묶이지 않은 느슨한(loose) 객체다. `size-pack`이 수백 MB를 넘긴다면 히스토리가 무겁다는 신호다.

다음으로 "무엇이" 무거운지 찾아야 한다. 아래 명령은 모든 객체를 크기순으로 정렬해 가장 큰 blob들을 추려낸다.

```bash
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '/^blob/ {print $3, $4}' \
  | sort -rn \
  | head -20
```

이 목록의 상위에 잊고 있던 빌드 산출물, 데이터셋, 동영상, 실수로 커밋한 `.zip` 같은 것이 보인다면 정리 대상이 명확해진다. 어느 커밋에서 그 파일이 들어왔는지 확인하려면 경로로 로그를 따라가면 된다.

```bash
git log --all --oneline -- path/to/big-file.bin
```

## 2단계: 안전한 길 — gc·prune·repack

진단 결과가 "딱히 거대한 파일이 박힌 건 아니고, 그냥 느슨한 객체가 많고 압축이 비효율적"이라면 히스토리를 건드릴 필요가 없다. 이때는 Git의 가비지 컬렉션으로 충분하다.

![용량 정리의 두 가지 길](/assets/posts/git-repo-size-cleanup-paths.svg)

`git gc`는 흩어진 loose 객체를 packfile로 묶고, 도달 불가능한(어떤 ref·reflog도 가리키지 않는) 객체를 정리하며, 델타 압축을 다시 계산한다.

```bash
# 평소 자동 gc보다 더 공격적으로 재압축
git gc --aggressive --prune=now
```

`--prune=now`는 보통 2주의 유예 기간을 두는 도달 불가 객체를 즉시 삭제한다. 단, 여기엔 함정이 있다. **방금 리베이스나 amend로 버려진 커밋도 reflog가 참조하는 동안에는 도달 가능**으로 간주된다. 정말로 용량을 줄이려면 reflog부터 만료시켜야 하는 경우가 많다.

```bash
# 오래된 reflog 엔트리를 모두 만료시킨 뒤 정리
git reflog expire --expire=now --all
git gc --prune=now
```

이 길의 가장 큰 장점은 **SHA가 바뀌지 않는다는 것**이다. 커밋 해시가 그대로이므로 force-push가 필요 없고, 동료들의 로컬 저장소와도 충돌하지 않는다. 위험이 거의 없으니 용량 문제를 만나면 항상 여기서 시작하자.

## 3단계: 강력한 길 — 히스토리에서 blob 제거

문제가 "100MB짜리 파일이 50개 커밋 전에 들어와 지금까지 모든 스냅샷에 묻어 있다"라면 gc로는 줄지 않는다. 그 blob을 참조하는 과거 커밋이 살아 있는 한 객체는 사라지지 않기 때문이다. 이때는 **히스토리 자체를 재작성**해 해당 파일이 처음부터 없었던 것처럼 만들어야 한다.

요즘 권장되는 도구는 `git filter-repo`다(과거의 `git filter-branch`는 느리고 위험해 공식적으로 권장되지 않는다). 우선 안전을 위해 **새로 clone한 복제본**에서 작업하는 것이 정석이다.

```bash
# 특정 파일을 전체 히스토리에서 제거 (--invert-paths: 지정 경로만 빼고 유지)
git filter-repo --invert-paths --path data/huge-dataset.csv

# 패턴으로 한꺼번에 제거하기
git filter-repo --invert-paths --path-glob '*.mp4'
```

자바 기반의 **BFG Repo-Cleaner**도 같은 목적에 자주 쓰이며, 대용량 저장소에서 filter-repo보다 빠른 경우가 있다.

```bash
# 50MB를 초과하는 모든 blob을 히스토리에서 제거
bfg --strip-blobs-bigger-than 50M my-repo.git

# 재작성 후 실제 용량 회수
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

재작성이 끝나면 거의 모든 커밋의 SHA가 바뀐다. 따라서 원격에 반영하려면 force-push가 불가피하다.

```bash
git push --force-with-lease --all
git push --force-with-lease --tags
```

## force-push 이후, 팀이 해야 할 일

히스토리 재작성의 진짜 비용은 명령이 아니라 **그 다음**에 있다. 모든 협업자의 로컬 저장소는 이제 옛 SHA를 들고 있어 원격과 어긋난다. 이때 각자가 `git pull`로 머지하면 제거했던 blob이 고스란히 되살아나 모든 노력이 수포로 돌아간다.

그래서 재작성을 강행하기로 했다면 반드시 팀에 공지하고, 동료들은 다음 중 하나를 택해야 한다.

```bash
# 가장 안전: 그냥 새로 clone
git clone <repo-url>

# 로컬 작업을 살려야 한다면 재작성된 원격으로 리셋
git fetch origin
git reset --hard origin/main
```

정리하면, 비대한 저장소 앞에서의 의사결정은 단순하다. **먼저 `count-objects`와 `rev-list`로 원인을 측정하고**, 거대한 파일이 박힌 게 아니라면 위험 없는 `gc`·`prune`으로 끝낸다. 진짜 대용량 객체가 히스토리에 묻혔을 때만, 그 대가(전원 재클론)를 팀과 합의한 뒤에 `filter-repo`나 BFG로 재작성한다. 측정 없이 곧장 히스토리를 갈아엎는 것이야말로 가장 피해야 할 선택이다.

---

**지난 글:** [Fast-forward only 정책으로 선형 히스토리 유지하기](/posts/git-fast-forward-only-policy/)

<br>
읽어주셔서 감사합니다. 😊
