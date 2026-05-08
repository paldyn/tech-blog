---
title: "NLP 텍스트 전처리: 데이터를 모델에 맞게 다듬다"
description: "왜 전처리가 필요한지부터 정제, 토큰화, 정규화, 불용어 제거, 어간 추출까지 텍스트 전처리 파이프라인의 각 단계를 한국어 예시와 KoNLPy 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["NLP", "텍스트전처리", "토큰화", "KoNLPy", "형태소분석", "불용어제거", "정규화"]
featured: false
draft: false
---

[지난 글](/posts/embedding-multimodal/)에서 CLIP이 이미지와 텍스트를 동일한 벡터 공간에 정렬하는 방법을 살펴봤다. 그런데 텍스트를 어떤 모델에 넣든 간에, 원시 텍스트를 그대로 사용하는 경우는 거의 없다. 실제 데이터는 HTML 태그, 특수문자, 오타, 중복 공백, 이모지, 구어체 표현 등으로 가득하다. 이 "노이즈"를 걷어내고 모델이 학습할 수 있는 형태로 변환하는 과정이 **텍스트 전처리(Text Preprocessing)**다. 데이터 과학자들이 흔히 "데이터 전처리에 80%의 시간을 쓴다"고 말하는 것은 과장이 아니다. 좋은 전처리가 모델 성능을 결정하는 경우가 많다.

## 왜 전처리가 중요한가

모델은 입력의 패턴을 학습한다. 전처리 없이 학습하면 다음 문제가 발생한다.

**어휘 폭발:** "run", "runs", "running", "ran"이 모두 다른 어휘로 처리된다. 전처리 없이는 어휘 크기가 불필요하게 커져 희소성(sparsity) 문제가 심해진다.

**노이즈 학습:** `<p>` 같은 HTML 태그나 `!!!`, `...` 같은 반복 구두점을 의미 있는 패턴으로 학습하면 일반화 성능이 떨어진다.

**불균형:** "The"와 "the"가 다른 토큰으로 취급되면, 소문자로만 등장하는 단어는 대문자 버전에 비해 학습 데이터가 적어진다.

물론 BERT나 GPT 같은 현대 LLM은 전처리 없이도 어느 정도 강건하다. 하지만 클래식 NLP 파이프라인(TF-IDF, 나이브 베이즈, 전통적 텍스트 분류)이나 도메인 특화 모델 학습에서는 전처리가 여전히 결정적인 역할을 한다.

![NLP 텍스트 전처리 파이프라인](/assets/posts/nlp-text-preprocessing-pipeline.svg)

## 1단계: 텍스트 정제 (Cleaning)

정제는 의미 없는 노이즈를 제거하는 첫 번째 단계다.

### HTML/마크업 제거

웹 크롤링 데이터나 뉴스 기사에는 HTML 태그가 포함된다. `re.sub()`로 간단히 제거할 수 있다.

```python
import re

def remove_html(text):
    """HTML 태그 제거"""
    return re.sub(r'<[^>]+>', '', text)

# 예시
text = "<p>안녕하세요! <b>NLP</b>를 배워봐요.</p>"
print(remove_html(text))
# → "안녕하세요! NLP를 배워봐요."
```

### 특수문자 및 이모지 처리

특수문자는 도메인에 따라 다르게 처리해야 한다. 감성 분석에서는 이모지가 중요한 신호일 수 있어 제거하면 안 된다. 반면 분류 모델에서는 노이즈가 될 수 있다.

```python
def clean_special_chars(text, keep_punctuation=False):
    """특수문자 처리"""
    if keep_punctuation:
        # 한글, 영어, 숫자, 기본 구두점만 유지
        return re.sub(r'[^\w\s\.,!?]', ' ', text)
    else:
        # 한글, 영어, 숫자만 유지
        return re.sub(r'[^\w\s]', ' ', text)

# 중복 공백 제거
def normalize_whitespace(text):
    return re.sub(r'\s+', ' ', text).strip()
```

## 2단계: 토큰화 (Tokenization)

토큰화는 텍스트를 분석 단위(토큰)로 분리하는 과정이다. 언어마다 토큰화 방식이 다르다.

### 영어 토큰화

영어는 공백 기준으로 분리하는 것이 기본이지만, 구두점 처리가 필요하다.

```python
import re

def simple_tokenize(text):
    """기본 영어 토큰화"""
    # 단어와 구두점 사이에 공백 삽입
    text = re.sub(r'([.,!?;:])', r' \1 ', text)
    return text.lower().split()

text = "Hello, world! This is NLP."
print(simple_tokenize(text))
# → ['hello', ',', 'world', '!', 'this', 'is', 'nlp', '.']
```

NLTK의 `word_tokenize`나 spaCy의 토크나이저는 "don't" → ["do", "n't"] 같은 축약형도 올바르게 처리한다.

### 한국어 토큰화의 특수성

한국어는 **교착어(Agglutinative Language)**다. "먹었다", "먹는다", "먹겠다"는 모두 "먹-"이라는 어근에 다양한 어미가 붙은 형태다. 공백 기준 분리로는 이 구조를 파악할 수 없다.

