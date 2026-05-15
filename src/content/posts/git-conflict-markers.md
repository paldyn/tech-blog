---
title: "충돌 마커 해설: <<<<<<< , =======, >>>>>>>"
description: "Git 충돌 파일에 삽입되는 세 마커의 의미, diff3 스타일로 공통 조상 보기, 마커를 제거하여 충돌을 해결하는 절차를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "충돌", "conflict", "conflict markers", "diff3"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-anatomy/)에서 Git 충돌이 언제, 왜 발생하는지 살펴봤다. 이번에는 충돌 파일을 열었을 때 보이는 **충돌 마커**를 낱낱이 해설한다. 마커를 제대로 읽어야 올바른 해결이 가능하다.

## 충돌 마커의 구조

충돌이 발생하면 Git은 해당 파일에 자동으로 마커를 삽입한다. 에디터로 파일을 열면 다음 패턴이 보인다.

```
<<<<<<< HEAD
    return 30       ← 현재 브랜치(HEAD)의 내용
=======
    return 60       ← 병합 대상 브랜치의 내용
>>>>>>> feature/timeout-fix
```

![충돌 마커 해부](/assets/posts/git-conflict-markers-anatomy.svg)

세 마커는 각각의 역할이 있다.

| 마커 | 의미 |
|------|------|
| `<<<<<<< HEAD` | 현재 브랜치(HEAD)의 변경 구역 시작 |
| `=======` | 두 변경 사이의 구분선 |
| `>>>>>>> 브랜치명` | 병합 대상 브랜치의 변경 구역 끝 |

`<<<<<<< HEAD`와 `=======` 사이가 **내 쪽(ours)**, `=======`와 `>>>>>>>` 사이가 **상대방 쪽(theirs)**이다.

## 해결 방법

원하는 최종 코드로 직접 편집하고 마커 세 줄을 포함한 불필요한 내용을 제거한다.

```python
# 충돌 전 (마커 포함)
<<<<<<< HEAD
    return 30
=======
    return 60
>>>>>>> feature/timeout-fix

# 해결 후 (합의된 값으로 교체)
    return 42
```

중요한 점: **마커 자체(`<<<<<<<`, `=======`, `>>>>>>>`)를 코드에 남기면 안 된다.** 마커가 남으면 Python은 문법 오류, JavaScript는 SyntaxError가 발생한다.

```bash
# 마커가 남아 있는지 검색
grep -rn "<<<<<<" src/
grep -rn "=======" src/
grep -rn ">>>>>>>" src/
```

## 충돌 유형별 마커

모든 충돌이 같은 패턴은 아니다. 파일이 한 브랜치에서 삭제되고 다른 브랜치에서 수정됐을 때는 다른 형태로 나타난다.

```
CONFLICT (modify/delete): config.py deleted in feature
and modified in HEAD.
```

이 경우 파일을 삭제할지 수정 버전을 유지할지 선택해야 한다.

```bash
# 파일 유지 후 커밋
git add config.py
# 파일 삭제 후 커밋
git rm config.py
```

## diff3 스타일: 공통 조상도 함께 보기

기본 충돌 마커는 두 브랜치의 내용만 보여준다. **diff3 스타일**을 활성화하면 `||||||| 공통 조상` 구역이 추가되어 세 버전을 한 번에 볼 수 있다.

```bash
git config --global merge.conflictstyle diff3
# 또는 더 정교한 zdiff3 (Git 2.35+)
git config --global merge.conflictstyle zdiff3
```

![diff3 스타일: 공통 조상 포함](/assets/posts/git-conflict-markers-diff3.svg)

공통 조상이 보이면 "누가 먼저 변경했는지"를 파악하기 쉬워진다. 공통 조상이 30이었는데 main은 30 그대로고 feature만 60으로 바꿨다면, feature의 변경을 채택하는 것이 논리적이다.

## 실제 편집 예시

`src/server.py`에 충돌이 났을 때의 전체 흐름이다.

```bash
# 1. 충돌 파일 확인
git status
# both modified: src/server.py

# 2. 파일 편집 (에디터로 마커 제거)
vim src/server.py

# 3. 마커가 남지 않았는지 검증
grep -n "<<<<<<" src/server.py  # 결과 없어야 함

# 4. 스테이지에 올리기
git add src/server.py

# 5. 커밋 또는 --continue
git commit -m "resolve: server timeout 값 합의"
```

## 자동 병합 결과 확인하기

`git diff`를 충돌 해결 후 `git add` 전에 실행하면 변경 내용을 확인할 수 있다.

```bash
git diff src/server.py   # 스테이지 전 변경사항
git diff --staged        # 스테이지된 변경사항
```

---

**지난 글:** [Git 충돌의 해부: 언제, 왜 발생하는가](/posts/git-conflict-anatomy/)

**다음 글:** [git mergetool로 시각적으로 충돌 해결하기](/posts/git-mergetool/)

<br>
읽어주셔서 감사합니다. 😊
