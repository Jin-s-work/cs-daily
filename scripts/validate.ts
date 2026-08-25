/**
 * 문제은행 전체 검증. `npm run validate` 로 돌고, `npm run build` 앞에 자동으로 붙는다.
 *
 * 깨진 문제은행이 배포로 나가는 것을 막는 게 목적이므로, 실패하면 종료 코드 1을 낸다.
 */

import { collectQuestions, countByTopic } from '../src/lib/questions';
import { TOPICS } from '../src/lib/config';
import { TOPIC_VALUES } from '../src/lib/schema';

const { questions, issues, files } = collectQuestions();

if (issues.length > 0) {
  console.error(`\n✗ 문제은행 검증 실패 — ${issues.length}건\n`);
  for (const i of issues) {
    // index 는 0-based 다. 사람이 세는 번호로 바꿔서 보여준다.
    const where = i.index === null ? i.file : `${i.file} ${i.index + 1}번째 항목`;
    console.error(`  ${where}`);
    console.error(`    ${i.field} → ${i.message}\n`);
  }
  console.error(`읽은 파일: ${files.join(', ') || '(없음)'}`);
  process.exit(1);
}

const counts = countByTopic(questions);

console.log(`\n✓ 총 ${questions.length}문항 (파일 ${files.length}개)\n`);
console.log('  주제별 분포');
for (const topic of TOPIC_VALUES) {
  const n = counts[topic] ?? 0;
  if (n === 0) continue;
  const bar = '█'.repeat(Math.max(1, Math.round(n / 2)));
  console.log(`    ${TOPICS[topic].padEnd(8, ' ')} ${String(n).padStart(3, ' ')}  ${bar}`);
}

const empty = TOPIC_VALUES.filter((t) => !counts[t]);
if (empty.length > 0) {
  console.log(`\n  비어 있는 주제: ${empty.map((t) => TOPICS[t]).join(', ')}`);
}
console.log('');
