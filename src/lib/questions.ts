/**
 * 문제은행 로더. content/questions/*.json 을 전부 읽어 Zod 로 검증한 뒤 한 배열로 합친다.
 *
 * 이 파일은 fs 를 쓰므로 서버에서만 돈다 — 서버 컴포넌트와 scripts/validate.ts 가 호출한다.
 * 클라이언트 컴포넌트에서 import 하면 번들 에러가 난다. 데이터는 prop 으로 내려보낸다.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { questionSchema, type Question } from './schema';

const QUESTIONS_DIR = path.join(process.cwd(), 'content', 'questions');

/** 검증 실패 하나. 어느 파일 몇 번째 항목이 왜 틀렸는지 한 줄로 특정한다. */
export interface QuestionIssue {
  file: string;
  /** 배열 안에서의 0-based 위치. 파일 자체가 깨졌으면 null. */
  index: number | null;
  /** 문제가 된 필드 경로. 예: 'correct', 'refs.0.url' */
  field: string;
  message: string;
}

export interface LoadResult {
  questions: Question[];
  issues: QuestionIssue[];
  /** 실제로 읽은 파일명. 정렬되어 있다. */
  files: string[];
}

function listQuestionFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(`문제은행 디렉터리를 못 찾았다: ${dir}`);
  }
  return entries.filter((f) => f.endsWith('.json')).sort();
}

/**
 * 전부 읽되 던지지 않는다. 실패를 모아서 돌려주므로 validate 스크립트가
 * 첫 번째 오류에서 멈추지 않고 전체 목록을 보여줄 수 있다.
 */
export function collectQuestions(dir: string = QUESTIONS_DIR): LoadResult {
  const files = listQuestionFiles(dir);
  const questions: Question[] = [];
  const issues: QuestionIssue[] = [];

  for (const file of files) {
    const raw = readFileSync(path.join(dir, file), 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      issues.push({ file, index: null, field: '(파일 전체)', message: `JSON 파싱 실패: ${(e as Error).message}` });
      continue;
    }

    if (!Array.isArray(parsed)) {
      issues.push({ file, index: null, field: '(파일 전체)', message: '최상위는 배열이어야 한다' });
      continue;
    }

    // 배열을 통째로 파싱하지 않고 항목별로 본다.
    // 통째로 파싱하면 한 항목만 깨져도 그 파일의 멀쩡한 항목이 전부 빠져서,
    // 파일을 넘나드는 id 중복 검사가 조용히 무력화된다.
    parsed.forEach((item, index) => {
      const result = questionSchema.safeParse(item);
      if (result.success) {
        questions.push(result.data);
        return;
      }
      for (const issue of result.error.issues) {
        issues.push({
          file,
          index,
          field: issue.path.length > 0 ? issue.path.join('.') : '(항목 전체)',
          message: issue.message,
        });
      }
    });
  }

  // id 중복은 파일을 넘나들며 생기므로 전부 읽은 뒤에 본다.
  const seen = new Map<string, number>();
  for (const q of questions) seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
  for (const [id, n] of seen) {
    if (n > 1) {
      issues.push({
        file: '(전체)',
        index: null,
        field: 'id',
        message: `id '${id}' 가 ${n}번 나온다 — id 는 문제 하나당 하나여야 한다`,
      });
    }
  }

  return { questions, issues, files };
}

/**
 * 검증을 통과한 문제 전체. 하나라도 실패하면 던진다.
 * 화면에서 쓰는 경로는 항상 이쪽이다 — 깨진 데이터가 조용히 지나가면 안 된다.
 */
export function getAllQuestions(dir: string = QUESTIONS_DIR): Question[] {
  const { questions, issues } = collectQuestions(dir);
  if (issues.length > 0) {
    const lines = issues
      .slice(0, 10)
      .map((i) => `  ${i.file}${i.index === null ? '' : `[${i.index}]`} · ${i.field}: ${i.message}`);
    const more = issues.length > 10 ? `\n  … 외 ${issues.length - 10}건` : '';
    throw new Error(`문제은행 검증 실패 ${issues.length}건\n${lines.join('\n')}${more}`);
  }
  return questions;
}

/** 주제별 문항 수. 화면과 validate 출력이 같은 함수를 쓴다. */
export function countByTopic(questions: readonly Question[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
  return counts;
}
