---
title: "git am: 메일박스 패치를 커밋으로 되살리기"
description: "format-patch로 만든 .patch(mbox) 파일을 작성자·날짜·메시지까지 보존한 커밋으로 복원하는 git am의 사용법과 충돌 시 continue·skip·abort 흐름, --3way·--signoff 옵션을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["git-am", "패치적용", "이메일워크플로우", "충돌해결", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-format-patch/)에서 커밋을 mbox 형식의 패치 파일로 뽑아내는 `git format-patch`를 살펴봤습니다. 패치를 만들었으니 이제 받는 쪽에서 그 패치를 다시 커밋으로 되살릴 차례입니다. 바로 그 역할을 하는 명령이 `git am`(apply mailbox)입니다. 이름 그대로 "메일박스 형식의 패치를 적용한다"는 뜻입니다.

## git am이 하는 일

`git am`의 핵심은 단순한 코드 변경 적용이 아니라 **커밋의 완전한 복원**입니다. 패치 파일 맨 위의 `From`·`Date`·`Subject` 헤더를 읽어, 원래 작성자와 작성 시각, 커밋 메시지를 그대로 재현한 새 커밋을 만듭니다.

![git am 흐름](/assets/posts/git-am-flow.svg)

```bash
# 패치 하나 적용
git am 0001-fix-login.patch

# 여러 패치를 순서대로 한 번에
git am 0001-*.patch

# 메일박스 파일(여러 메일이 한 파일에)을 표준입력으로
git am < patches.mbox
```

적용이 끝나면 `git log`에서 새 커밋들을 확인할 수 있는데, 작성자가 내가 아니라 **패치를 만든 원저자**로 기록됩니다. 이것이 PR을 머지했을 때와 다른 점이자, 기여자의 공로를 정확히 남기는 방식입니다.

## 충돌이 났을 때

패치가 만들어진 시점과 적용하는 시점의 코드가 다르면 충돌이 납니다. 이때 `git am`은 멈추고 세 가지 선택지를 줍니다.

![am 충돌 처리](/assets/posts/git-am-conflict.svg)

```bash
# 1) 충돌 파일을 직접 수정 후 스테이징하고 계속
#    (git commit 이 아니라 am --continue 임에 주의)
git add <해결한_파일>
git am --continue

# 2) 지금 패치는 건너뛰고 나머지 패치 계속
git am --skip

# 3) 처음부터 없던 일로 되돌리기
git am --abort
```

가장 흔한 실수는 충돌을 해결한 뒤 `git commit`을 치는 것입니다. `git am` 도중에는 일반 커밋이 아니라 반드시 `--continue`로 진행해야 패치의 원래 메시지와 작성자 정보가 유지됩니다.

## 자동 병합 성공률 높이기: --3way

단순한 충돌은 `--3way` 옵션으로 상당 부분 자동 해결됩니다.

```bash
git am --3way 0001-fix-login.patch
# 또는 짧게
git am -3 0001-fix-login.patch
```

`--3way`는 패치에 담긴 공통 조상(blob) 정보를 활용해 3-방향 병합을 시도합니다. 단순 라인 매칭만으로는 실패하던 패치도, 양쪽의 변경을 함께 고려해 자동으로 합칠 수 있어 충돌 빈도가 눈에 띄게 줄어듭니다. 패치 적용이 자주 실패한다면 가장 먼저 붙여 볼 옵션입니다.

## 자주 쓰는 부가 옵션

```bash
# 적용하면서 Signed-off-by 줄 추가 (DCO 요구 프로젝트)
git am --signoff 0001-*.patch

# 공백 관련 차이를 너그럽게 처리
git am --whitespace=fix 0001-*.patch
```

`--signoff`는 "이 패치의 출처를 보증한다"는 의미의 `Signed-off-by` 라인을 커밋에 덧붙입니다. 많은 오픈소스 프로젝트가 기여 조건(DCO)으로 이 서명을 요구합니다.

## format-patch와 한 쌍으로

`git am`은 `git format-patch`와 정확히 짝을 이룹니다. 보내는 쪽이 `format-patch`로 커밋을 패치로 직렬화하면, 받는 쪽이 `am`으로 역직렬화해 동일한 커밋을 복원합니다. 중앙 서버나 공통 원격 없이도, 텍스트 파일 하나만 오가면 히스토리가 온전히 전달되는 셈입니다.

## 정리

`git am`은 패치 파일을 작성자·날짜·메시지까지 보존한 커밋으로 되살립니다. 충돌이 나면 `--continue`·`--skip`·`--abort`로 흐름을 제어하고, `--3way`로 자동 병합 성공률을 높이며, `--signoff`로 기여 서명을 남길 수 있습니다. 다음 글에서는 커밋을 만들지 않고 작업 트리에만 변경을 입히는, 더 가벼운 사촌 격인 `git apply`를 살펴봅니다.

---

**지난 글:** [git format-patch: 커밋을 패치 파일로 만들어 공유하기](/posts/git-format-patch/)

**다음 글:** [git apply: 커밋 없이 작업 트리에만 패치 적용하기](/posts/git-apply/)

<br>
읽어주셔서 감사합니다. 😊
