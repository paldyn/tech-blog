---
title: "logging 설정: 로거 계층과 dictConfig"
description: "로거의 점 표기 계층과 전파(propagation), 핸들러·포매터를 한곳에 묶는 dictConfig, 라이브러리는 핸들러를 달지 않는다는 원칙까지 — 실전 logging 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["logging", "dictConfig", "로거계층", "propagation", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-logging-module/)에서 `logging`의 레벨과 세 부품, 그리고 `getLogger(__name__)` 관례까지 골격을 잡았다. 거기서 "로거는 이름의 점을 따라 계층을 이룬다"고 흘려 말했는데, 사실 이 계층 구조가 `logging` 설정의 거의 모든 것을 떠받친다. 오늘은 그 계층이 어떻게 동작하는지 들여다보고, 설정을 한곳에 깔끔하게 모으는 `dictConfig`로 마무리한다.

## 로거는 점을 따라 가계도를 이룬다

`getLogger("myapp.db")`와 `getLogger("myapp.web")`은 이름의 점을 기준으로 `myapp`을 부모로 두고, `myapp`은 다시 최상위 `root`를 부모로 둔다. 이름만으로 가계도가 자동으로 만들어진다.

![로거 계층과 전파](/assets/posts/python-logging-config-hierarchy.svg)

핵심은 **전파(propagation)**다. 자식 로거가 만든 메시지는 자신의 핸들러를 거친 뒤, 부모로, 다시 그 부모로 거슬러 올라가며 각 단계의 핸들러를 모두 통과한다. 그래서 보통은 **루트 로거에만 핸들러를 하나 달아 두면**, 앱 전체의 모든 로그가 그리로 모인다. 모듈마다 핸들러를 달 필요가 없다.

```python
import logging

# 루트에만 핸들러를 단다 — 모든 자식 로그가 여기로 모임
logging.basicConfig(level=logging.INFO)

logging.getLogger("myapp.db").warning("연결 풀 부족")
logging.getLogger("myapp.web").info("요청 수신")
# 두 메시지 모두 루트의 핸들러로 출력된다
```

레벨 조정도 계층 덕에 간결하다. `getLogger("myapp.db").setLevel(logging.DEBUG)`로 데이터베이스 관련 로그만 자세히 보고, 나머지는 그대로 둘 수 있다. 영역별로 보는 양을 따로 조절하는 셈이다.

## 라이브러리는 핸들러를 달지 않는다

여기서 중요한 원칙 하나. 재사용되는 **라이브러리 코드는 핸들러를 직접 달면 안 된다.** 로그를 어디로, 어떤 모양으로 내보낼지는 그 라이브러리를 쓰는 애플리케이션이 결정해야 하기 때문이다. 라이브러리는 그저 로거를 얻어 메시지를 남기기만 한다.

```python
# 라이브러리 코드: 메시지만 남기고 출력 방법은 앱에 맡긴다
import logging
log = logging.getLogger(__name__)
log.addHandler(logging.NullHandler())   # "핸들러 없음" 경고만 막는다
```

`NullHandler`는 "내가 핸들러를 정하지 않겠다"는 뜻의 빈 핸들러다. 이렇게 해 두면, 라이브러리를 쓰는 앱이 루트에 핸들러를 달았을 때 전파를 통해 자연스럽게 로그가 흘러간다. 출력 정책의 결정권을 앱에 온전히 넘기는 것이다.

## dictConfig로 한곳에 모으기

코드 곳곳에서 `addHandler`, `setFormatter`를 부르다 보면 설정이 흩어진다. 규모가 커지면 포매터·핸들러·로거를 하나의 딕셔너리로 선언하는 `logging.config.dictConfig`가 훨씬 깔끔하다.

![dictConfig 한눈에](/assets/posts/python-logging-config-dictconfig.svg)

```python
import logging.config

logging.config.dictConfig({
    "version": 1,
    "formatters": {
        "std": {"format": "%(asctime)s %(name)s %(levelname)s %(message)s"}
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "std"}
    },
    "root": {"level": "INFO", "handlers": ["console"]},
})
```

`formatters`에서 출력 모양을 정의하고, `handlers`에서 그 포매터를 참조해 목적지를 만들고, `root`에서 그 핸들러를 연결한다. 이름으로 서로를 가리키는 구조라, 핸들러를 추가하거나 레벨을 바꿀 때 한 곳만 손대면 된다. `"version": 1`은 형식 버전을 가리키는 필수 항목이니 빠뜨리지 말자.

## 설정은 진입점에서 단 한 번

마지막 원칙. 로깅 설정은 애플리케이션의 진입점(예: `main()`이나 `if __name__ == "__main__":` 블록)에서 **단 한 번만** 적용한다. 모듈을 import할 때마다 설정이 다시 적용되면 핸들러가 중복으로 붙어 같은 로그가 여러 번 찍히는 흔한 사고가 난다.

```python
def main():
    logging.config.dictConfig(LOG_CONFIG)   # 진입점에서 한 번
    run_app()

if __name__ == "__main__":
    main()
```

계층과 전파를 이해하면 `logging` 설정은 의외로 단순해진다. 루트에 핸들러 하나, 라이브러리에는 `NullHandler`, 설정은 진입점에서 `dictConfig`로 한 번. 이 세 원칙이 대부분의 프로젝트를 감당한다. 여기까지로 "무엇이 잘못됐나"를 기록하는 도구를 갖췄으니, 다음 글부터는 "무엇이 느린가"를 측정하는 프로파일링으로 넘어간다. 첫 도구는 표준 라이브러리 `cProfile`이다.

---

**지난 글:** [logging 모듈: print를 졸업하는 법](/posts/python-logging-module/)

**다음 글:** [cProfile: 시간이 어디서 새는지 측정하기](/posts/python-cprofile/)

<br>
읽어주셔서 감사합니다. 😊
