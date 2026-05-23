---
title: "Git LFS 마이그레이션: 히스토리 속 파일을 LFS로 전환"
description: "git lfs migrate import로 기존 커밋의 바이너리 파일을 LFS로 재작성하고, migrate export로 역방향 전환하는 전체 절차를 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "LFS", "migrate", "히스토리-재작성", "force-push"]
featured: false
draft: false
---

[지난 글](/posts/git-lfs-track-untrack/)에서 `git lfs track`으로 새 파일을 LFS에 등록하는 방법을 알아봤다. 하지만 LFS 도입 전에 이미 일반 Git 오브젝트로 커밋된 파일들은 어떻게 처리할까? `git lfs migrate`가 그 답이다.

## git lfs migrate란

`git lfs migrate`는 커밋 히스토리를 다시 작성해 기존 파일을 LFS 포인터로 교체하거나, 반대로 LFS 포인터를 일반 오브젝트로 되돌리는 명령이다. 두 가지 서브커맨드가 있다.

- `git lfs migrate import`: 일반 Git 오브젝트 → LFS 포인터
- `git lfs migrate export`: LFS 포인터 → 일반 Git 오브젝트

## migrate import: 기존 파일을 LFS로

저장소에 이미 커밋된 바이너리 파일을 LFS로 이동시킨다.

![git lfs migrate import 흐름](/assets/posts/git-lfs-migrate-flow.svg)

```bash
# 1. 사전 확인: 마이그레이션 대상 파악
git lfs migrate info --everything

# 2. 특정 확장자를 모든 브랜치에서 LFS로 전환
git lfs migrate import --include="*.png,*.jpg,*.mp4" --everything

# 3. 현재 브랜치만 처리 (--everything 생략)
git lfs migrate import --include="*.zip"

# 4. 특정 브랜치 지정
git lfs migrate import --include="*.psd" --include-ref=refs/heads/main
```

`migrate import`를 실행하면 지정한 패턴에 맞는 파일이 모든 커밋에서 LFS 포인터로 교체된다. 커밋 SHA가 모두 바뀌기 때문에 **히스토리가 완전히 재작성**된다.

### 실행 후 처리

```bash
# 로컬 상태 정리
git reflog expire --expire-unreachable=now --all
git gc --prune=now

# 원격 저장소에 강제 푸시 (히스토리가 바뀌었으므로 필수)
git push --force-with-lease origin --all
git push --force-with-lease origin --tags
```

팀 저장소라면 반드시 **모든 팀원이 재클론**해야 한다. 기존 로컬 저장소를 pull하면 충돌이 발생한다.

```bash
# 팀원 각자 실행
git clone https://github.com/org/repo.git repo-fresh
```

## migrate export: LFS 파일을 일반 오브젝트로

LFS 의존성을 제거하거나 LFS 서버를 운영하지 않는 환경으로 이전할 때 사용한다.

![migrate import vs export 비교](/assets/posts/git-lfs-migrate-export.svg)

```bash
# LFS 포인터를 일반 오브젝트로 변환
git lfs migrate export --include="*.png" --everything

# LFS 서버에서 실제 파일 먼저 내려받기 (필요시)
git lfs pull
git lfs migrate export --include="*.mp4"
```

`export` 후에는 저장소에 실제 바이너리가 들어가므로 크기가 다시 커진다.

## migrate info: 마이그레이션 전 분석

마이그레이션 전에 어떤 파일이 얼마나 차지하는지 미리 파악한다.

```bash
# 히스토리 전체에서 큰 파일 분석
git lfs migrate info --everything

# 결과 예시:
# migrate: Fetching remote refs...
# *.png    108 MB    142/1312 files(s)  11%
# *.mp4    204 MB     18/1312 files(s)   1%
# *.zip     52 MB      6/1312 files(s)   0%
```

## 체크리스트: 팀 저장소 마이그레이션 순서

1. **팀 공지**: 마이그레이션 일정과 재클론 필요성 안내
2. **작업 중인 브랜치 병합 완료**: 미완성 PR은 병합하거나 닫기
3. **백업**: `git bundle create backup.bundle --all`
4. **migrate info 실행**: 대상 파일 확인
5. **migrate import 실행**: 히스토리 재작성
6. **gc 실행**: `git gc --prune=now`
7. **force push**: `git push --force-with-lease origin --all`
8. **LFS 파일 확인**: `git lfs ls-files`
9. **팀원 재클론 안내**: 기존 로컬 저장소 폐기

---

**지난 글:** [Git LFS 트래킹 설정과 해제](/posts/git-lfs-track-untrack/)

**다음 글:** [.gitattributes 완전 정복](/posts/git-attributes/)

<br>
읽어주셔서 감사합니다. 😊
