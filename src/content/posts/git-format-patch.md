---
title: "git format-patch: 커밋을 패치 파일로 만들어 공유하기"
description: "커밋을 이메일로 주고받을 수 있는 mbox 형식의 .patch 파일로 변환하는 git format-patch의 사용법과 출력 구조, 커버 레터·범위 지정 옵션을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["git-format-patch", "패치", "이메일워크플로우", "오픈소스", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-bundle/)에서 저장소를 단일 파일로 묶어 오프라인에서 옮기는 `git bundle`을 살펴봤습니다. 번들이 저장소 전체나 커밋 묶음을 통째로 옮기는 도구라면, 이번에 볼 `git format-patch`는 **개별 커밋 하나하나를 사람이 읽고 검토할 수 있는 패치 파일**로 바꿔 줍니다. 리눅스 커널을 비롯한 많은 오픈소스 프로젝트가 지금도 이 방식으로 코드를 주고받습니다.

## 왜 패치 파일인가

GitHub의 Pull Request에 익숙하다면 패치 파일이 낯설 수 있습니다. 하지만 중앙 서버에 의존하지 않고, 메일링 리스트에서 변경 내용을 텍스트로 검토하고 토론하는 워크플로우에서는 패치가 표준입니다. 패치 파일 하나에는 변경된 코드(diff)뿐 아니라 **커밋 메시지·작성자·작성 시각**이 모두 들어 있어, 받는 쪽이 원래 커밋을 그대로 복원할 수 있습니다.

![format-patch / am 흐름](/assets/posts/git-format-patch-flow.svg)

## 기본 사용법

가장 자주 쓰는 형태는 "최근 몇 개의 커밋"을 패치로 뽑는 것입니다.

```bash
# 마지막 커밋 1개를 패치로
git format-patch -1

# 최근 3개 커밋을 각각 패치 파일로
git format-patch -3 HEAD

# main 이후에 쌓인 내 커밋 전부
git format-patch origin/main..HEAD
```

실행하면 `0001-fix-login.patch`, `0002-add-tests.patch`처럼 커밋마다 번호가 매겨진 파일이 생깁니다. 번호 순서가 곧 적용 순서이므로, 받는 쪽은 순서대로 적용하기만 하면 됩니다.

## 패치 파일의 구조

생성된 `.patch` 파일을 열어 보면 이메일(mbox) 형식임을 알 수 있습니다.

![.patch 구조](/assets/posts/git-format-patch-anatomy.svg)

맨 위에는 `From`, `Date`, `Subject` 같은 메일 헤더가 있고, 이어서 커밋 메시지 본문, 그 아래에 실제 diff가 붙습니다. `Subject`에는 `[PATCH]` 접두사와 커밋 제목이 들어가는데, 여러 패치를 보낼 때는 `[PATCH 1/3]`처럼 순번이 자동으로 표시됩니다. 이 구조 덕분에 패치를 그대로 메일로 보내면 받는 쪽 메일 클라이언트나 `git am`이 헤더를 읽어 커밋을 재구성합니다.

## 유용한 옵션

여러 패치를 한 묶음으로 보낼 때는 전체를 설명하는 커버 레터가 있으면 좋습니다.

```bash
# 0000-cover-letter.patch 를 함께 생성
git format-patch -3 --cover-letter

# 파일 대신 표준출력으로 (단일 파일에 합치기 좋음)
git format-patch -1 --stdout > my-change.patch

# 출력 디렉터리 지정
git format-patch -5 -o patches/
```

`--cover-letter`로 만들어진 `0000-`번 파일에는 패치 시리즈 전체의 요약을 적습니다. `--stdout`은 여러 커밋을 하나의 스트림으로 내보내므로, 한 파일에 모아 두거나 파이프로 바로 넘길 때 편리합니다.

## 범위 지정의 감각

`format-patch`에서 가장 헷갈리는 부분이 "어디부터 어디까지"입니다. `git format-patch main`은 `main..HEAD`의 줄임으로, 현재 브랜치가 `main`보다 앞선 커밋들을 뽑습니다. 반면 `-3 HEAD`는 개수 기준입니다.

```bash
# 두 표현은 보통 같은 결과 (main 기준으로 갈라진 커밋들)
git format-patch main
git format-patch main..HEAD

# 특정 커밋 하나만 콕 집어서
git format-patch -1 a1b2c3d
```

기준이 되는 커밋(예: `main`)은 패치에 **포함되지 않고**, 그 이후 커밋들만 뽑힌다는 점만 기억하면 범위 지정이 명확해집니다.

## 정리

`git format-patch`는 커밋을 작성자·메시지·diff가 모두 담긴 mbox 형식의 패치 파일로 변환합니다. `-N`으로 개수를, `base..HEAD`로 범위를 지정하고, 여러 커밋을 보낼 때는 `--cover-letter`로 요약을 덧붙입니다. 이렇게 만든 패치를 받는 쪽이 어떻게 적용하는지는 바로 다음 글에서 다룰 `git am`이 책임집니다.

---

**지난 글:** [git bundle: 저장소를 단일 파일로 묶어 오프라인에서 주고받기](/posts/git-bundle/)

**다음 글:** [git am: 메일박스 패치를 커밋으로 되살리기](/posts/git-am/)

<br>
읽어주셔서 감사합니다. 😊