또한 한국어는 **띄어쓰기 오류**가 빈번하다. "나는 밥을 먹었다"를 "나는밥을먹었다"로 쓰는 경우도 많고, "어제 학교에 갔다"를 "어제 학교에갔다"처럼 띄어쓰기를 일부만 하는 경우도 있다.

이 때문에 한국어 NLP에는 **형태소 분석기(Morphological Analyzer)**가 필수다.

## 3단계: 정규화 (Normalization)

정규화는 동일한 의미를 가진 다양한 표현을 통일된 형태로 변환하는 과정이다.

### 대소문자 통일

영어에서는 소문자 변환이 기본이다.

```python
text = "Hello World"
print(text.lower())  # "hello world"
```

다만 고유명사("Apple" 회사 vs "apple" 사과)나 약어("NLP" vs "nlp")처럼 대소문자가 의미를 구분하는 경우에는 주의가 필요하다.

### 유니코드 정규화

같은 글자가 다른 유니코드 코드 포인트로 표현될 수 있다. "café"의 'é'는 단일 코드 포인트 U+00E9로 쓰이기도 하고, 'e'(U+0065)와 결합 악센트(U+0301)의 조합으로 쓰이기도 한다.

```python
import unicodedata

def normalize_unicode(text):
    """유니코드 NFC 정규화"""
    return unicodedata.normalize('NFC', text)

# 한국어에서도 중요: 자모 분리 vs 완성형
decomposed = unicodedata.normalize('NFD', '안녕')
composed = unicodedata.normalize('NFC', decomposed)
print(composed)  # "안녕" (다시 완성형으로)
```

### 반복 문자 처리

"최고오오오오" → "최고"처럼 감성적 강조를 위한 반복 문자는 정규화가 필요하다.

```python
def normalize_repeated_chars(text, max_repeat=2):
    """연속 반복 문자 최대 max_repeat개로 제한"""
    return re.sub(r'(.)\1{' + str(max_repeat) + r',}', r'\1' * max_repeat, text)

print(normalize_repeated_chars("최고오오오오오"))  # "최고오오"
```

## 4단계: 불용어 제거 (Stopword Removal)

불용어(Stopword)는 문장에서 문법적 기능만 하고 의미 정보가 적은 단어들이다. 영어의 경우 "the", "is", "a", "and" 등이 해당한다.

```python
from nltk.corpus import stopwords
import nltk

nltk.download('stopwords')
stop_words = set(stopwords.words('english'))

def remove_stopwords(tokens):
    return [t for t in tokens if t not in stop_words]

tokens = ['this', 'is', 'an', 'example', 'of', 'nlp']
print(remove_stopwords(tokens))
# → ['example', 'nlp']
```

**한국어 불용어**는 표준화된 리스트가 없어 직접 구성해야 한다. "이", "가", "은", "는", "을", "를" 같은 조사와 "그", "저", "이" 같은 지시사가 주로 포함된다.

그러나 불용어 제거가 항상 좋은 것은 아니다. "not good"에서 "not"을 불용어로 제거하면 긍정/부정 판단이 바뀐다. 감성 분석 태스크에서는 부정어를 불용어 목록에서 제외해야 한다.

## 5단계: 어간 추출과 원형 복원

### 어간 추출 (Stemming)

어간 추출은 단어의 접사를 기계적으로 제거하여 어근을 찾는다. 속도가 빠르지만 결과가 올바른 단어가 아닐 수 있다.

```python
from nltk.stem import PorterStemmer

stemmer = PorterStemmer()
words = ['running', 'runs', 'runner', 'ran']
stems = [stemmer.stem(w) for w in words]
print(stems)
# → ['run', 'run', 'runner', 'ran']
# 참고: 'ran'은 불규칙 동사라 어간 추출이 완벽하지 않음
```

### 원형 복원 (Lemmatization)

원형 복원은 품사 정보를 활용하여 사전에 있는 올바른 기본형으로 변환한다. 어간 추출보다 정확하지만 느리다.

```python
from nltk.stem import WordNetLemmatizer
import nltk

nltk.download('wordnet')
lemmatizer = WordNetLemmatizer()

# 품사 정보가 있을 때 더 정확함
print(lemmatizer.lemmatize('running', pos='v'))  # 'run'
print(lemmatizer.lemmatize('better', pos='a'))   # 'good'
print(lemmatizer.lemmatize('ran', pos='v'))       # 'run'
```

## 한국어 형태소 분석: KoNLPy

한국어에서 어간 추출과 원형 복원에 해당하는 것이 **형태소 분석**이다. KoNLPy는 한국어 형태소 분석을 위한 파이썬 라이브러리로, 여러 형태소 분석기를 통일된 API로 제공한다.

![한국어 전처리 코드](/assets/posts/nlp-text-preprocessing-code.svg)

