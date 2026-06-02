---
title: "logging 모듈: print를 졸업하는 법"
description: "표준 라이브러리 logging의 기본기 — 다섯 가지 레벨, Logger·Handler·Formatter의 역할 분담, getLogger(__name__) 관례, %s 지연 포매팅까지 한 번에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["logging", "로깅", "디버깅", "표준라이브러리", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-print-debugging-pitfalls/)에서 `print` 디버깅의 네 가지 함정을 짚으며, 그것을 한 번에 메우는 도구로 `logging`을 예고했다. 많은 사람이 `logging`을 "설정이 복잡한 print"쯤으로 오해하고 멀리한다. 하지만 핵심 개념 몇 개만 잡으면, 오히려 매번 `print`를 켰다 껐다 하는 것보다 훨씬 단순하다. 오늘은 그 개념들을 처음부터 쌓아 올린다.

## 다섯 가지 레벨

`logging`의 출발점은 레벨이다. 모든 로그 메시지에는 심각도가 매겨지고, 로거는 정해진 기준선 이상의 메시지만 통과시킨다. 이 한 가지 장치가 `print` 디버깅의 "전부 아니면 전무" 문제를 해결한다.

![로그 레벨의 위계](/assets/posts/python-logging-levels.svg)

낮은 쪽부터 `DEBUG`(10), `INFO`(20), `WARNING`(30), `ERROR`(40), `CRITICAL`(50)이다. 개발 중에는 레벨을 `DEBUG`로 내려 모든 것을 보고, 운영에서는 `WARNING`으로 올려 잡음을 숨긴다. **코드는 그대로 두고 레벨만 바꾸면** 보이는 양이 달라진다.

```python
import logging

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger(__name__)

log.debug("상세한 진단 정보")     # 개발 중에만 보고 싶은 것
log.info("주문 처리 시작")
log.warning("재고가 5개 이하")
log.error("결제 게이트웨이 응답 없음")
```

`logging.basicConfig(level=...)`는 가장 빠른 시작점이다. 이 한 줄이 루트 로거에 기본 핸들러와 포매터를 달아 준다. 막 시작할 때는 이걸로 충분하다.

## 역할을 나누는 세 부품

`logging`이 유연한 이유는 한 덩어리가 아니라 역할이 나뉜 부품들의 조합이기 때문이다. 로그 한 줄은 네 단계를 거쳐 흘러간다.

![로그 한 줄이 흘러가는 길](/assets/posts/python-logging-pipeline.svg)

**Logger**는 "무엇을 기록할지"의 진입점이다. 코드에서 `log.info(...)`를 부르는 그 객체다. **Filter**는 레벨이나 임의 조건으로 메시지를 통과시킬지 결정한다. **Handler**는 "어디로 보낼지"를 담당한다. 콘솔(`StreamHandler`), 파일(`FileHandler`), 회전 파일, 네트워크 등 목적지가 곧 핸들러다. **Formatter**는 "어떤 모양으로" 출력할지를 정한다. 이 분리 덕분에 같은 로그를 콘솔에는 간단히, 파일에는 자세히 남기는 식의 구성이 가능하다.

## getLogger(__name__) 관례

실무 코드에서 거의 항상 보게 되는 한 줄이 있다. 모듈 맨 위에 적는 `log = logging.getLogger(__name__)`이다.

```python
# myapp/orders.py
import logging
log = logging.getLogger(__name__)   # 이름이 "myapp.orders"가 된다

def place_order(order):
    log.info("주문 접수: %s", order.id)
```

`__name__`은 모듈의 점 표기 경로(`myapp.orders`)가 되고, 이것이 로거의 이름이 된다. 로거는 이름의 점을 따라 계층을 이루기 때문에, 나중에 `myapp` 로거의 레벨만 조정하면 그 아래 모든 모듈에 한꺼번에 적용된다. 이 계층 구조는 다음 글의 주제다.

## %s 지연 포매팅의 이유

마지막으로 자주 헷갈리는 부분 하나. 로그 메시지에 변수를 넣을 때는 f-string보다 `%s` 자리표시자 방식을 권한다.

```python
# 권장: 메시지가 실제로 출력될 때만 문자열을 만든다
log.debug("사용자 %s가 항목 %d개 처리", user, count)

# 비권장: 레벨에 걸려 버려질 때도 문자열을 미리 만든다
log.debug(f"사용자 {user}가 항목 {count}개 처리")
```

차이는 성능과 안전성이다. `%s` 방식은 해당 로그가 레벨 기준을 통과해 **실제로 출력될 때만** 문자열을 조립한다. `DEBUG` 로그가 운영에서 꺼져 있다면, f-string은 매번 헛되이 문자열을 만들지만 `%s` 방식은 아무 일도 하지 않는다. 뜨거운 반복문 속 디버그 로그에서 이 차이는 작지 않다.

이 정도면 `print`를 졸업하기에 충분한 기본기다. 레벨로 양을 조절하고, 세 부품으로 출력을 구성하고, `getLogger(__name__)`로 모듈마다 로거를 두는 것 — 이 셋이 `logging`의 골격이다. 다음 글에서는 이 부품들을 실제 프로젝트 규모로 엮는 설정, 즉 로거 계층과 `dictConfig`로 들어간다.

---

**지난 글:** [print 디버깅의 함정과 졸업](/posts/python-print-debugging-pitfalls/)

**다음 글:** [logging 설정: 로거 계층과 dictConfig](/posts/python-logging-config/)

<br>
읽어주셔서 감사합니다. 😊
