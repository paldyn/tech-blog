---
title: "Git 대용량 저장소 관리 팁"
description: "저장소가 비대해지는 원인을 진단하고, git gc·LFS·filter-repo·sparse checkout 등 상황별 최적화 전략을 실용적으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "large-repo", "gc", "LFS", "filter-repo", "최적화", "성능"]
featured: false
draft: false
---

[지난 글](/posts/git-shallow-vs-deep/)에서 shallow clone으로 히스토리 깊이를 제한해 클론 속도를 높이는 방법을 알아봤다. 이번에는 저장소가 비대해지는 원인을 파악하고 상황에 맞게 크기를 줄이는 전략 전반을 살펴본다.

## 왜 저장소가 커지는가

Git 저장소가 예상보다 빠르게 커지는 주요 원인은 세 가지다. 첫째, 바이너리 파일(이미지·동영상·컴파일 결과물)을 습관적으로 커밋하면 델타 압축이 거의 되지 않아 매 커밋마다 전체 크기가 추가된다. 둘째, 대형 파일을 실수로 커밋했다가 삭제해도 히스토리에는 영원히 남는다. 셋째, 오랜 기간 누적된 loose object가 gc 없이 방치된다.

## 1단계: 크기 진단

문제를 해결하기 전에 반드시 측정부터 한다.

![저장소 크기 진단 명령어](/assets/posts/git-large-repo-tips-diagnosis.svg)

```bash
# packfile 합계 크기 확인
git count-objects -vH

# .git 디렉터리 전체 크기
du -sh .git/

# 가장 큰 오브젝트 상위 10개 (크기 내림차순)
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | grep blob \
  | sort -k3 -rn \
  | head -10
```

`size-pack`이 수백 MiB를 넘는다면 packfile 최적화나 LFS 도입을 검토할 시점이다.

## 2단계: git gc로 즉시 정리

진단 후 가장 먼저 해볼 수 있는 조치다. 저장소를 바꾸지 않고 내부 구조만 최적화한다.

```bash
# 기본 gc (30일 이상 unreachable 오브젝트 제거)
git gc

# 모든 unreachable 오브젝트 즉시 제거 + 공격적 재압축
git gc --prune=now --aggressive
```

`--aggressive` 옵션은 더 강력하게 재압축하지만 시간이 오래 걸린다. 큰 저장소에서는 수십 분이 걸릴 수 있으므로 유지 보수 시간대에 실행한다.

## 3단계: 대형 파일 원인 파악 후 LFS 전환

바이너리 파일이 문제라면 앞으로 새로 추가되는 파일은 Git LFS로 전환한다. LFS는 파일 본체를 별도 스토리지에 보관하고 저장소에는 포인터(텍스트 파일)만 커밋한다.

```bash
git lfs install
git lfs track "*.psd" "*.mp4" "*.zip"
git add .gitattributes
git commit -m "chore: LFS 트래킹 설정"
```

기존에 커밋된 대형 파일을 LFS로 마이그레이션하는 방법은 다음 글에서 자세히 다룬다.

## 4단계: 히스토리 속 대형 파일 제거

실수로 커밋된 파일을 완전히 지우려면 히스토리를 재작성해야 한다.

```bash
# git filter-repo 설치 (pip로 설치 또는 brew)
pip install git-filter-repo

# 특정 파일을 히스토리 전체에서 삭제
git filter-repo --path assets/large-video.mp4 --invert-paths

# 특정 경로 패턴 전체 삭제
git filter-repo --path-glob '*.zip' --invert-paths
```

`filter-repo`는 `filter-branch`보다 훨씬 빠르고 안전하다. 실행 후에는 `git push --force-with-lease`로 원격에 반영하고, 팀원 모두에게 저장소를 다시 클론하도록 안내한다.

## 5단계: 클론 전략으로 로컬 크기 줄이기

![대용량 저장소 최적화 전략](/assets/posts/git-large-repo-tips-solutions.svg)

원격 저장소 자체를 바꾸기 어렵다면 클론 전략으로 로컬 공간을 아낀다.

```bash
# CI/CD: 최신 커밋 하나만
git clone --depth=1 --single-branch -b main <url>

# 개발: blob 지연 다운로드
git clone --filter=blob:none <url>

# 모노레포: 특정 디렉터리만 체크아웃
git clone --filter=blob:none --sparse <url>
cd repo
git sparse-checkout set packages/my-app
```

## 일상적인 예방 습관

저장소가 커지지 않도록 처음부터 예방하는 것이 가장 효과적이다.

| 습관 | 설명 |
|---|---|
| `.gitignore` 철저히 관리 | 빌드 결과물·IDE 설정·패키지 캐시 제외 |
| 바이너리는 LFS 처음부터 | 나중에 마이그레이션하면 강제 푸시 필요 |
| 정기적 gc | `git gc`를 주기적으로 실행 |
| PR 리뷰 시 크기 체크 | CI에서 대형 파일 커밋 감지 훅 추가 |

```bash
# pre-commit 훅: 5MB 이상 파일 커밋 차단
# .git/hooks/pre-commit 에 추가
find . -size +5M -not -path "./.git/*" | while read f; do
  echo "ERROR: $f is too large. Use Git LFS."
  exit 1
done
```

---

**지난 글:** [Git Shallow Clone vs Full Clone](/posts/git-shallow-vs-deep/)

**다음 글:** [Git LFS 기초](/posts/git-lfs-basics/)

<br>
읽어주셔서 감사합니다. 😊
