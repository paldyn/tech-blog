---
title: "Git LFS 트래킹 설정과 해제"
description: "git lfs track으로 파일 패턴을 LFS에 등록하고, untrack으로 해제하는 방법과 .gitattributes 관리 요령을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "LFS", "track", "untrack", "gitattributes", "바이너리"]
featured: false
draft: false
---

[지난 글](/posts/git-lfs-basics/)에서 Git LFS의 포인터 원리와 기본 install·push 흐름을 살펴봤다. 이번에는 어떤 파일을 LFS에 등록하고 해제하는지 `git lfs track`과 `git lfs untrack`을 중심으로 알아본다.

## git lfs track

`git lfs track`은 `.gitattributes`에 LFS 필터 규칙을 추가하는 명령이다. 실행 결과로 저장소 루트의 `.gitattributes`가 수정되며, 이 파일을 반드시 커밋해야 팀 전체에 적용된다.

```bash
# 확장자 패턴 (가장 일반적)
git lfs track "*.psd"
git lfs track "*.mp4" "*.mov" "*.avi"

# 경로 포함 패턴
git lfs track "assets/images/**"
git lfs track "models/*.bin"

# 특정 파일 하나만
git lfs track "data/pretrained-weights.pt"

# 현재 등록된 패턴 확인
git lfs track
```

![LFS 트래킹 패턴 설정](/assets/posts/git-lfs-track-untrack-config.svg)

### .gitattributes 직접 편집

`git lfs track`을 사용하지 않고 `.gitattributes`를 직접 편집해도 된다. 결과는 동일하다.

```
# .gitattributes
*.psd  filter=lfs diff=lfs merge=lfs -text
*.mp4  filter=lfs diff=lfs merge=lfs -text
assets/**  filter=lfs diff=lfs merge=lfs -text
```

각 속성의 의미는 다음과 같다.

| 속성 | 의미 |
|---|---|
| `filter=lfs` | 체크아웃/스테이징 시 LFS smudge·clean 필터 적용 |
| `diff=lfs` | diff 시 LFS diff 드라이버 사용 |
| `merge=lfs` | 병합 시 LFS merge 드라이버 사용 |
| `-text` | 줄 끝 변환(CRLF ↔ LF) 비활성화 |

### 트래킹 중인 파일 목록 확인

```bash
# 저장소에서 LFS로 관리되는 파일 나열
git lfs ls-files

# 특정 패턴만
git lfs ls-files --name-only "*.mp4"

# 크기 포함
git lfs ls-files -s
```

## git lfs untrack

트래킹을 해제하려면 `git lfs untrack`을 실행한다. 이 명령은 `.gitattributes`에서 해당 패턴을 제거한다.

![LFS 트래킹 해제 절차](/assets/posts/git-lfs-track-untrack-commands.svg)

```bash
# 1. 트래킹 패턴 해제
git lfs untrack "*.png"

# 2. 인덱스에서 제거 (파일은 유지됨)
git rm --cached "*.png"

# 3. 일반 Git 파일로 재추가
git add .gitattributes *.png

# 4. 커밋
git commit -m "revert: PNG files back to regular Git objects"
```

### untrack의 한계

`git lfs untrack`은 이후 새로 만들어지는 커밋에만 영향을 미친다. 과거 히스토리에서 LFS 포인터로 기록된 커밋들은 그대로 LFS 포인터를 가리킨다. 히스토리까지 일반 Git 오브젝트로 변환하려면 `git lfs migrate export`를 사용해야 한다 (다음 글에서 다룬다).

## 자주 사용하는 패턴 목록

팀에서 공통으로 쓰기 좋은 LFS 패턴을 `.gitattributes`에 미리 등록해두면 편리하다.

```
# 이미지
*.png  filter=lfs diff=lfs merge=lfs -text
*.jpg  filter=lfs diff=lfs merge=lfs -text
*.jpeg filter=lfs diff=lfs merge=lfs -text
*.gif  filter=lfs diff=lfs merge=lfs -text
*.webp filter=lfs diff=lfs merge=lfs -text
*.psd  filter=lfs diff=lfs merge=lfs -text
*.ai   filter=lfs diff=lfs merge=lfs -text

# 동영상
*.mp4  filter=lfs diff=lfs merge=lfs -text
*.mov  filter=lfs diff=lfs merge=lfs -text
*.avi  filter=lfs diff=lfs merge=lfs -text

# 데이터·모델
*.bin  filter=lfs diff=lfs merge=lfs -text
*.pt   filter=lfs diff=lfs merge=lfs -text
*.h5   filter=lfs diff=lfs merge=lfs -text

# 압축 파일
*.zip  filter=lfs diff=lfs merge=lfs -text
*.tar.gz filter=lfs diff=lfs merge=lfs -text
```

## 주의: 이미 커밋된 파일

LFS 패턴을 등록하기 전에 이미 일반 Git 오브젝트로 커밋된 파일은 자동으로 LFS로 이동하지 않는다. 기존에 커밋된 파일을 LFS로 마이그레이션하는 방법은 다음 글에서 `git lfs migrate import`로 설명한다.

```bash
# 새로 track한 패턴을 기존 파일에 적용 (staging area 기준)
git add --renormalize .
git status  # LFS로 이동된 파일 확인
git commit -m "chore: move existing files to LFS"
```

---

**지난 글:** [Git LFS 기초](/posts/git-lfs-basics/)

**다음 글:** [Git LFS 마이그레이션](/posts/git-lfs-migrate/)

<br>
읽어주셔서 감사합니다. 😊
