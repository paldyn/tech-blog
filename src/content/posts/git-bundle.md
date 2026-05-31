---
title: "git bundle: 저장소를 단일 파일로 묶어 오프라인에서 주고받기"
description: "네트워크 없이도 저장소 전체나 일부 커밋 범위를 하나의 .bundle 파일로 패키징해 옮기는 git bundle의 동작 원리와 create·verify·clone·pull 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["git-bundle", "오프라인", "백업", "저장소이동", "협업"]
featured: false
draft: false
---

[지난 글](/posts/semantic-release/)에서 커밋 메시지만으로 버전과 릴리스를 자동화하는 방법을 살펴봤습니다. 그런데 자동화는 보통 인터넷에 연결된 서버를 전제로 합니다. 망이 분리된 사내 환경, 보안상 외부 접속이 막힌 서버, 혹은 단순히 인터넷이 닿지 않는 현장처럼 원격 저장소에 push·pull 할 수 없는 상황이라면 어떻게 해야 할까요. `git bundle`은 저장소 전체 또는 일부를 **하나의 파일**로 묶어, USB나 이메일 첨부처럼 어떤 수단으로든 옮길 수 있게 해 줍니다.

## 번들이란 무엇인가

번들은 git이 내부적으로 쓰는 packfile에 참조 정보(ref)를 덧붙여 만든 단일 파일입니다. 평소 `git push`가 네트워크 너머로 보내는 객체 묶음을, 네트워크 대신 파일로 떨궈 두는 것이라고 생각하면 됩니다. 받는 쪽에서는 이 파일을 마치 원격 저장소처럼 다뤄 `clone`하거나 `pull`할 수 있습니다.

![git bundle 개념](/assets/posts/git-bundle-concept.svg)

핵심은 번들이 **온전한 git 객체와 히스토리를 그대로 담는다**는 점입니다. 단순히 파일을 압축한 zip과 달리, 커밋 그래프·브랜치·태그가 모두 보존되므로 받는 쪽에서 동일한 저장소를 복원할 수 있습니다.

## 번들 만들기

가장 기본은 모든 참조를 담는 `--all`입니다.

```bash
# 저장소 전체(모든 브랜치·태그)를 하나의 번들로
git bundle create repo.bundle --all

# 특정 브랜치만
git bundle create main.bundle main

# 최근 5개 커밋 범위만 (증분 전송)
git bundle create recent.bundle main~5..main
```

`--all`은 백업이나 저장소 통째 이전에 적합하고, 커밋 범위 지정은 "지난번에 보낸 이후 새로 쌓인 커밋만" 보내는 증분 동기화에 유용합니다. 범위는 `git log`에서 쓰는 표기를 그대로 사용합니다.

## 번들 검증하기

옮긴 번들이 손상되지 않았는지, 그리고 현재 저장소 위에 적용 가능한지를 미리 확인할 수 있습니다.

```bash
# 번들이 온전하고 필요한 조상 커밋이 있는지 검사
git bundle verify repo.bundle

# 번들이 담고 있는 참조(브랜치/태그) 목록 보기
git bundle list-heads repo.bundle
```

`verify`는 두 가지를 확인합니다. 첫째, 번들 파일 자체가 깨지지 않았는지. 둘째, 이 번들을 적용하려면 받는 저장소에 어떤 커밋이 미리 있어야 하는지(prerequisite)입니다. 증분 번들을 만들 때는 시작 커밋이 받는 쪽에 이미 있어야 하므로, 이 검증이 특히 중요합니다.

## 번들에서 복원하기

받는 쪽은 번들을 원격처럼 취급합니다.

```bash
# 번들로부터 새 저장소를 복제
git clone repo.bundle myrepo

# 이미 있는 저장소에 번들의 내용을 가져오기
cd myrepo
git pull ../recent.bundle main

# 특정 브랜치만 fetch
git fetch ../repo.bundle main:incoming
```

`clone`은 빈 디렉터리에 저장소를 통째로 복원할 때, `pull`이나 `fetch`는 기존 저장소에 새 커밋만 얹을 때 씁니다. 번들을 원격 URL 자리에 넣을 수 있다는 점만 기억하면 평소 쓰던 명령과 똑같습니다.

![git bundle 명령](/assets/posts/git-bundle-commands.svg)

## 어떤 상황에서 쓰는가

번들이 빛을 발하는 대표적인 경우는 다음과 같습니다. 망 분리 환경에서 외부 코드를 안으로 들여오거나 반대로 내보낼 때, 대용량 저장소를 한 번 통째로 옮긴 뒤 이후엔 증분 번들만 주고받을 때, 그리고 원격 서버 장애에 대비해 히스토리까지 포함한 백업을 단일 파일로 보관할 때입니다.

```bash
# 일일 백업: 날짜를 붙여 전체 번들 보관
git bundle create "backup-$(date +%Y%m%d).bundle" --all
```

zip 백업은 작업 트리 스냅샷일 뿐 히스토리가 없지만, 번들 백업은 그 자체로 완전한 저장소라는 점이 결정적인 차이입니다.

## 정리

`git bundle`은 "push/pull을 파일로 한다"는 한 문장으로 요약됩니다. `create`로 전체(`--all`)나 범위를 묶고, `verify`로 무결성과 적용 가능성을 확인한 뒤, 받는 쪽에서 `clone`·`pull`·`fetch`로 풀어내면 됩니다. 네트워크가 없는 곳에서도 히스토리를 잃지 않고 저장소를 옮길 수 있다는 점에서, 오프라인 협업과 백업 모두에 든든한 도구입니다.

---

**지난 글:** [semantic-release: 커밋 메시지로 버전과 릴리스를 자동화하기](/posts/semantic-release/)

**다음 글:** [git format-patch: 커밋을 패치 파일로 만들어 공유하기](/posts/git-format-patch/)

<br>
읽어주셔서 감사합니다. 😊
