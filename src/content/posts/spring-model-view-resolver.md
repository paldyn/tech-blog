---
title: "Spring MVC Model과 ViewResolver: 데이터를 뷰에 전달하는 방법"
description: "Model, ModelMap, ModelAndView의 차이와 ViewResolver 체인 구조를 이해하고, Thymeleaf·InternalResourceViewResolver 설정 방법과 redirect:/forward: 접두사 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "Model", "ModelAndView", "ViewResolver", "Thymeleaf", "Spring MVC", "redirect", "forward", "뷰렌더링", "InternalResourceViewResolver"]
featured: false
draft: false
---

[지난 글](/posts/spring-parameter-binding/)에서 컨트롤러가 HTTP 요청에서 값을 꺼내는 방법을 살펴봤습니다. 이번 글에서는 컨트롤러가 꺼낸 데이터를 **어떻게 뷰에 전달하고**, Spring MVC가 뷰 이름을 실제 템플릿 파일로 어떻게 해석하는지 알아봅니다.

## 뷰 렌더링 전체 흐름

`@Controller`가 뷰 이름을 반환하면 `DispatcherServlet`이 `ViewResolver` 체인을 순서대로 탐색해 뷰 이름을 `View` 객체로 변환하고, `View.render(model, request, response)`를 호출합니다.

![Spring MVC 뷰 렌더링 흐름](/assets/posts/spring-model-view-resolver-flow.svg)

## Model, ModelMap, ModelAndView 차이

세 가지 모두 컨트롤러 메서드에서 뷰로 데이터를 전달하는 방법이지만 API가 다릅니다.

### Model 인터페이스

Spring이 주입하는 가장 간결한 방법입니다.

```java
@GetMapping("/home")
public String home(Model model) {
    model.addAttribute("greeting", "안녕하세요!");
    model.addAttribute("users", userService.findAll());
    return "home";   // ViewResolver가 templates/home.html로 해석
}
```

### ModelMap

`Model`을 구현한 클래스로, `LinkedHashMap`을 내부적으로 사용합니다. `Model`과 사실상 동일하게 쓸 수 있습니다.

```java
@GetMapping("/dashboard")
public String dashboard(ModelMap modelMap) {
    modelMap.put("stats", statsService.getToday());
    return "dashboard";
}
```

### ModelAndView

뷰 이름과 모델 데이터를 하나의 객체로 묶어 반환합니다. 조건부로 뷰를 선택할 때 편리합니다.

```java
@GetMapping("/report")
public ModelAndView report(@RequestParam String format) {
    ModelAndView mv = new ModelAndView();
    mv.addObject("data", reportService.get());
    if ("pdf".equals(format)) {
        mv.setViewName("report/pdf");
    } else {
        mv.setViewName("report/html");
    }
    return mv;
}
```

### 어떤 것을 쓸까?

실무에서는 대부분 `Model` 파라미터 방식을 씁니다. `ModelAndView`는 레거시 코드에서 자주 보이며, 조건부 뷰 전환이 필요한 특수 상황에 유용합니다.

## ViewResolver 설정

### ThymeleafViewResolver (Spring Boot 기본)

`spring-boot-starter-thymeleaf` 의존성을 추가하면 자동 설정됩니다.

```yaml
# application.yml
spring:
  thymeleaf:
    prefix: classpath:/templates/
    suffix: .html
    mode: HTML
    encoding: UTF-8
    cache: false   # 개발 중 false, 운영에서는 true
```

뷰 이름 `"home"` → `classpath:/templates/home.html` 로 해석됩니다.

### InternalResourceViewResolver (JSP)

JSP를 사용하는 레거시 프로젝트 또는 임베디드 서버 없이 외장 톰캣에 배포할 때 사용합니다.

```java
@Configuration
@EnableWebMvc
public class WebMvcConfig implements WebMvcConfigurer {

    @Bean
    public InternalResourceViewResolver viewResolver() {
        InternalResourceViewResolver r = new InternalResourceViewResolver();
        r.setPrefix("/WEB-INF/views/");
        r.setSuffix(".jsp");
        r.setOrder(2);   // 낮을수록 먼저 탐색
        return r;
    }
}
```

뷰 이름 `"login"` → `/WEB-INF/views/login.jsp` 로 해석됩니다.

Spring Boot 임베디드 서버(Tomcat)는 WAR 언패킹 없이 `/WEB-INF/` 경로를 서빙하지 못하므로, Spring Boot + JSP 조합은 권장하지 않습니다.

### ContentNegotiatingViewResolver

하나의 URL로 HTML과 JSON 등 다양한 표현을 제공해야 할 때 사용합니다.

```java
@Bean
public ContentNegotiatingViewResolver contentNegotiatingViewResolver() {
    ContentNegotiatingViewResolver r = new ContentNegotiatingViewResolver();
    r.setOrder(Ordered.HIGHEST_PRECEDENCE);

    List<ViewResolver> resolvers = new ArrayList<>();
    resolvers.add(thymeleafViewResolver());   // HTML
    resolvers.add(jsonViewResolver());        // JSON
    r.setViewResolvers(resolvers);
    return r;
}
```

`Accept: text/html` → Thymeleaf 뷰, `Accept: application/json` → JSON 뷰가 선택됩니다.

## redirect: 와 forward: 접두사

