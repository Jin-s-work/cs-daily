'use client';

import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import type { Question } from '@/lib/schema';
import { ExamResultView } from './ExamResultView';
import { ExamRunner } from './ExamRunner';
import { ExamSetup } from './ExamSetup';
import { useExamSession } from './useExamSession';

export function ExamClient({ questions: base, today }: { questions: Question[]; today: string }) {
  const { questions, ready } = useMergedQuestions(base);
  const s = useExamSession(questions, today);

  if (!ready && s.phase === 'setup') {
    return <p className="py-20 text-center text-sm text-muted">불러오는 중…</p>;
  }

  if (s.phase === 'setup') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold md:text-2xl">시험</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          드릴과 따로 돈다. 여기서 틀린 문항만 복습 일정에 되먹인다.
        </p>
        <ExamSetup questions={questions} onStart={s.start} error={s.error} />
      </div>
    );
  }

  if (s.phase === 'result' && s.summary) {
    const msSpent = s.answers.size === 0 ? 0 : [...s.answers.values()].reduce((a, b) => a + b.msSpent, 0);
    return (
      <ExamResultView
        summary={s.summary}
        questions={s.questions}
        answers={s.answers}
        msSpent={msSpent}
        saving={s.saving}
        error={s.error}
        onRestart={() => window.location.reload()}
      />
    );
  }

  if (!s.current) return null;

  return (
    <ExamRunner
      question={s.current}
      index={s.index}
      total={s.questions.length}
      grading={s.phase === 'grading'}
      choice={s.choice}
      setChoice={s.setChoice}
      text={s.text}
      setText={s.setText}
      remainingMs={s.remainingMs}
      onSubmit={s.submit}
      onSelfGrade={s.selfGrade}
      onNext={s.next}
    />
  );
}
