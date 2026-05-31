---
title: "git apply: 커밋 없이 작업 트리에만 패치 적용하기"
description: "diff 패치를 커밋 생성 없이 작업 트리에 그대로 입히는 git apply의 사용법과 git am과의 차이, --check·--stat·--3way·--index·-R 같은 핵심 옵션을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["git-apply", "패치", "diff", "작업트리", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-am/)에서 패치 파일을 작성자 정보까지 담은 커밋으로 되살리는 `git am`을 살펴봤습니다. 그런데 항상 커밋까지 만들어야 하는 것은 아닙니다. 변경 내용만 일단 내 작업 트리에 얹어 보고, 커밋은 내 손으로 정리하고 싶을 때가 있습니다. 이럴 때 쓰는 더 가벼운 도구가 `git apply`입니다.

## git apply vs git am

두 명령은 모두 패치를 적용하지만 결정적으로 다릅니다. `git am`이 **커밋을 만드는** 데 반해, `git apply`는 **파일만 바꿉니다**. 작성자·날짜·커밋 메시지를 다루지 않고, 순수한 코드 변경(diff)만 작업 트리에 반영합니다.

![git apply vs git am](/assets/posts/git-apply-vs-am.svg)

그래서 `git apply`는 메일박스 헤더가 없는 순수 diff 파일에 잘 맞습니다. `git diff > change.diff`로 만든 파일이나, 코드 리뷰 도구가 내려준 diff 조각을 적용할 때 자연스럽습니다.

```bash
# 순수 diff 패치를 작업 트리에 적용
git apply change.diff
```

적용 후 `git status`를 보면 변경된 파일이 수정 상태로 나타날 뿐, 새 커밋은 없습니다. 어떻게 커밋으로 묶을지는 전적으로 내 몫입니다.

## 적용 전에 안전하게 확인하기

`git apply`는 패치가 깔끔하게 들어맞지 않으면 아무것도 적용하지 않고 실패합니다. 그래서 본 적용 전에 미리 점검하는 옵션이 유용합니다.

![git apply 옵션](/assets/posts/git-apply-options.svg)

```bash
# 적용 가능한지만 검사 (파일은 건드리지 않음)
git apply --check change.diff

# 어떤 파일이 얼마나 바뀌는지 요약만 출력
git apply --stat change.diff
```

`--check`는 "이 패치가 지금 코드에 깨끗하게 적용되는가"를 미리 알려 주므로, 자동화 스크립트에서 적용 가능 여부를 판단할 때 특히 유용합니다. `--stat`은 실제 적용 없이 변경 규모만 미리 보여 줍니다.

## 충돌과 스테이징 제어

패치가 현재 코드와 어긋날 때는 `--3way`로 3-방향 병합을 시도할 수 있습니다.

```bash
# 충돌 시 공통 조상을 활용해 병합 시도
git apply --3way change.diff

# 작업 트리뿐 아니라 스테이징 영역에도 함께 적용
git apply --index change.diff

# 스테이징 영역에만 적용 (작업 트리는 그대로)
git apply --cached change.diff
```

`--3way`는 단순 매칭이 실패해도 충돌 마커를 남기며 최대한 병합해 줍니다. `--index`는 적용과 동시에 `git add`까지 한 효과를 내고, `--cached`는 인덱스만 바꿔 부분 스테이징 같은 정교한 조작에 쓰입니다.

## 적용한 패치 되돌리기

이미 적용한 패치를 거꾸로 되돌리려면 `-R`(reverse)을 씁니다.

```bash
# 방금 적용한 패치를 역으로 취소
git apply -R change.diff
```

패치를 적용했다가 문제가 생겼을 때, 같은 파일에 `-R`을 붙여 다시 실행하면 변경이 깔끔하게 사라집니다. `patch -p1 < change.diff` 같은 전통적 도구와 비슷하지만, git이 경로와 컨텍스트를 더 똑똑하게 처리한다는 장점이 있습니다.

## 언제 무엇을 쓰나

정리하면 선택 기준은 명확합니다. **커밋 정보(작성자·메시지)를 보존하며 커밋까지 만들고 싶다면 `git am`**, **변경 내용만 작업 트리에 얹고 커밋은 직접 구성하고 싶다면 `git apply`**입니다. 코드 리뷰 중 받은 diff를 잠깐 적용해 확인하거나, CI 스크립트에서 패치 적용 가능성만 검사하는 상황이라면 `git apply`가 훨씬 가볍고 적합합니다.

## 정리

`git apply`는 커밋을 만들지 않고 diff를 작업 트리에 입히는 도구입니다. `--check`로 적용 가능성을 미리 확인하고, `--stat`으로 규모를 살피며, `--3way`로 충돌을 완화하고, `--index`/`--cached`로 스테이징을 제어하며, `-R`로 되돌립니다. 다음 글에서는 흩어진 작성자 신원을 출력 단계에서 하나로 묶어 주는 `.mailmap`을 살펴봅니다.

---

**지난 글:** [git am: 메일박스 패치를 커밋으로 되살리기](/posts/git-am/)

**다음 글:** [git mailmap: 흩어진 작성자 신원을 하나로 통합하기](/posts/git-mailmap/)

<br>
읽어주셔서 감사합니다. 😊
