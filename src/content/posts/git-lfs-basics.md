---
title: "Git LFS 기초: 대형 파일을 Git으로 관리하기"
description: "Git Large File Storage(LFS)가 무엇인지, 포인터 파일 원리부터 install·track·push까지 기본 사용 흐름을 단계별로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "LFS", "large-file", "binary", "포인터", "저장소 크기"]
featured: false
draft: false
---

[지난 글](/posts/git-large-repo-tips/)에서 대용량 저장소 문제를 진단하고 LFS를 해법 중 하나로 소개했다. 이번 글에서는 Git LFS가 실제로 어떻게 동작하는지 원리부터 기본 사용 흐름까지 자세히 알아본다.

## Git LFS란

Git Large File Storage(LFS)는 GitHub이 2015년에 공개한 Git 확장 기능이다. 이미지·동영상·컴파일된 바이너리처럼 용량이 큰 파일을 저장소 본체가 아닌 별도의 LFS 서버에 보관하고, 저장소에는 **포인터 파일**만 커밋한다.

Git의 델타 압축은 텍스트 파일에 매우 효과적이지만 바이너리 파일에는 거의 효과가 없다. 100MB 동영상 파일을 조금만 수정해도 전체 100MB가 새 오브젝트로 추가된다. LFS는 이 문제를 근본적으로 해결한다.

## 포인터 파일 원리

![Git LFS 동작 원리](/assets/posts/git-lfs-basics-concept.svg)

LFS를 사용하면 저장소에 커밋되는 것은 실제 파일이 아니라 134바이트 남짓한 텍스트 파일이다.

```
version https://git-lfs.github.com/spec/v1
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32
size 209715200
```

- `oid`: 실제 파일의 SHA-256 해시. LFS 서버에서 파일을 찾는 키다.
- `size`: 실제 파일 바이트 크기.

`git checkout` 시 Git LFS 클라이언트가 이 포인터를 읽고 LFS 서버에서 실제 파일을 자동으로 내려받는다. 개발자 입장에서는 일반 파일처럼 사용하면 된다.

## LFS 설치

Git LFS는 별도 설치가 필요하다.

```bash
# macOS (Homebrew)
brew install git-lfs

# Linux (apt)
sudo apt install git-lfs

# Windows (Git for Windows에 포함)
# 또는 https://git-lfs.com 에서 설치 파일 다운로드

# 설치 확인
git lfs version
# git-lfs/3.x.x (GitHub; ...)
```

## 기본 사용 흐름

![Git LFS 설치 및 기본 사용](/assets/posts/git-lfs-basics-workflow.svg)

```bash
# 1. 저장소에 LFS 훅 설치 (저장소당 1회)
git lfs install

# 2. 추적할 파일 패턴 등록
git lfs track "*.psd"
git lfs track "*.mp4" "*.mov"
git lfs track "*.zip" "*.tar.gz"

# 3. .gitattributes를 반드시 커밋에 포함
git add .gitattributes
git add design.psd video.mp4

# 4. 커밋 및 푸시 (LFS 서버로 자동 업로드)
git commit -m "add design assets via LFS"
git push origin main
```

`git lfs install`은 `.git/hooks/`에 `pre-push`, `post-checkout` 등의 훅을 설치해 LFS와 Git 워크플로우를 연결한다. 새 저장소를 클론한 팀원도 `git lfs install`을 한 번 실행해야 한다.

## 현재 상태 확인

```bash
# 현재 트래킹 중인 패턴 목록
git lfs track

# 저장소에서 LFS로 관리되는 파일 목록
git lfs ls-files

# LFS 파일 상태 확인
git lfs status

# LFS 환경 정보
git lfs env
```

## 클론 시 LFS 파일 처리

LFS를 사용하는 저장소를 클론하면 기본적으로 LFS 파일도 자동으로 내려받는다.

```bash
# 일반 클론 (LFS 파일 자동 다운로드)
git clone https://github.com/org/repo.git

# LFS 파일 없이 클론 (포인터만)
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/org/repo.git

# 나중에 특정 파일만 내려받기
git lfs pull --include "assets/images/"
```

`GIT_LFS_SKIP_SMUDGE=1`은 CI 환경이나 소스만 필요한 경우에 유용하다. 바이너리가 없어도 빌드가 가능한 파이프라인이라면 클론 시간을 크게 단축할 수 있다.

## GitHub / GitLab 지원

GitHub과 GitLab은 LFS를 기본 지원한다. GitHub 무료 계정은 1GB LFS 스토리지와 1GB/월 대역폭을 제공한다. 초과 시 유료 데이터 팩을 추가하거나 자체 LFS 서버(Gitea, MinIO 기반 등)를 운영할 수 있다.

| 항목 | GitHub Free | GitHub Pro |
|---|---|---|
| LFS 스토리지 | 1 GB | 2 GB |
| 월별 대역폭 | 1 GB | 2 GB |
| 추가 팩 | $5/50GB | 동일 |

## 주의사항

LFS로 관리되는 파일에 `git diff`를 실행하면 포인터 파일의 diff가 보인다. 실제 내용을 비교하려면 `git lfs diff`를 사용한다. 또한 `git log -p`나 `git show`에서도 바이너리 diff는 의미 있게 표시되지 않는다.

---

**지난 글:** [Git 대용량 저장소 관리 팁](/posts/git-large-repo-tips/)

**다음 글:** [Git LFS 트래킹 설정과 해제](/posts/git-lfs-track-untrack/)

<br>
읽어주셔서 감사합니다. 😊
