---
title: "퍼징(Fuzzing): 예상 밖의 입력으로 숨은 취약점 찾기"
description: "무작위 변형·커버리지 유도·생성 기반 퍼징의 원리와 차이를 정리하고, libFuzzer 퍼즈 타깃 작성, 웹 API 퍼징, OSS-Fuzz와 CI 통합까지 실무 적용 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["퍼징", "Fuzzing", "libFuzzer", "AFL", "커버리지유도퍼징", "보안테스트"]
featured: false
draft: false
---

[지난 글](/posts/websec-sast-dast-iast/)에서 SAST·DAST·IAST를 비교하며 한 가지 한계를 언급했다. 이 도구들은 기본적으로 "알려진 패턴"을 찾는다. SQL 인젝션의 모양, 누락된 헤더, 취약한 함수 호출 — 모두 누군가 이미 정의해 둔 룰이다. 그렇다면 아무도 패턴화하지 못한 결함, 개발자조차 상상하지 못한 입력 조합으로만 드러나는 버그는 어떻게 찾을까. 그 답이 퍼징(Fuzzing)이다.

## 퍼징이란

퍼징은 프로그램에 비정상적이거나 예상 밖의 입력을 대량으로 주입하면서 크래시, 행(hang), 메모리 오류, 단언 실패 같은 이상 동작을 관찰하는 자동화 테스트 기법이다. 1988년 위스콘신 대학의 Barton Miller가 폭풍우 치는 밤 모뎀 노이즈로 깨진 입력이 유닉스 유틸리티들을 죽이는 걸 보고 체계화한, 의외로 역사가 긴 기법이다.

단위 테스트와 비교하면 본질이 선명해진다. 단위 테스트는 "내가 생각해 낸 입력"에 대해 "내가 기대한 출력"을 확인한다. 퍼징은 **내가 생각해 내지 못한 입력**에 대해 "최소한 죽지는 않는다"는 불변식을 확인한다. 개발자의 상상력이라는 한계를 기계의 물량으로 돌파하는 것이다.

웹 보안 관점에서 퍼징이 잡아내는 대표적인 결함은 다음과 같다.

- 파서 취약점: 이미지·PDF·XML·JSON 파서의 메모리 오류, 무한 루프
- 경계 조건: 길이 0, 최대 길이 + 1, 음수 길이, 유니코드 경계
- [ReDoS](/posts/websec-redos/) 같은 알고리즘 복잡도 공격에 취약한 입력
- 역직렬화·디코딩 로직의 미정의 동작
- HTTP 파싱 차이로 인한 요청 스머글링성 결함

## 퍼저의 세 갈래

![퍼저 유형 비교](/assets/posts/websec-fuzzing-types.svg)

**무작위 변형(dumb mutation) 퍼징**은 정상 입력을 무작위로 비트 플립하고 잘라 붙인다. 구축 비용이 거의 없지만, 입력 구조를 모르기 때문에 변형된 입력 대부분이 파서 초입의 형식 검사("매직 바이트가 다름", "체크섬 불일치")에서 걸러진다. 깊은 로직까지 도달하는 비율이 매우 낮다.

**커버리지 유도(coverage-guided) 퍼징**이 이 문제를 풀었고, 현재의 사실상 표준이다. 컴파일 시점에 코드를 계측해 두고, 어떤 입력이 **이전에 가 보지 못한 코드 경로**를 열면 그 입력을 시드 코퍼스에 추가한다. 다음 변형은 그 입력에서 출발한다. 이 피드백 루프 덕분에 퍼저는 무작위인데도 마치 길을 더듬어 찾듯 점점 깊은 경로로 들어간다. AFL/AFL++, libFuzzer, go-fuzz, JVM 계열의 Jazzer가 모두 이 방식이다.

![커버리지 유도 퍼징 루프](/assets/posts/websec-fuzzing-loop.svg)

**생성 기반(generation-based) 퍼징**은 입력의 문법·프로토콜 명세를 알려 주고, 그 명세에 맞는(따라서 파서를 통과하는) 입력을 생성한 뒤 의미 수준에서 비튼다. 문법 작성 비용이 들지만 HTTP, TLS, SQL처럼 구조가 강한 입력에서는 가장 깊이 들어간다. 웹 API라면 OpenAPI 스펙이 이미 문법 역할을 하므로, 이를 활용하는 RESTler 같은 도구가 이 계열이다.

## 퍼즈 타깃 작성해 보기

커버리지 유도 퍼저를 쓰려면 "입력 바이트를 받아 테스트 대상을 호출하는" 작은 진입점, 퍼즈 타깃(fuzz target)을 작성한다. libFuzzer 스타일의 예시다.

