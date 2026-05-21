---
title: "git gc로 저장소 최적화하기"
description: "git gc의 동작 원리(loose objects → packfile), 자동 GC 트리거, --aggressive/--prune=now 옵션, reflog 만료 설정을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "gc", "packfile", "최적화", "저장소 관리"]
featured: false
draft: false
---

[지난 글](/posts/git-fsck/)에서 `git fsck`로 저장소 무결성을 검사했다. 이번에는 `git gc`로 저장소를 정리하고 최적화하는 방법을 알아본다. 커밋 수가 많아진 저장소에서 꼭 알아야 하는 유지보수 명령이다.

## git gc가 하는 일

`gc`는 "Garbage Collection"의 약자다. 크게 두 가지 작업을 한다. 첫째, 수천 개의 낱개 파일(loose objects)을 하나의 packfile로 압축·통합해 저장소 크기를 줄이고 접근 속도를 높인다. 둘째, 어떤 ref에서도 도달할 수 없는 만료된 객체를 삭제(prune)한다.

![git gc 동작 과정](/assets/posts/git-gc-process.svg)

## auto gc: 자동 실행

`git commit`, `git fetch`, `git pull` 등 저장소를 변경하는 명령을 실행할 때 Git은 내부적으로 auto gc를 확인한다. loose objects 수가 임계값(기본 6700개)을 넘으면 백그라운드에서 `git gc --auto`가 자동 실행된다.

```bash
# auto gc 메시지 예시
# Auto packing the repository in background for optimum performance.
# See "git help gc" for manual housekeeping.
```

평소에 별도로 gc를 실행하지 않아도 Git이 알아서 관리한다. 다만 CI 서버나 bare 저장소처럼 자동 트리거가 잘 안 될 환경에서는 수동으로 실행해 줘야 한다.

## 수동 실행

```bash
# 기본 gc 실행
git gc

# 출력 예시
# Counting objects: 1234, done.
# Delta compression using up to 8 threads.
# Compressing objects: 100% (456/456), done.
# Writing objects: 100% (1234/1234), done.
# Total 1234 (delta 789), reused 1234 (delta 789)
# Removing duplicate objects: 100% (2/2), done.
```

## 주요 옵션

![git gc 옵션과 설정값](/assets/posts/git-gc-options.svg)

### --aggressive

```bash
git gc --aggressive
```

일반 gc보다 훨씬 강한 delta 압축을 적용한다. 실행 시간이 몇 배 더 걸리지만 packfile 크기가 더 작아진다. 일반적인 개발 환경에서는 거의 필요 없고, 매우 오래된 대형 저장소를 처음 최적화할 때나 드물게 사용한다.

### --prune=now

```bash
git gc --prune=now
```

기본값은 `--prune=2.weeks.ago`로, 2주 이상 된 unreachable 객체만 삭제한다. `--prune=now`는 모든 unreachable 객체를 즉시 삭제한다. 복구 가능성을 포기하고 공간을 최대한 확보할 때 사용한다. **주의**: 이 명령을 실행하면 reflog에만 남아 있던 커밋도 삭제될 수 있어 복구가 불가능해진다.

### --no-prune

```bash
git gc --no-prune
```

packfile 통합만 수행하고 객체 삭제는 하지 않는다. 압축 효과는 얻으면서 dangling 객체를 보존할 때 사용한다.

## 저장소 크기 확인

gc 전후 저장소 크기 변화를 확인하는 방법이다.

```bash
# 저장소 총 크기
du -sh .git/

# 객체 디렉터리 상세
du -sh .git/objects/
du -sh .git/objects/pack/
du -sh .git/objects/[0-9a-f][0-9a-f]/

# Git 내장 통계
git count-objects -v
# count: 15          ← loose objects 수
# size: 120          ← loose objects 크기 (KB)
# in-pack: 45678     ← packfile 안에 있는 객체 수
# packs: 2           ← packfile 개수
# size-pack: 18432   ← packfile 총 크기 (KB)
# prune-packable: 0  ← 중복된 loose objects
# garbage: 0         ← 알 수 없는 파일
# size-garbage: 0
```

## reflog와 gc의 관계

reflog는 gc로 삭제되지 않는다. reflog가 참조하는 커밋은 "도달 가능"으로 간주되어 prune 대상에서 제외된다. 정말로 오래된 reflog를 제거하려면 명시적으로 만료시켜야 한다.

```bash
# reflog 만료 기간 설정 (기본 90일/30일)
git config gc.reflogExpire 90.days.ago
git config gc.reflogExpireUnreachable 30.days.ago

# reflog를 즉시 만료시키고 gc 실행
git reflog expire --expire=now --all
git gc --prune=now
```

## 자동 gc 비활성화

CI/CD 파이프라인이나 셸 스크립트에서 예기치 않은 gc 실행을 막고 싶을 때 비활성화한다.

```bash
# auto gc 비활성화 (0 = 비활성)
git config gc.auto 0

# 또는 환경변수로 임시 비활성
GIT_NO_AUTO_GC=1 git fetch origin
```

## 멀티-스레드 gc

```bash
# 사용할 스레드 수 설정 (기본: CPU 코어 수)
git config pack.threads 4
git gc
```

대형 저장소에서 gc가 너무 오래 걸린다면 스레드 수를 조정해 성능을 튜닝할 수 있다.

gc는 저장소를 처음부터 다시 설계하는 것이 아니라 현재 있는 객체들을 정리·압축하는 작업이다. 다음 글에서는 gc 전후에 남아 있는 dangling object의 종류와 안전한 처리 방법을 자세히 살펴본다.

---

**지난 글:** [git fsck로 저장소 무결성 검사하기](/posts/git-fsck/)

**다음 글:** [Git dangling objects 이해와 처리](/posts/git-dangling-objects/)

<br>
읽어주셔서 감사합니다. 😊
