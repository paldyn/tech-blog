---
title: "git bisect run: 테스트로 버그 커밋 자동 추적"
description: "git bisect run으로 테스트 스크립트를 붙여 버그를 도입한 첫 커밋을 자동으로 이분 탐색하는 법. 종료 코드 규약(good/bad/skip), 일회성 테스트 작성, 빌드 실패 회피와 실무 패턴을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "bisect", "디버깅", "이분탐색", "테스트", "회귀"]
featured: false
draft: false
---

[지난 글](/posts/github-secrets/)에서 CI가 다루는 민감 정보를 Secrets로 안전하게 관리하는 법을 다뤘다. CI 테스트가 어느 날 갑자기 빨간불이 됐다고 하자. 분명 지난주엔 멀쩡했는데, 그 사이 수십 개의 커밋이 쌓였다. 어느 커밋이 버그를 들여왔을까? 하나씩 되돌려가며 확인하는 건 시간 낭비다. **`git bisect`**는 이 문제를 이분 탐색으로 풀어, 정상이던 커밋과 망가진 커밋 사이를 절반씩 좁혀가며 **첫 실패 커밋**을 찾아낸다.

수동 bisect는 매 단계마다 사람이 직접 테스트하고 good/bad를 입력해야 한다. 커밋이 많으면 그것도 지루하다. 이때 `git bisect run`에 **테스트 스크립트**를 붙이면, Git이 각 후보 커밋을 체크아웃하며 스크립트를 자동 실행하고 그 결과로 판정을 내려 범인을 무인으로 격리한다.

![bisect는 이분 탐색으로 첫 실패 커밋을 찾는다](/assets/posts/git-bisect-with-test-binary.svg)

## 기본 흐름: 구간 지정

먼저 탐색 구간을 알려준다. 현재(버그 있음)를 `bad`로, 정상이던 과거 커밋을 `good`으로 표시한다.

```bash
git bisect start
git bisect bad                 # 현재 HEAD가 버그 상태
git bisect good v1.4.0         # 이 시점엔 정상이었다
```

이 두 경계만 정해주면 Git이 중간 커밋을 체크아웃한다. 수동이라면 여기서 테스트해 보고 `git bisect good` 또는 `git bisect bad`를 반복 입력한다. 자동화하려면 다음 단계로 넘어간다.

## git bisect run으로 자동화

`git bisect run` 뒤에 실행할 명령을 적으면, Git이 각 후보 커밋마다 그 명령을 돌리고 **종료 코드**로 판정한다.

```bash
git bisect start HEAD v1.4.0   # bad good을 한 줄로
git bisect run npm test
```

탐색이 끝나면 Git이 첫 실패 커밋의 해시, 작성자, 메시지를 출력한다. 끝나면 반드시 원래 상태로 복귀한다.

```bash
git bisect reset
```

## 종료 코드 규약이 핵심

`bisect run`이 스크립트를 해석하는 규칙은 종료 코드다. 이것을 정확히 이해해야 오판을 막을 수 있다.

![종료 코드가 good/bad/skip을 결정한다](/assets/posts/git-bisect-with-test-exitcode.svg)

- **0**: `good` — 테스트 통과. Git은 더 나중 커밋을 검사한다.
- **1~124, 126, 127**: `bad` — 테스트 실패. Git은 더 이전 커밋을 검사한다.
- **125**: `skip` — 판정 불가. 이 커밋은 빌드가 깨졌거나 평가할 수 없어 탐색에서 제외한다.
- **128 이상**: 탐색 자체를 중단한다.

여기서 자주 놓치는 함정이 있다. 일부 테스트 러너는 실패 시 종료 코드 128 이상을 반환할 수 있는데, 그러면 bisect가 멈춰버린다. 또한 표준 종료 코드 `255`는 bad가 아니라 abort로 처리되니, 스크립트가 그 값을 반환하지 않도록 주의한다.

## 일회성 테스트 스크립트 작성

기존 테스트 스위트가 너무 느리거나, 특정 버그만 빠르게 재현하고 싶다면 작은 스크립트를 직접 쓴다. 빌드 실패 커밋을 자연스럽게 건너뛰도록 `exit 125`를 넣는 패턴이 유용하다.

```bash
#!/usr/bin/env bash
# 빌드가 안 되면 이 커밋은 판정 불가 → skip
make build || exit 125

# 특정 증상만 콕 집어 검사
./run_app --check-feature
# run_app이 실패하면 0이 아닌 코드를 반환 → bad
```

이 스크립트를 `test.sh`로 저장하고 실행 권한을 준 뒤 넘긴다.

```bash
chmod +x test.sh
git bisect start HEAD v1.4.0
git bisect run ./test.sh
```

스크립트 파일이 작업 트리에 있으면 체크아웃마다 사라질 수 있으니, 저장소 밖(예: `/tmp/test.sh`)에 두고 절대 경로로 참조하는 것이 안전하다. `bisect run`은 버그를 도입한 커밋뿐 아니라, 성능 회귀나 출력 변화처럼 "통과/실패를 명확히 가를 수 있는" 모든 회귀를 찾는 데 쓸 수 있다.

범인을 찾았다면 그 커밋의 변경 내용을 들여다봐야 한다. 다음 글에서는 특정 코드 문자열이 **언제 추가·삭제됐는지**를 추적하는 `git log -S`(피카악스)를 다룬다.

---

**지난 글:** [GitHub Secrets: 민감 정보 안전하게 관리](/posts/github-secrets/)

**다음 글:** [git log -S/-G: 피카악스로 코드 변경 추적](/posts/git-log-pickaxe/)

<br>
읽어주셔서 감사합니다. 😊