![뷰 이름 접두사 패턴](/assets/posts/spring-model-view-resolver-redirect.svg)

### redirect:

```java
@PostMapping("/orders")
public String createOrder(@ModelAttribute OrderForm form) {
    Order order = orderService.create(form);
    // PRG 패턴: POST 처리 후 GET 리다이렉트
    return "redirect:/orders/" + order.getId();
}
```

`redirect:` 접두사를 인식하는 것은 `UrlBasedViewResolver`의 `REDIRECT_URL_PREFIX` 상수입니다. `RedirectView`를 생성해 302 응답을 보냅니다.

리다이렉트 URL에 도메인 상대경로 대신 절대 URL을 쓰고 싶으면 `http://` 또는 `https://`로 시작하면 됩니다.

### forward:

```java
@GetMapping("/legacy")
public String forwardToNew() {
    return "forward:/api/v2/resource";
}
```

`RequestDispatcher.forward()`를 사용하며, 클라이언트는 URL 변화를 알지 못합니다. 서블릿 체인 내부에서만 이동하므로 `@RestController`가 반환하는 JSON 응답으로 포워드하는 것도 가능합니다.

## @ModelAttribute 메서드: 공통 모델 데이터

```java
@Controller
public class ShopController {

    // 이 컨트롤러의 모든 뷰에 카테고리 목록을 자동으로 추가
    @ModelAttribute("categories")
    public List<Category> loadCategories() {
        return categoryService.findAll();
    }

    @GetMapping("/products")
    public String products(Model model) {
        model.addAttribute("products", productService.findAll());
        // model에 "categories"는 이미 담겨 있음
        return "products";
    }
}
```

메서드 레벨 `@ModelAttribute`는 같은 컨트롤러 내 모든 `@RequestMapping` 메서드 이전에 호출됩니다. 모든 뷰에 공통으로 필요한 데이터(메뉴, 로그인 사용자 정보 등)를 한 곳에서 관리할 수 있습니다.

## FlashAttribute: 리다이렉트 후 메시지 전달

리다이렉트 이후에는 Model이 사라지기 때문에, 플래시 메시지(성공/오류 알림)를 전달하려면 `RedirectAttributes`를 사용합니다.

```java
@PostMapping("/users")
public String create(
        @ModelAttribute @Valid CreateUserForm form,
        BindingResult result,
        RedirectAttributes ra) {
    if (result.hasErrors()) {
        return "users/new";
    }
    userService.create(form);
    // 리다이렉트 후 한 번만 읽히고 사라짐
    ra.addFlashAttribute("successMsg", "사용자가 생성되었습니다.");
    return "redirect:/users";
}

@GetMapping("/users")
public String list(Model model) {
    // model에 "successMsg"가 자동으로 담겨 있음 (한 번만)
    model.addAttribute("users", userService.findAll());
    return "users/list";
}
```

`addFlashAttribute()`로 저장한 값은 세션에 임시 저장되고, 리다이렉트 이후 첫 번째 요청에서 자동으로 Model에 추가됩니다.

`addAttribute()`를 쓰면 URL 쿼리 파라미터로 추가됩니다(`?successMsg=...`). 민감한 정보는 쿼리 파라미터로 노출하지 말고 반드시 `addFlashAttribute()`를 사용합니다.

## ViewResolver Order 설정

여러 `ViewResolver`가 등록되면 `order` 값이 낮을수록 먼저 탐색합니다. `null`을 반환하면 다음 리졸버로 넘어갑니다.

```java
@Bean
public ThymeleafViewResolver thymeleafViewResolver() {
    ThymeleafViewResolver r = new ThymeleafViewResolver();
    r.setOrder(1);         // 가장 먼저 탐색
    r.setCharacterEncoding("UTF-8");
    return r;
}

@Bean
public InternalResourceViewResolver jspViewResolver() {
    InternalResourceViewResolver r = new InternalResourceViewResolver();
    r.setPrefix("/WEB-INF/views/");
    r.setSuffix(".jsp");
    r.setOrder(2);         // Thymeleaf가 null 반환 시 탐색
    return r;
}
```

`InternalResourceViewResolver`는 항상 non-null을 반환하므로 체인의 마지막에 배치해야 합니다.

## 핵심 정리

- `Model`은 Spring이 주입하는 인터페이스로, `addAttribute()`로 뷰에 데이터를 전달합니다.
- `ModelAndView`는 뷰 이름과 모델을 하나로 묶어 조건부 뷰 선택 시 편리합니다.
- `ViewResolver` 체인: Thymeleaf(기본) → InternalResource(JSP) → BeanName 순으로 탐색.
- `redirect:/path`는 302 리다이렉트, `forward:/path`는 서버 내부 포워드입니다.
- PRG 패턴: POST 처리 후 `redirect:`로 응답해 폼 중복 제출을 방지합니다.
- `RedirectAttributes.addFlashAttribute()`로 리다이렉트 후 플래시 메시지를 안전하게 전달합니다.

---

**지난 글:** [Spring MVC 파라미터 바인딩 완전 정복: @PathVariable부터 @ModelAttribute까지](/posts/spring-parameter-binding/)

**다음 글:** [Spring MVC 정적 리소스 처리: CSS·JS·이미지를 효율적으로 서빙하는 법](/posts/spring-static-resources/)

<br>
읽어주셔서 감사합니다. 😊
