---
title: "git archive: 저장소를 아카이브로 내보내기"
description: "git archive로 특정 시점의 소스를 .git 히스토리 없이 tar·zip으로 묶어 내보내는 법. --prefix·--format 옵션, export-ignore로 파일 제외하기, 원격 저장소 아카이브와 배포·백업 활용까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "archive", "배포", "릴리즈", "tar", "백업"]
featured: false
draft: false
---

[지난 글](/posts/git-diff-stat/)에서 `--stat`으로 변경 규모를 요약해 보는 법을 다뤘다. 이번엔 저장소를 다루는 또 다른 실무 작업, **소스 내보내기**다. 특정 버전의 소스 코드를 누군가에게 전달하거나 서버에 배포해야 할 때, `git clone`을 쓰면 `.git` 폴더에 담긴 전체 히스토리까지 통째로 따라온다. 받는 쪽은 커밋 기록이 필요 없는데도 무거운 `.git`을 떠안게 된다. **`git archive`**는 지정한 시점의 **파일 스냅샷만** tar나 zip으로 깔끔하게 묶어 내보낸다.

핵심은 "버전 관리 메타데이터를 뺀, 순수한 소스 묶음"을 만든다는 점이다. 릴리즈 산출물, 배포 패키지, 코드 백업, 또는 빌드 서버에 소스를 넘길 때 적합하다.

![archive는 히스토리 없이 스냅샷만 내보낸다](/assets/posts/git-archive-concept.svg)

## 기본 사용법

가장 단순한 형태는 트리(커밋·태그·브랜치)를 지정해 tar로 내보내는 것이다. 출력은 표준 출력으로 나오므로 파일로 저장하려면 리다이렉트하거나 `-o`를 쓴다.

```bash
# 현재 HEAD를 tar로 묶어 파일로 저장
git archive -o source.tar HEAD

# 특정 태그 버전을 내보내기
git archive -o release-1.0.tar v1.0

# 표준 출력으로 내보내 파이프로 연결
git archive HEAD | gzip > source.tar.gz
```

`git archive`는 작업 트리의 변경(스테이징 안 된 수정)이 아니라, 지정한 **커밋에 기록된 내용**을 내보낸다는 점을 기억하자. 즉 깨끗하고 재현 가능한 스냅샷을 보장한다.

## 포맷과 --prefix

출력 형식은 `--format`으로 정한다. `tar`, `tar.gz`, `zip`을 지원하며, 파일 확장자(`-o foo.zip`)로 자동 추론되기도 한다. 압축을 풀었을 때 모든 파일이 현재 디렉터리에 흩어지는 것을 막으려면 `--prefix`로 최상위 폴더를 붙인다.

![포맷과 자주 쓰는 옵션](/assets/posts/git-archive-formats.svg)

```bash
# tar.gz + 최상위 폴더 이름 부여
git archive --format=tar.gz --prefix=app-1.0/ -o app-1.0.tar.gz v1.0

# zip 포맷
git archive --format=zip -o src.zip HEAD

# 지원 포맷 확인
git archive --list
```

`--prefix=app-1.0/`를 주면 압축 해제 시 모든 파일이 `app-1.0/` 폴더 아래 정리되어, 흔히 보는 릴리즈 tarball 구조가 된다. 끝의 슬래시(`/`)를 빠뜨리면 폴더가 아니라 파일명 접두어가 되니 주의한다.

## 일부 경로만, 그리고 파일 제외하기

전체가 아니라 특정 하위 디렉터리만 내보낼 수도 있다.

```bash
git archive -o docs.tar HEAD docs/ src/public/
```

반대로, 아카이브에서 빼고 싶은 파일이 있다면 `.gitattributes`에 `export-ignore` 속성을 지정한다. 테스트 코드, CI 설정, 개발용 스크립트처럼 배포 산출물에 불필요한 항목을 제외할 때 유용하다.

```text
# .gitattributes
tests/        export-ignore
.github/      export-ignore
*.dev.js      export-ignore
```

이렇게 지정하면 `git archive`로 만든 묶음에서 해당 경로가 빠진다. `git clone`이나 작업 트리에는 영향을 주지 않고, 오직 아카이브 산출물에만 적용된다는 점이 핵심이다. 비슷하게 `export-subst` 속성으로 파일 안에 커밋 정보(예: 버전 해시)를 치환해 넣을 수도 있다.

## 원격 저장소에서 바로 받기

로컬에 클론하지 않고 원격 저장소에서 직접 아카이브를 받을 수도 있다. 단, 서버가 이 기능을 허용해야 한다(많은 호스팅은 보안상 제한한다).

```bash
git archive --remote=ssh://git@host/repo.git --format=tar.gz -o app.tar.gz v1.0
```

GitHub 같은 호스팅은 `git archive --remote` 대신, 태그·릴리즈마다 자동 생성되는 소스 tarball/zip 다운로드 링크를 제공하므로 그쪽을 쓰는 편이 일반적이다.

정리하면, "히스토리는 빼고 특정 버전의 파일만 깔끔하게" 필요할 때 `git archive`가 정답이다. `--prefix`로 폴더 구조를 잡고, `export-ignore`로 배포에 불필요한 파일을 솎아내면, 릴리즈 파이프라인에 바로 끼워 넣을 수 있는 재현 가능한 산출물이 만들어진다. 빌드 시스템에서 `git archive`로 소스를 추출해 패키징하는 패턴은 지금도 널리 쓰인다.

---

**지난 글:** [git diff --stat: 변경 요약 한눈에 보기](/posts/git-diff-stat/)

<br>
읽어주셔서 감사합니다. 😊