```cpp
// fuzz_url_parser.cc — URL 파서 퍼즈 타깃
#include <cstdint>
#include <cstddef>
#include "url_parser.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  // 퍼저가 만든 임의 바이트를 그대로 파서에 넣는다
  ParsedUrl out;
  parse_url(reinterpret_cast<const char*>(data), size, &out);

  // 크래시·메모리 오류·단언 실패가 없으면 통과
  return 0;
}
```

```bash
# AddressSanitizer와 함께 빌드 — 메모리 오류를 크래시로 표면화
clang++ -g -O1 -fsanitize=fuzzer,address fuzz_url_parser.cc url_parser.cc -o fuzz_url

# 시드 코퍼스 디렉터리와 함께 실행
./fuzz_url ./corpus -max_total_time=3600
```

두 가지 포인트가 중요하다. 첫째, **새니타이저(ASan, UBSan)와 함께 빌드한다.** 조용히 지나갈 힙 오버플로를 즉시 크래시로 바꿔 줘서 탐지력이 몇 배가 된다. 둘째, **좋은 시드 코퍼스가 절반이다.** 실제 트래픽에서 추출한 다양한 정상 입력으로 시작하면 같은 시간에 훨씬 깊이 들어간다.

Go(`go test -fuzz`), Python(Atheris), JVM(Jazzer), JavaScript(Jazzer.js)까지 주요 언어 모두 같은 모델의 퍼징을 지원하므로, "C/C++ 전용 기법"이라는 인상은 더 이상 사실이 아니다.

## 웹 서비스에서의 퍼징 전략

웹 백엔드 전체를 통째로 퍼징하는 것은 비효율적이다(네트워크 왕복 때문에 초당 실행 수가 수십 배 떨어진다). 실무 전략은 계층을 나누는 것이다.

- **라이브러리 수준**: 직접 작성했거나 포크한 파서·디코더·검증 로직(커스텀 토큰 파서, 파일 메타데이터 추출기 등)에 퍼즈 타깃을 작성한다. 가장 투자 효율이 높은 지점이다.
- **API 수준**: OpenAPI 스펙 기반 도구(RESTler, Schemathesis)로 엔드포인트에 명세 위반 입력을 보낸다. 500 에러, 스키마 위반 응답, 인증 우회를 잡는다.
- **프로퍼티 기반 테스트와 결합**: "어떤 입력이든 `decode(encode(x)) == x`여야 한다" 같은 불변식을 정의하면, 퍼저가 크래시뿐 아니라 논리 오류까지 찾아 준다.

크래시가 나오면 퍼저가 저장해 둔 재현 입력으로 디버깅하고, **그 입력을 회귀 테스트로 영구 보존**한다. 같은 버그가 다시 들어오면 CI가 즉시 잡는다.

## 지속 퍼징 — 한 번이 아니라 계속

퍼징의 효과는 누적 실행 시간에 비례한다. 릴리스 전 한 시간 돌리고 끝내는 것보다, 적은 자원이라도 계속 돌리는 쪽이 압도적으로 낫다.

- **OSS-Fuzz**: Google이 운영하는 오픈소스 무료 지속 퍼징 인프라. 1만 개 이상의 프로젝트에서 수만 건의 버그를 찾아냈다. 오픈소스 프로젝트라면 등록을 고려할 가치가 충분하다.
- **CI 통합**: ClusterFuzzLite나 `go test -fuzz`를 PR 단계에서 짧게(10분), main 브랜치에서 길게(야간) 돌리는 이중 구성이 일반적이다.

```yaml
# GitHub Actions — PR마다 10분 퍼징 (Go)
- name: Short fuzz
  run: go test -fuzz=FuzzParseToken -fuzztime=10m ./internal/token/
```

퍼징은 기계가 잘하는 일 — 지치지 않는 반복 — 을 기계에게 맡기는 기법이다. 하지만 비즈니스 로직의 허점, 권한 설계의 결함처럼 "맥락을 이해해야 보이는" 취약점은 여전히 사람의 영역이다. 다음 글에서는 숙련된 사람이 공격자의 관점으로 시스템을 검증하는 침투 테스트(Penetration Testing)를 다룬다.

---

**지난 글:** [SAST·DAST·IAST: 자동화 보안 테스트 도구 비교와 선택](/posts/websec-sast-dast-iast/)

**다음 글:** [침투 테스트 입문: 모의 해킹의 절차와 방법론](/posts/websec-penetration-testing-intro/)

<br>
읽어주셔서 감사합니다. 😊
