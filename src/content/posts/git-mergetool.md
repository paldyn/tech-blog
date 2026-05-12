---
title: "git mergetool로 시각적으로 충돌 해결하기"
description: "git mergetool의 동작 원리, VS Code·vimdiff 등 주요 도구 설정, 실행 방법, 백업 파일 처리까지 mergetool 사용법 전반을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "mergetool", "충돌", "vimdiff", "VS Code"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-markers/)에서 충돌 마커를 직접 편집하는 방법을 배웠다. 텍스트 편집만으로도 충분하지만, 충돌이 복잡할 때는 **시각적 병합 도구(mergetool)**를 사용하면 훨씬 편하다. `git mergetool`은 충돌 파일을 자동으로 열어 도구에 넘겨준다.

## mergetool의 동작 원리

`git mergetool`을 실행하면 Git은 충돌 파일 목록을 순서대로 처리한다. 각 파일에 대해 다음 네 가지 임시 버전을 생성한다.

| 버전 | 의미 |
|------|------|
| `LOCAL` | 현재 브랜치(HEAD)의 버전 |
| `REMOTE` | 병합 대상 브랜치의 버전 |
| `BASE` | 공통 조상(두 브랜치가 갈라지기 전) 버전 |
| `MERGED` | 실제로 편집할 대상 파일 (충돌 마커 포함) |

도구 창에서 편집을 완료하고 저장하면 Git은 해당 파일이 해결됐다고 인식한다.

## 주요 도구 비교

![git mergetool 주요 도구 비교](/assets/posts/git-mergetool-overview.svg)

## VS Code 설정

VS Code는 별도 설치 없이 바로 mergetool로 사용할 수 있다.

```bash
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
git config --global mergetool.keepBackup false
```

`--wait` 플래그가 없으면 Git이 VS Code가 닫히기 전에 해결 완료로 판단한다. 반드시 포함해야 한다.

VS Code에서는 충돌 부분에 **Accept Current Change / Accept Incoming Change / Accept Both Changes** 버튼이 표시된다. 버튼 하나로 어느 쪽을 채택할지 선택할 수 있다.

## vimdiff 설정

SSH 서버나 터미널 환경에서는 vimdiff가 유용하다.

```bash
git config --global merge.tool vimdiff
git config --global merge.conflictstyle diff3
```

vimdiff는 4-pane 뷰로 열린다: LOCAL, BASE, REMOTE가 위에, MERGED가 아래에 표시된다. `]c`로 다음 충돌로, `[c`로 이전 충돌로 이동하고, `:diffget LOCAL` 또는 `:diffget REMOTE`로 선택한다.

## 실행과 정리

![mergetool 설정 및 실행 명령어](/assets/posts/git-mergetool-config.svg)

```bash
# 모든 충돌 파일 차례로 열기
git mergetool

# 특정 파일만
git mergetool src/auth.py

# 설정된 도구 무시하고 임시로 다른 도구 사용
git mergetool -t vimdiff
```

도구에서 저장 후 종료하면 Git은 파일을 자동으로 스테이지에 올리지 않는다. 직접 `git add`를 실행해야 한다.

```bash
git add src/auth.py
git commit
```

## 백업 파일 처리

mergetool은 기본적으로 원본 충돌 파일을 `.orig` 확장자로 백업한다. 이 파일이 필요 없다면 두 가지 방법으로 제거한다.

```bash
# 옵션 1: 전역 설정으로 백업 비활성화 (권장)
git config --global mergetool.keepBackup false

# 옵션 2: 수동 삭제
find . -name "*.orig" -delete

# .gitignore에 추가하는 방법도 있다
echo "*.orig" >> .gitignore
```

## 직접 편집 vs mergetool

충돌 해결 방법은 두 가지다. 상황에 맞게 선택한다.

| 방법 | 적합한 상황 |
|------|-------------|
| 직접 편집 | 충돌 수가 적고 간단한 경우 |
| mergetool | 충돌이 많거나 맥락 파악이 필요한 경우 |

어느 방법을 쓰든 결과는 동일하다. 마커 없이 올바른 코드가 담긴 파일을 `git add`한 뒤 커밋하면 된다.

---

**지난 글:** [충돌 마커 해설: &#60;&#60;&#60;&#60;&#60;&#60;&#60;, =======, &#62;&#62;&#62;&#62;&#62;&#62;&#62;](/posts/git-conflict-markers/)

**다음 글:** [충돌 해결 전략: -X ours와 -X theirs](/posts/git-conflict-strategy-ours-theirs/)

<br>
읽어주셔서 감사합니다. 😊
