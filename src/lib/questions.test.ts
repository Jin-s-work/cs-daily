import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectQuestions, countByTopic, getAllQuestions } from './questions';

const valid = {
  id: 'os-process-001', topic: 'os', subtopic: 'process', difficulty: 1,
  type: 'concept', question: '질문', answerShort: '답', keywords: [],
};

/** 임시 디렉터리에 문제은행을 흉내내 만든다. 실제 content/ 는 건드리지 않는다. */
function fixture(files: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'qbank-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(
      path.join(dir, name),
      typeof body === 'string' ? body : JSON.stringify(body),
      'utf-8',
    );
  }
  return dir;
}

describe('collectQuestions', () => {
  it('여러 파일을 하나로 합친다', () => {
    const dir = fixture({
      'os.json': [valid],
      'db.json': [{ ...valid, id: 'db-index-001', topic: 'db', subtopic: 'index' }],
    });
    const { questions, issues, files } = collectQuestions(dir);
    expect(issues).toEqual([]);
    expect(questions.length).toBe(2);
    expect(files).toEqual(['db.json', 'os.json']);
  });

  it('json 이 아닌 파일은 무시한다', () => {
    const dir = fixture({ 'os.json': [valid], 'README.md': '# 무시' });
    expect(collectQuestions(dir).questions.length).toBe(1);
  });

  it('깨진 항목이 있어도 같은 파일의 멀쩡한 항목은 살린다', () => {
    // 'os-BAD' 는 형식만 틀리고 topic 접두사는 맞아서 이슈가 정확히 하나 난다.
    const dir = fixture({ 'os.json': [valid, { ...valid, id: 'os-BAD' }] });
    const { questions, issues } = collectQuestions(dir);
    expect(questions.length).toBe(1);
    expect(issues.length).toBe(1);
    expect(issues[0].index).toBe(1);
    expect(issues[0].field).toBe('id');
  });

  it('파일을 넘나드는 id 중복을 잡는다', () => {
    const dir = fixture({ 'a.json': [valid], 'b.json': [valid] });
    const { issues } = collectQuestions(dir);
    expect(issues.length).toBe(1);
    expect(issues[0].message.includes('os-process-001')).toBe(true);
  });

  it('JSON 파싱 실패를 파일 단위로 보고한다', () => {
    const dir = fixture({ 'os.json': '{ 깨진' });
    const { issues } = collectQuestions(dir);
    expect(issues.length).toBe(1);
    expect(issues[0].index).toBe(null);
  });

  it('최상위가 배열이 아니면 거부한다', () => {
    const dir = fixture({ 'os.json': { questions: [valid] } });
    const { issues } = collectQuestions(dir);
    expect(issues[0].message).toBe('최상위는 배열이어야 한다');
  });

  it('없는 디렉터리는 던진다', () => {
    expect(() => collectQuestions('/tmp/그런거없음-qbank')).toThrow(/못 찾았다/);
  });
});

describe('getAllQuestions', () => {
  it('문제가 있으면 던지고 어떤 id 인지 알려준다', () => {
    const dir = fixture({ 'a.json': [valid], 'b.json': [valid] });
    expect(() => getAllQuestions(dir)).toThrow(/os-process-001/);
  });

  it('통과하면 배열을 준다', () => {
    const dir = fixture({ 'os.json': [valid] });
    expect(getAllQuestions(dir).length).toBe(1);
  });
});

describe('countByTopic', () => {
  it('주제별로 센다', () => {
    const counts = countByTopic([
      valid, valid, { ...valid, topic: 'db' },
    ] as Parameters<typeof countByTopic>[0]);
    expect(counts).toEqual({ os: 2, db: 1 });
  });
});
