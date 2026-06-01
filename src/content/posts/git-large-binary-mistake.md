---
title: "대용량 바이너리를 실수로 커밋했을 때"
description: "큰 바이너리 파일을 잘못 커밋해 저장소가 비대해진 상황에서, 다음 커밋의 삭제로는 해결되지 않는 이유와 git filter-repo로 히스토리에서 blob을 제거하는 절차, 재발 방지를 위한 .gitignore와 Git LFS 전환을 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "filter-repo", "저장소크기", "바이너리", "히스토리", "LFS"]
featured: false
draft: false
---

[지난 글](/posts/git-fix-wrong-branch-commit/)에서 커밋을 올바른 브랜치로 옮기는 법을 다뤘다. 이번 사고는 조금 더 끈질기다. 빌드 산출물이나 동영상, 디자인 원본 같은 **대용량 바이너리를 실수로 커밋**해 저장소가 수백 MB로 부풀어 오른 경우다. 흔히 "다음 커밋에서 파일을 지우면 되겠지"라고 생각하지만, 그렇게 해서는 저장소 크기가 줄지 않는다. 왜 그런지부터 짚고, 제대로 제거하는 방법을 살펴보자.

## 왜 지워도 줄지 않을까

Git은 모든 버전의 파일을 객체로 영구히 보관한다. 어떤 커밋에서 200MB 파일을 추가하면, *그 커밋이 히스토리에 존재하는 한* 200MB blob도 함께 남는다. 다음 커밋에서 `git rm`으로 삭제해도 "최신 트리에서 빠질" 뿐, 과거 커밋은 여전히 그 blob을 참조한다.

![대용량 파일은 지워도 히스토리에 남는다](/assets/posts/git-large-binary-mistake-impact.svg)

결과적으로 `git clone`이나 `git fetch`를 할 때마다 그 200MB가 따라온다. 저장소를 진짜로 가볍게 하려면 **과거 커밋들에서 blob 자체를 들어내야** 한다. 즉 히스토리를 다시 써야 한다.

## 먼저 무엇이 무거운지 찾기

손대기 전에 어떤 객체가 공간을 차지하는지 확인한다. 다음은 가장 큰 blob들을 크기순으로 보여 주는 관용구다.

```bash
# 패킹된 객체 중 큰 것부터 (파일 경로 포함)
git rev-list --objects --all |
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  awk '/^blob/ {print $3, $4}' | sort -rn | head -10
```

여기서 범인 파일의 경로를 확인했다면 제거 대상이 정해진다.

## git filter-repo로 제거하기

히스토리 재작성에는 공식적으로 `git filter-repo`가 권장된다(예전의 `filter-branch`보다 빠르고 안전하다). 작업 순서는 세 단계다.

![filter-repo로 blob을 제거하는 절차](/assets/posts/git-large-binary-mistake-fix.svg)

먼저 만일을 대비해 저장소를 미러로 백업해 둔다. 히스토리 재작성은 되돌리기 어렵기 때문이다.

```bash
# 1) 안전 백업 (미러 clone)
git clone --mirror . ../repo-backup.git
```

그다음 문제의 경로를 전체 히스토리에서 제거한다. `--invert-paths`는 "지정한 경로를 *빼고* 남긴다"는 뜻이다.

```bash
# 2) 특정 파일을 모든 커밋에서 제거
git filter-repo --path assets/intro.mp4 --invert-paths

# 크기 기준 일괄 제거도 가능 (50MB 초과 blob 전부)
git filter-repo --strip-blobs-bigger-than 50M
```

마지막으로 재작성된 히스토리를 강제로 푸시한다. 모든 커밋의 SHA가 바뀌므로, 협업자에게 반드시 미리 알리고 재clone을 요청해야 한다.

```bash
# 3) 정리 후 강제 푸시 (모든 브랜치·태그)
git push origin --force --all
git push origin --force --tags
```

> `filter-repo`는 안전을 위해 원격(remote)을 자동으로 제거한다. 푸시 전에 `git remote add origin <url>`로 다시 연결해야 할 수 있다.

## 로컬 객체까지 비우기

filter-repo 후에도 로컬에는 도달 불가능한(dangling) 객체가 남아 있을 수 있다. reflog를 만료시키고 가비지 컬렉션을 강제하면 실제 디스크 용량이 회수된다.

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## 재발 방지가 진짜 해결책

한 번 청소했다면 같은 실수를 막는 장치를 둬야 한다. 우선 해당 패턴을 `.gitignore`에 추가한다.

```gitignore
# 빌드 산출물·대용량 미디어는 추적하지 않는다
dist/
*.mp4
*.psd
```

근본적으로 큰 파일을 버전 관리해야 한다면 일반 객체 대신 **Git LFS**로 다루는 편이 낫다. LFS는 실제 바이너리를 별도 저장소에 두고 포인터만 커밋하므로, 본체 저장소가 가벼워진다.

```bash
# 앞으로 들어올 큰 파일은 LFS로
git lfs track "*.mp4"
git add .gitattributes
```

정리하면, 대용량 바이너리 사고는 "지우기"가 아니라 "히스토리에서 들어내기 + 재발 방지"의 조합으로 푼다. 그리고 히스토리 재작성은 협업자 전원에게 영향을 주므로 반드시 합의 후 진행한다. 다음 글에서는 같은 히스토리 청소 기술이 더 절박하게 필요한 상황, 비밀번호나 API 키가 커밋에 새어 들어갔을 때의 대응을 다룬다.

---

**지난 글:** [엉뚱한 브랜치에 커밋했을 때 바로잡기](/posts/git-fix-wrong-branch-commit/)

**다음 글:** [히스토리에 유출된 비밀정보 제거하기](/posts/git-secret-leak-cleanup/)

<br>
읽어주셔서 감사합니다. 😊
