---
title: "git mailmap: 흩어진 작성자 신원을 하나로 통합하기"
description: "여러 이메일·이름으로 남은 커밋 기록을 .mailmap 파일로 정규화해 git log·shortlog·blame에서 한 사람으로 보이게 만드는 방법과 매핑 작성 형식을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["git-mailmap", "작성자", "shortlog", "기여통계", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-apply/)에서 패치를 커밋 없이 작업 트리에 적용하는 `git apply`를 살펴봤습니다. 패치를 주고받다 보면, 또 회사·집·노트북을 오가며 작업하다 보면 같은 사람이 여러 이메일과 이름으로 커밋을 남기게 됩니다. 그러면 `git shortlog`의 기여자 통계가 한 사람을 여러 명으로 쪼개 버립니다. `.mailmap`은 이렇게 흩어진 신원을 **출력 단계에서** 하나로 모아 줍니다.

## 문제: 한 사람이 여러 명으로 집계된다

다음처럼 같은 개발자가 서로 다른 이메일로 커밋했다고 합시다.

```bash
git shortlog -sne
#   42  gildong <hong@old.com>
#   18  Hong G. <hong@home.net>
#   31  홍길동 <hong@paldyn.com>
```

실제로는 한 사람인데 통계상 세 명입니다. 기여도를 정리해 릴리스 노트를 쓰거나 컨트리뷰터 목록을 만들 때 이런 분산은 골칫거리입니다.

![.mailmap 통합 효과](/assets/posts/git-mailmap-mapping.svg)

여기서 중요한 사실은 **이미 쌓인 커밋의 작성자 정보를 바꾸지 않는다**는 점입니다. 히스토리를 다시 쓰는 `git filter-repo`와 달리, `.mailmap`은 git이 출력을 만들 때만 매핑을 적용합니다. 커밋 SHA는 그대로이고, 표시되는 이름만 정돈됩니다.

## .mailmap 작성하기

저장소 루트에 `.mailmap`이라는 파일을 만들고, "대표 신원"과 "바꿀 신원"을 한 줄씩 적습니다.

![.mailmap 형식](/assets/posts/git-mailmap-format.svg)

```text
# 형식: 대표이름 <대표메일> <바꿀메일>
홍길동 <hong@paldyn.com> <hong@old.com>
홍길동 <hong@paldyn.com> <hong@home.net>
```

이렇게 하면 `hong@old.com`과 `hong@home.net`으로 남은 커밋이 모두 `홍길동 <hong@paldyn.com>`으로 표시됩니다. 다시 `git shortlog -sne`를 실행하면 세 줄이 한 줄로 합쳐집니다.

## 매핑의 여러 형태

`.mailmap`은 상황에 따라 몇 가지 형식을 지원합니다.

```text
# 1) 대표 메일만 지정 (이름은 커밋 그대로)
<hong@paldyn.com> <hong@old.com>

# 2) 이름과 메일을 모두 교체
홍길동 <hong@paldyn.com> gildong <hong@home.net>

# 3) 같은 메일인데 이름 표기만 통일
홍길동 <hong@paldyn.com> Hong G. <hong@paldyn.com>
```

규칙은 직관적입니다. 줄의 **앞쪽**이 최종적으로 보여 줄 대표 신원이고, **뒤쪽**이 그 대표값으로 바꿔야 할 원래 커밋의 신원입니다. 뒤쪽에 이름까지 적으면 "이 이름과 이 메일의 조합"만 정확히 골라 바꿉니다.

## 매핑을 정확히 만드는 요령

먼저 저장소에 실제로 어떤 신원들이 있는지 파악하는 것이 순서입니다.

```bash
# 이름·이메일 조합별 커밋 수를 모두 나열
git shortlog -sne --all

# 특정 이메일로 남은 커밋만 확인
git log --author="hong@old.com" --oneline
```

`git shortlog -sne`로 분산된 신원 목록을 뽑은 뒤, 같은 사람으로 묶을 항목을 골라 `.mailmap`에 한 줄씩 추가하면 됩니다. 파일을 커밋해 저장소에 포함시키면 팀원 모두가 동일한 정규화 결과를 보게 됩니다.

## 어디에 적용되나

`.mailmap`은 작성자·커미터 정보를 출력하는 git 명령 전반에 자동으로 반영됩니다. `git log`, `git shortlog`, `git blame`이 대표적이며, `%aN`·`%aE`(매핑 적용된 이름·메일) 같은 포맷 지정자도 이 규칙을 따릅니다.

```bash
# 매핑이 적용된 작성자 이름으로 로그 출력
git log --pretty="%h %aN <%aE> %s"
```

대문자 `%aN`/`%aE`는 mailmap을 적용한 값을, 소문자 `%an`/`%ae`는 커밋에 기록된 원래 값을 보여 준다는 차이도 함께 알아 두면 좋습니다.

## 정리

`.mailmap`은 히스토리를 다시 쓰지 않고, 출력 단계에서만 작성자 신원을 대표값으로 통일해 주는 가벼운 도구입니다. 저장소 루트에 파일을 두고 "대표 신원 ← 바꿀 신원" 규칙을 한 줄씩 적으면, `git log`·`shortlog`·`blame`이 자동으로 적용합니다. 여러 이메일로 흩어진 기여를 깔끔하게 정리해, 정확한 기여 통계와 컨트리뷰터 목록을 만들 수 있습니다.

---

**지난 글:** [git apply: 커밋 없이 작업 트리에만 패치 적용하기](/posts/git-apply/)

<br>
읽어주셔서 감사합니다. 😊
