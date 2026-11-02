import { describe, expect, it } from 'vitest';
import { createReadLog, postReadKey, READ_HISTORY_KEY } from './readHistory';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe('글 읽음 기록', () => {
  it('상세 URL의 쿼리·해시·끝 슬래시는 같은 글로 처리하고 외부 링크는 제외한다', () => {
    const origin = 'https://techblog.paldyn.com';
    expect(postReadKey('/posts/mysql-mvcc/?q=1#example', origin)).toBe('mysql-mvcc');
    expect(postReadKey('/posts/mysql-mvcc', origin)).toBe('mysql-mvcc');
    expect(postReadKey('/posts/', origin)).toBeNull();
    expect(postReadKey('/knowledge/', origin)).toBeNull();
    expect(postReadKey('https://example.com/posts/mysql-mvcc/', origin)).toBeNull();
    expect(postReadKey('/blog/posts/mysql-mvcc/', origin, '/blog/')).toBe('mysql-mvcc');
    expect(postReadKey('/posts/mysql-mvcc/', origin, '/blog/')).toBeNull();
  });

  it('새로고침 뒤에도 읽은 글만 기억하고 중복 저장하지 않는다', () => {
    const storage = memoryStorage();
    const log = createReadLog(() => storage);
    expect(log.has('first')).toBe(false);
    log.mark('first');
    log.mark('first');
    expect(createReadLog(() => storage).has('first')).toBe(true);
    expect(createReadLog(() => storage).has('second')).toBe(false);
    expect(JSON.parse(storage.getItem()!)).toEqual(['first']);
  });

  it('다른 탭이 추가한 글과 합치고 저장소를 지우면 읽음 표시를 해제한다', () => {
    const storage = memoryStorage();
    const one = createReadLog(() => storage);
    const two = createReadLog(() => storage);
    one.mark('first');
    two.mark('second');
    one.reload();
    expect(one.has('first')).toBe(true);
    expect(one.has('second')).toBe(true);
    storage.setItem(READ_HISTORY_KEY, '[]');
    one.reload();
    expect(one.has('first')).toBe(false);
  });

  it('손상된 값이나 문자열이 아닌 항목이 있어도 기능이 중단되지 않는다', () => {
    const storage = memoryStorage('{broken');
    const log = createReadLog(() => storage);
    log.mark('first');
    expect(log.has('first')).toBe(true);
    storage.setItem(READ_HISTORY_KEY, '["second", 42, null]');
    log.reload();
    expect(log.has('second')).toBe(true);
    expect(log.has('first')).toBe(false);
  });

  it('저장소 접근이 차단돼도 현재 화면에서는 읽음 상태를 유지한다', () => {
    const log = createReadLog(() => { throw new Error('blocked'); });
    expect(() => log.mark('first')).not.toThrow();
    log.reload();
    expect(log.has('first')).toBe(true);
  });

  it('읽기는 가능하지만 저장 공간이 부족해도 세션의 읽은 글을 잃지 않는다', () => {
    const storage = {
      getItem: () => '["previous"]',
      setItem: () => { throw new Error('quota exceeded'); },
    };
    const log = createReadLog(() => storage);
    log.mark('first');
    log.mark('second');
    log.reload();
    expect(log.has('previous')).toBe(true);
    expect(log.has('first')).toBe(true);
    expect(log.has('second')).toBe(true);
  });
});
