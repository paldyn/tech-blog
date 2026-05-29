---
title: "GitHub Projects: 칸반으로 이슈와 PR 관리하기"
description: "GitHub Projects로 이슈와 PR을 보드·테이블로 시각화하고 커스텀 필드로 관리하는 방법, 내장 자동화로 카드를 자동 이동시키는 규칙, 뷰와 그룹핑 활용, 그리고 운영 팁을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Projects", "칸반", "프로젝트관리", "협업"]
featured: false
draft: false
---

[지난 글](/posts/github-issues/)에서 이슈로 개별 작업을 추적하는 법을 다뤘다. 이슈가 수십 개로 늘어나면 목록만으로는 "지금 무엇이 진행 중이고, 무엇이 막혀 있고, 무엇이 끝났는지" 한눈에 보기 어렵다. **GitHub Projects**는 이슈와 PR을 칸반 보드나 테이블로 시각화해, 작업의 흐름을 팀 전체가 함께 볼 수 있게 해 준다.

## Projects의 기본 구조

GitHub Projects(흔히 "Projects v2")는 이슈·PR·그리고 자유 양식의 초안(draft) 항목을 모아 놓은 데이터 집합이다. 같은 데이터를 여러 **뷰(view)** 로 볼 수 있다는 점이 핵심이다.

- **Board 뷰**: 칸반 보드. 컬럼은 보통 `Status` 필드의 값(Todo / In progress / Done)
- **Table 뷰**: 스프레드시트처럼 행·열로. 정렬·필터·일괄 편집에 강함
- **Roadmap 뷰**: 날짜 필드 기준 타임라인

![칸반 보드 뷰](/assets/posts/github-projects-board.svg)

여기에 **커스텀 필드**를 더할 수 있다. 단일 선택(Priority: High/Med/Low), 숫자(Estimate), 날짜(Due date), 텍스트, 반복 기간(Iteration) 등을 정의해 이슈마다 값을 채우면, 그 필드로 그룹핑·필터·정렬할 수 있다.

## 내장 자동화로 보드가 스스로 움직인다

Projects의 가장 큰 장점은 카드를 일일이 끌어다 옮기지 않아도 된다는 것이다. 프로젝트의 **Workflows** 설정에 미리 만들어진 규칙들이 있다.

![내장 자동화로 카드가 스스로 움직인다](/assets/posts/github-projects-automation.svg)

기본 제공되는 자동 규칙은 다음과 같다.

```text
- Item added to project        → Status: Todo
- Issue/PR closed              → Status: Done
- Pull request merged          → Status: Done
- Code review approved         → (원하는 상태로)
- Auto-add: 특정 라벨이 붙은 이슈를 프로젝트에 자동 편입
```

`Auto-add to project` 규칙을 켜면, 저장소에서 조건(예: `label:bug`)에 맞는 이슈가 생길 때마다 프로젝트에 자동으로 들어온다. 사람이 매번 추가할 필요가 없다.

## CLI와 필터로 관리하기

`gh` CLI에도 프로젝트 명령이 있어, 항목 추가나 조회를 스크립트로 자동화할 수 있다.

```bash
# 내 조직의 프로젝트 목록
gh project list --owner my-org

# 프로젝트에 이슈 추가
gh project item-add 5 --owner my-org \
  --url https://github.com/my-org/repo/issues/38

# 항목 목록 조회
gh project item-list 5 --owner my-org
```

뷰 안에서는 GitHub 검색 문법과 비슷한 필터를 쓸 수 있다.

```text
status:"In progress"        # 진행 중만
assignee:@me                # 내게 할당된 것
label:bug priority:High     # 라벨 + 커스텀 필드 조합
no:assignee                 # 담당자 없는 항목
```

## 운영 팁

```text
- Status 컬럼은 3~5개로: 너무 많으면 흐름이 안 보인다
- WIP 제한을 두자: In progress가 쌓이면 끝내기에 집중
- 자동화를 먼저 켜라: 수동 이동은 결국 누락된다
- Iteration 필드로 스프린트 운영 가능
- 보드는 '현재 상태', 마일스톤은 '릴리즈 단위' — 역할 구분
```

Board 뷰는 지금의 흐름을 보여 주고, Table 뷰는 백로그를 정리하는 데 좋다. 둘을 함께 쓰면 같은 데이터를 일하는 맥락에 맞게 바꿔 볼 수 있다. 이슈·PR·리뷰·자동화·프로젝트까지, 한 저장소 안에서 협업이 굴러가는 그림이 거의 완성됐다. 다음 글에서는 저장소에 직접 push 권한이 없는 외부 기여자가 변경을 제안하는 **Fork & Pull Request 워크플로우**를 살펴본다.

---

**지난 글:** [GitHub Issues: 작업과 버그를 추적하는 법](/posts/github-issues/)

**다음 글:** [Fork & Pull Request 워크플로우: 오픈소스 기여 흐름](/posts/github-fork-pr-flow/)

<br>
읽어주셔서 감사합니다. 😊
