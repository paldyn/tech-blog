---
title: "Git의 탄생과 역사"
description: "리눅스 커널 위기에서 탄생한 Git이 어떻게 10일 만에 만들어지고, 20년 만에 개발 문화의 표준이 됐는지 추적한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "역사", "Linus Torvalds", "Linux"]
featured: false
draft: false
---

[지난 글](/posts/git-distributed-vs-centralized/)에서 중앙집중식과 분산형 VCS의 아키텍처 차이를 살펴봤다. 그렇다면 Git은 왜, 어떻게 만들어졌을까? Git의 탄생 배경을 알면 왜 그런 설계를 선택했는지 이해하는 데 도움이 된다.

## 위기: BitKeeper 라이선스 파동

2002년 리눅스 커널 개발팀은 상용 VCS인 BitKeeper를 무료로 사용하는 특별 계약을 맺었다. 당시 CVS의 속도와 기능에 불만이 많았던 커널 개발자들에게 BitKeeper는 획기적이었다. 분산형이었고, 빠르고, 대규모 협업에 강했다.

하지만 2005년 4월, BitMover(BitKeeper 개발사)가 라이선스를 취소했다. 오픈소스 개발자 Andrew Tridgell이 BitKeeper 프로토콜을 리버스 엔지니어링하려 했다는 이유였다.

리눅스 커널은 전 세계 수천 명의 기여자가 동시에 작업하는 최대 규모의 오픈소스 프로젝트다. 버전 관리 도구 없이는 개발이 사실상 불가능했다. 대안 도구들(CVS, SVN, Monotone)은 커널의 규모와 속도 요구를 충족시키지 못했다.

## 탄생: 10일의 기적

Linus Torvalds는 기존 도구를 개선하는 대신 처음부터 새로 만들기로 했다. 2005년 4월 3일 개발을 시작해, 불과 10일 후인 4월 13일에 Git 초기 버전으로 Git 자체의 소스 코드를 관리하기 시작했다.

6월 16일에는 리눅스 커널 2.6.12가 Git으로 관리되기 시작했다. 단 두 달 만에 세계 최대 오픈소스 프로젝트의 VCS를 교체한 것이다.

![Git 탄생 타임라인](/assets/posts/git-history-timeline.svg)

Linus가 Git 개발 초기에 메일링리스트에 올린 글은 유명하다.

> "I'm a bastard. I have absolutely no clue why the hell it would be considered to be a slur... I name all my projects after myself. First Linux, now git."

'git'은 영국 속어로 "멍청한 놈"이라는 뜻이다. Linus는 농담 반으로 자신의 이름을 붙였다고 했다.

## 설계 원칙: CVS의 반대로

Linus는 Git을 설계할 때 CVS를 반면교사로 삼았다. 그의 표현은 명확했다.

> "CVS is the answer to what a version control system should NOT look like."

![Git 설계 목표](/assets/posts/git-history-design-goals.svg)

네 가지 핵심 목표가 Git의 아키텍처를 결정했다.

**속도**: CVS보다 반드시 빨라야 한다. 수천 개의 파일이 있는 리눅스 커널에서 패치 적용과 병합이 몇 초 안에 완료되어야 했다. 해결책은 모든 작업을 로컬에서 처리하는 것이었다.

**무결성**: 파일 하나라도 변조되면 즉시 감지해야 한다. 해결책은 SHA-1 해시였다. 모든 파일, 커밋, 트리가 해시로 식별된다. 내용이 조금이라도 다르면 해시가 달라진다.

**비선형 개발**: 수천 개의 브랜치를 동시에 지원해야 한다. 리눅스 커널은 서브시스템 유지관리자들이 각자의 브랜치를 운영하고 Linus가 취합한다. 해결책은 브랜치를 단순한 포인터(파일 하나)로 만드는 것이었다.

**완전한 분산**: 중앙 서버 없이도 모든 버전 관리 작업이 가능해야 한다. 각 개발자가 완전한 저장소 복사본을 가진다.

## 주요 이정표

```text
2005-04-03  Linus, Git 개발 시작
2005-04-13  Git으로 Git 자체 소스 관리 시작
2005-06-16  리눅스 커널 2.6.12 Git으로 이관
2005-07-26  Junio C Hamano가 메인테이너 인수
2008-04-10  GitHub 출시 (Git 대중화의 전환점)
2011        Stack Overflow 조사, Git이 SVN 추월
2016        Linux Foundation 조사, 72% 개발자 Git 사용
2022        Stack Overflow 조사, 93.9% 개발자 Git 사용
```

Linus는 Git의 초기 개발 후 빠르게 Junio C Hamano에게 메인테이너 역할을 넘겼다. Junio는 20년이 지난 현재까지도 Git 메인테이너로 활동하고 있다.

## GitHub의 역할

Git이 기술적으로 뛰어났다면, GitHub은 Git을 개발 문화의 언어로 만들었다. 2008년 출시된 GitHub은 Git 저장소 호스팅에 소셜 기능(Pull Request, 이슈, 스타, 포크)을 더했다.

오픈소스 기여가 극적으로 쉬워졌다. 프로젝트를 포크하고, 수정하고, Pull Request를 보내는 워크플로는 이전에 없던 오픈소스 생태계를 만들었다. 2018년 Microsoft가 GitHub을 75억 달러에 인수한 것은 Git 생태계의 중요성을 방증한다.

---

**지난 글:** [중앙집중식 vs 분산형 버전 관리](/posts/git-distributed-vs-centralized/)

**다음 글:** [Git 설치 가이드](/posts/git-install/)

<br>
읽어주셔서 감사합니다. 😊
