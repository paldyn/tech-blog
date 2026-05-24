---
title: "Git SHA-1 vs SHA-256: 해시 알고리즘 전환"
description: "Git 오브젝트 식별에 사용되는 SHA-1의 보안 취약점, SHA-256 지원 현황, git init --object-format=sha256으로 새 저장소를 만드는 방법과 호환성 주의사항을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "SHA-1", "SHA-256", "보안", "해시", "object-format", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-tag-object/)에서 네 가지 오브젝트 타입을 모두 살펴봤다. 모든 오브젝트는 SHA 해시로 식별된다. 이번에는 그 해시 알고리즘 자체를 들여다본다.

## Git과 SHA-1

Git은 오브젝트를 식별할 때 **SHA-1** 해시를 기본으로 사용한다. SHA-1은 160비트(40자 hex) 출력을 가지며, 같은 내용이면 반드시 같은 해시, 다른 내용이면 다른 해시가 나온다는 특성을 기반으로 Content-Addressable Storage를 구현한다.

```bash
# Git 저장소의 현재 해시 포맷 확인
git rev-parse --show-object-format
# sha1

# SHA-1 해시 길이
git rev-parse HEAD | wc -c
# 41 (40자 + 줄바꿈)
```

![SHA-1 vs SHA-256 비교](/assets/posts/git-sha1-vs-sha256-comparison.svg)

## SHAttered: SHA-1의 실질적 위협

2017년 Google 연구팀이 **SHAttered** 공격을 통해 같은 SHA-1 해시를 가진 두 개의 서로 다른 PDF를 만드는 데 성공했다. 이는 SHA-1 충돌 저항성이 이론적 공격에서 실제 공격으로 전환되었음을 의미한다.

Git의 경우, 충돌을 악용하면 악의적인 오브젝트가 정상 오브젝트와 같은 SHA를 갖도록 만들 수 있다. 보안상 민감한 코드베이스에는 직접적인 위협이 된다.

Git은 이 문제에 대응하기 위해 `sha1dc`(SHA-1 Detect Collision) 알고리즘을 내장해 충돌 시도를 탐지하지만, 근본적 해결책은 SHA-256으로의 전환이다.

## SHA-256 지원: Git 2.29+

Git 2.29(2020년 10월)부터 SHA-256 오브젝트 포맷을 실험적으로 지원한다.

```bash
# SHA-256 저장소 초기화
git init --object-format=sha256 my-secure-repo

# 기존 저장소의 포맷 확인
git rev-parse --show-object-format

# SHA-256 저장소의 커밋 SHA는 64자
git rev-parse HEAD
# aec070645fe53ee3b3763059376134f058cc337...  (64자)
```

SHA-256 오브젝트는 SHA-1과 완전히 별개의 네임스페이스를 가진다. 같은 파일 내용이더라도 SHA-1 해시와 SHA-256 해시는 다른 값이다.

![SHA-256 마이그레이션](/assets/posts/git-sha1-vs-sha256-migration.svg)

## 단축 SHA 사용

Git은 전체 40자(또는 64자)가 아니어도 **앞 7자 이상**으로 오브젝트를 지정할 수 있다. 저장소가 커질수록 더 긴 단축 SHA가 필요해진다.

```bash
# 기본 단축 SHA (7자)
git log --oneline
# 8ab686e feat: add login

# 단축 SHA 길이 조절
git config core.abbrev 12

# 특정 길이로 출력
git log --format="%h" --abbrev=10
```

저장소가 매우 크면 충돌 확률을 낮추기 위해 Git이 자동으로 단축 SHA 길이를 늘린다.

## 현재 실무 권장사항

SHA-256은 아직 실험적 단계다. 주요 호스팅 서비스(GitHub, GitLab 등)가 SHA-256 저장소를 완전히 지원하지 않으며, 서드파티 도구 호환성도 불완전하다.

| 상황 | 권장 |
|------|------|
| 일반 프로젝트 | SHA-1 (기본값) |
| 보안 중심 내부 저장소 | SHA-256 고려 (도구 생태계 확인 필수) |
| GitHub/GitLab 사용 | SHA-1 (현재 호스팅 제한) |

SHA-1 저장소와 SHA-256 저장소 간 직접 push/fetch는 불가능하다. Git 프로젝트는 상호 변환(interoperability) 기능을 개발 중이다.

```bash
# SHA-1 저장소에서 SHA-256으로 변환 (향후 지원 예정)
# git clone --object-format=sha256 sha1-repo sha256-repo
```

다음 글에서는 오브젝트를 가리키는 **refs 내부 구조**를 살펴본다.

---

**지난 글:** [Git Tag 오브젝트: annotated tag의 내부 구조](/posts/git-tag-object/)

**다음 글:** [Git Refs 내부 구조: .git/refs/ 디렉터리](/posts/git-refs-internal/)

<br>
읽어주셔서 감사합니다. 😊
