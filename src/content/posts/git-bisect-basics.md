---
title: "git bisect로 버그 커밋 이진 탐색하기"
description: "git bisect의 이진 탐색 원리와 start/bad/good/reset 기본 명령어 사용법을 단계별로 설명한다. 수백 개 커밋에서 버그를 도입한 커밋을 몇 번만에 찾는 방법."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "bisect", "디버깅", "이진탐색", "버그추적"]
featured: false
draft: false
---

[지난 글](/posts/git-reflog-recover-branch/)에서 삭제된 브랜치를 reflog로 복구했다. 이번에는 히스토리를 탐색하는 또 다른 강력한 도구인 `git bisect`를 알아본다. "이 기능이 언제부터 망가졌지?"라는 질문에 이진 탐색으로 빠르게 답을 찾는 도구다.

## bisect가 필요한 상황

버그가 발생했는데 언제부터인지 모를 때, 커밋 이력을 하나씩 체크아웃하면서 테스트하는 방법은 시간이 너무 걸린다. 100개 커밋이라면 최악의 경우 100번을 테스트해야 한다. `git bisect`는 이진 탐색을 써서 커밋 수의 로그만큼만 체크아웃한다. 100개 커밋이라면 최대 7번(`log₂(100) ≈ 6.6`)이면 찾아낸다.

![git bisect 이진 탐색 개념](/assets/posts/git-bisect-basics-concept.svg)

## 기본 개념: good과 bad

bisect는 단 두 가지 정보만 필요하다.

- **bad**: 버그가 **있는** 커밋 (보통 현재 HEAD)
- **good**: 버그가 **없던** 마지막으로 알려진 커밋 (릴리즈 태그, 특정 날짜 등)

이 두 커밋 사이에서 Git이 중간값을 계속 체크아웃해주고, 개발자는 테스트 결과만 `bad` 또는 `good`으로 알려주면 된다. 탐색이 완료되면 Git이 버그를 도입한 정확한 커밋을 알려준다.

## 기본 명령어 흐름

![git bisect 명령어 흐름](/assets/posts/git-bisect-basics-commands.svg)

```bash
# 1. bisect 세션 시작
git bisect start

# 2. 버그가 있는 커밋 지정 (현재 HEAD)
git bisect bad

# 3. 버그가 없던 커밋 지정 (태그, SHA 모두 가능)
git bisect good v2.0.0
# Bisecting: 23 revisions left to test after this
# [abc1234] feat: 사용자 대시보드 추가
```

`good`을 지정하는 순간 Git이 중간 커밋으로 자동 이동한다. 출력의 숫자("23 revisions left")는 앞으로 몇 번 더 테스트가 필요한지 알려준다.

## 반복 루프: bad/good 판정

현재 체크아웃된 커밋에서 직접 테스트하고 결과를 입력한다.

```bash
# 현재 커밋에서 테스트 실행
npm test        # 또는 make test, pytest 등 프로젝트에 맞게

# 버그 있음
git bisect bad

# 버그 없음
git bisect good
# Bisecting: 11 revisions left to test after this
# [def5678] refactor: 인증 로직 분리
```

이 과정을 반복하면 탐색 범위가 계속 절반으로 줄어든다.

## 버그 커밋 발견

탐색이 완료되면 Git이 결과를 출력한다.

```bash
# 마지막 bisect 후 출력 예시
# ghi9012 is the first bad commit
# commit ghi9012
# Author: Kim Dev <kim@example.com>
# Date:   Thu May 15 14:32:01 2026 +0900
#
#     fix: 결제 모듈 null 처리 추가

# 해당 커밋에서 변경된 파일 확인
git show ghi9012 --stat
git show ghi9012 -- src/payment/
```

## 세션 종료: bisect reset

bisect가 끝나면 반드시 `reset`으로 원래 브랜치로 돌아간다. 이를 빠뜨리면 detached HEAD 상태가 유지된다.

```bash
# bisect 종료 → 원래 HEAD로 복귀
git bisect reset

# 특정 커밋으로 돌아가고 싶을 때
git bisect reset HEAD
git bisect reset abc1234
```

## bisect 도중 현재 위치 확인

bisect 세션 중 언제든지 현재 상태를 확인할 수 있다.

```bash
# 현재 bisect 진행 상황 확인
git bisect log
# git bisect start
# # bad: [HEAD_SHA] feat: 최신 기능
# git bisect bad HEAD
# # good: [v2.0.0_SHA] tag: v2.0.0
# git bisect good v2.0.0
# # good: [mid1_SHA] ...
# git bisect good

# 현재 남은 커밋 수 보기
git bisect view --oneline
```

## 잘못 표시한 경우: 취소하기

실수로 `bad`/`good`을 잘못 입력했다면 세션을 다시 시작하는 것이 가장 안전하다.

```bash
# bisect 전체 초기화 후 재시작
git bisect reset
git bisect start
git bisect bad HEAD
git bisect good v2.0.0
```

bisect 로그(`git bisect log` 출력)를 파일로 저장했다면 `git bisect replay` 로 지금까지의 판정을 재생할 수 있다.

```bash
# 판정 기록 저장
git bisect log > bisect-session.txt

# 재실행
git bisect replay bisect-session.txt
```

## 실전 팁

bisect를 효과적으로 활용하는 몇 가지 요령이 있다.

```bash
# good 커밋을 여러 개 지정 가능
git bisect start HEAD v1.0.0   # bad=HEAD, good=v1.0.0 한 줄로

# 커밋 SHA 직접 지정
git bisect bad 4f3a2b1
git bisect good a1b2c3d

# 릴리즈 태그 활용 (가장 실용적)
git bisect start
git bisect bad                 # HEAD
git bisect good v2.3.0         # 2주 전 릴리즈
```

좋은 `good` 커밋을 고르는 것이 효율의 핵심이다. 범위가 넓을수록 탐색 횟수가 늘어나지만, 좋은 `good` 커밋을 알수록 범위가 좁아져 빠르게 찾아낼 수 있다. 커밋 이력의 절반씩을 계속 좁혀나가는 이 과정은 다음 글에서 **스크립트 자동화**로 더욱 강력해진다.

---

**다음 글:** [git bisect 스크립트 자동화](/posts/git-bisect-script/)

<br>
읽어주셔서 감사합니다. 😊