```python
from konlpy.tag import Okt, Komoran, Mecab

okt = Okt()

text = "나는 오늘 정말 좋은 영화를 봤어요!"

# 형태소 분리
print(okt.morphs(text))
# → ['나', '는', '오늘', '정말', '좋은', '영화', '를', '봤어요', '!']

# 품사 태깅 포함
print(okt.pos(text))
# → [('나', 'Noun'), ('는', 'Josa'), ('오늘', 'Noun'),
#    ('정말', 'Adverb'), ('좋은', 'Adjective'), ('영화', 'Noun'),
#    ('를', 'Josa'), ('봤어요', 'Verb'), ('!', 'Punctuation')]

# 명사만 추출
print(okt.nouns(text))
# → ['나', '오늘', '영화']

# 정규화 + 어간 추출 옵션
print(okt.morphs(text, norm=True, stem=True))
# → ['나', '는', '오늘', '정말', '좋다', '영화', '를', '보다', '!']
```

### 형태소 분석기 선택

KoNLPy가 제공하는 주요 분석기의 특징:

- **Okt(트위터):** 비교적 빠르고 구어체에 강함. SNS 텍스트 분석에 적합
- **Komoran:** 정확도가 높고 사용자 사전 지원이 좋음. 공식 문서나 뉴스에 적합
- **Mecab:** 가장 빠름. 대용량 데이터 처리에 적합 (별도 설치 필요)
- **Hannanum:** KAIST에서 개발. 학술 텍스트에 강함

## 완성된 한국어 전처리 파이프라인

```python
import re
import unicodedata
from konlpy.tag import Okt

class KoreanTextPreprocessor:
    def __init__(self):
        self.okt = Okt()
        # 기본 한국어 불용어 목록
        self.stopwords = {
            '이', '가', '은', '는', '을', '를', '의', '에', '에서',
            '로', '으로', '와', '과', '도', '만', '까지', '부터',
            '그', '이', '저', '것', '수', '등', '및', '또한', '하다'
        }
    
    def clean(self, text):
        """1단계: 텍스트 정제"""
        # HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        # URL 제거
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        # 이메일 제거
        text = re.sub(r'\S+@\S+\.\S+', '', text)
        # 특수문자 정리 (한글, 영어, 숫자, 공백만 유지)
        text = re.sub(r'[^\w\s가-힣]', ' ', text)
        # 유니코드 정규화
        text = unicodedata.normalize('NFC', text)
        # 공백 정규화
        return re.sub(r'\s+', ' ', text).strip()
    
    def normalize(self, text):
        """2단계: 정규화"""
        # 반복 문자 처리 (예: ㅋㅋㅋㅋ → ㅋㅋ)
        text = re.sub(r'(.)\1{2,}', r'\1\1', text)
        return text
    
    def tokenize(self, text, remove_stopwords=True):
        """3단계: 형태소 분석 및 불용어 제거"""
        morphs = self.okt.pos(text, norm=True, stem=True)
        
        tokens = []
        for morph, pos in morphs:
            # 의미 있는 품사만 유지 (명사, 동사, 형용사, 부사)
            if pos in ['Noun', 'Verb', 'Adjective', 'Adverb']:
                if remove_stopwords and morph in self.stopwords:
                    continue
                if len(morph) > 1:  # 1글자 토큰 제거
                    tokens.append(morph)
        return tokens
    
    def preprocess(self, text, remove_stopwords=True):
        """전체 파이프라인 실행"""
        text = self.clean(text)
        text = self.normalize(text)
        return self.tokenize(text, remove_stopwords)

# 사용 예시
preprocessor = KoreanTextPreprocessor()
text = "<p>나는 오늘 <b>정말</b> 좋은 영화를 봤어요!!!</p>"
result = preprocessor.preprocess(text)
print(result)
# → ['오늘', '정말', '좋다', '영화', '보다']
```

## 도메인별 고려사항

전처리는 사용 목적과 도메인에 따라 크게 달라진다.

**감성 분석:** 이모지, 느낌표, "ㅋㅋ" 같은 표현이 중요한 신호. 너무 공격적인 정제는 성능을 낮춘다.

**의료/법률 텍스트:** 약어("고혈압" vs "HTN")와 전문용어를 처리하는 전문 사전이 필요하다.

**SNS/구어체:** 맞춤법 오류, 신조어, 줄임말이 많다. Okt처럼 구어체에 강한 분석기가 유리하다.

**다국어 텍스트:** 한국어 문장 중간에 영어가 섞인 경우(code-switching) 처리가 복잡하다. 언어 감지 후 각각 적합한 처리를 적용해야 한다.

좋은 전처리 파이프라인을 만드는 것은 반복적인 과정이다. 데이터를 직접 들여다보고, 모델 오류를 분석하고, 전처리 규칙을 조정하는 과정을 거쳐야 한다. 다음 글에서는 전처리된 텍스트에서 인물명, 기관명, 지명 같은 **고유한 의미 단위**를 자동으로 인식하는 개체명 인식(NER)을 다룬다.

---

**지난 글:** [멀티모달 임베딩: 텍스트와 이미지를 같은 공간에](/posts/embedding-multimodal/)

**다음 글:** [개체명 인식(NER): 텍스트에서 정보를 추출하다](/posts/nlp-named-entity-recognition/)

<br>
읽어주셔서 감사합니다. 😊
