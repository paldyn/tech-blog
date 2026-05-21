---
title: "git bisect skip으로 불량 커밋 건너뛰기"
description: "컴파일 실패, 환경 의존 등 테스트 불가 커밋을 git bisect skip으로 건너뛰는 방법과 skip 결과 해석, 후속 처리 전략을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "bisect", "skip", "디버깅", "버그추적"]
featured: false
draft: false
---

[지난 글](/posts/git-bisect-script/)에서 `git bisect run`으로 탐색을 자동화했다. 실제 프로젝트에서는 탐색 범위 안에 컴파일 실패, 깨진 의존성, 환경 문제 등으로 테스트 자체를 실행할 수 없는 커밋이 있다. 이럴 때 `git bisect skip`이 해결책이다.

## skip이 필요한 상황

bisect 도중 체크아웃된 커밋에서 빌드가 깨져 있거나, 특정 인프라 환경에서만 재현되는 문제라서 현재 환경에서 테스트할 수 없는 경우가 생긴다. 이 커밋에서 `bad`를 입력하면 false positive가 되고, `good`을 입력하면 탐색 범위가 잘못 좁혀진다. `skip`은 해당 커밋을 판정 대상에서 제외하고 인근 커밋으로 이동한다.

![bisect skip 개념과 명령어](/assets/posts/git-bisect-skip-concept.svg)

## 수동 skip 사용법

```bash
# 현재 체크아웃 커밋 건너뛰기
git bisect skip

# 특정 SHA 건너뛰기 (현재 커밋이 아닌 경우)
git bisect skip 3f4a2b1

# 연속된 범위 전체 건너뛰기
git bisect skip 3f4a2b1..9c8d7e6
```

범위 표기(`A..B`)는 A 이후부터 B까지(A 제외, B 포함)다. 알려진 불량 구간 전체를 한 번에 건너뛸 때 유용하다.

## bisect run에서 자동 skip: exit 125

스크립트 자동화와 함께 쓸 때는 `exit 125`로 skip을 신호한다.

```bash
#!/bin/bash
# bisect-test.sh

# 빌드 실패 시 skip (테스트 불가)
make build 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Build failed — skipping this commit"
    exit 125
fi

# 의존 서비스 확인 — 없으면 skip
if ! curl -sf http://localhost:5432 > /dev/null 2>&1; then
    echo "DB not available — skipping"
    exit 125
fi

# 실제 테스트
npm test -- --testPathPattern="payment"
# exit 0 = good, exit 1 = bad
```

`exit 125`는 Git이 이해하는 특수 종료 코드다. 128 이상은 bisect 즉시 중단을 의미하므로 skip 의도라면 반드시 125를 사용한다.

## skip 결과 해석

![skip 결과와 후속 처리 전략](/assets/posts/git-bisect-skip-strategy.svg)

skip이 탐색 결과에 미치는 영향은 skip 커밋의 위치에 따라 달라진다. 버그 커밋과 skip 커밋이 인접하지 않으면 정확한 커밋이 출력된다. 버그 커밋 바로 옆에 skip 커밋이 있다면 "후보 커밋 목록"을 제공한다.

```bash
# 범위 제공 시 출력 예시
# There are only 'skip'ped commits left to test.
# The first bad commit could be any of:
# abc1234...
# def5678...
# We cannot bisect more!
```

이 경우 후보 커밋들을 직접 체크아웃해 수동으로 확인한다.

```bash
# 후보 커밋 수동 검증
git bisect reset
git checkout abc1234
./test.sh && echo "GOOD" || echo "BAD"

git checkout def5678
./test.sh && echo "GOOD" || echo "BAD"
```

## 미리 알려진 skip 범위 지정

탐색 시작 전에 skip할 커밋 범위를 알고 있다면 처음부터 지정한다.

```bash
git bisect start
git bisect bad HEAD
git bisect good v3.0.0

# 이미 알고 있는 불량 구간 미리 skip
git bisect skip v3.1.0..v3.1.5

# 이후 bisect run으로 자동 탐색
git bisect run ./test.sh
```

## git bisect visualize로 시각 확인

skip 커밋이 포함된 상태에서 탐색 진행을 시각화해 볼 수 있다.

```bash
# 텍스트 그래프로 현재 bisect 상태 확인
git bisect visualize --oneline

# gitk GUI (설치된 경우)
git bisect view
```

good/bad/skip으로 표시된 커밋들과 아직 탐색되지 않은 범위를 한눈에 볼 수 있다.

## skip과 관련된 주의사항

skip을 남발하면 결과의 정확도가 떨어진다. 특히 연속된 skip이 많으면 Git이 범위를 특정하지 못하는 경우가 잦아진다. skip을 써야 하는 상황이라면 해당 커밋이 왜 테스트 불가인지 근본 원인을 파악해 두는 것이 좋다. 빌드 시스템 문제라면 bisect 외부에서 먼저 수정하고 재시작하는 쪽이 더 깔끔하다.

다음 글에서는 `git fsck`로 저장소 객체의 무결성을 검사하고 dangling object를 찾는 방법을 다룬다.

---

**지난 글:** [git bisect run으로 버그 탐색 자동화하기](/posts/git-bisect-script/)

**다음 글:** [git fsck로 저장소 무결성 검사하기](/posts/git-fsck/)

<br>
읽어주셔서 감사합니다. 😊
