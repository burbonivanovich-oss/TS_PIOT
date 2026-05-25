import { useState, useEffect, useMemo } from 'react';
import { trackOnce, track } from '../../utils/track';

// Квиз «Готов ли бизнес к ТС ПИоТ». 6 вопросов с ветвящейся
// логикой: если читатель не торгует маркированным товаром,
// квиз пропускает технические вопросы. На выходе — оценка
// готовности (готов / частично / не готов) + персональный
// план действий со ссылками на наши разборы.

type AnswerId = string;
type QuestionId = 'category' | 'turnover' | 'kkt' | 'tspot' | 'edo' | 'staff';

interface Question {
  id: QuestionId;
  text: string;
  options: { id: AnswerId; label: string; score: number; flag?: string }[];
  show?: (answers: Record<QuestionId, AnswerId>) => boolean;
}

const QUESTIONS: Question[] = [
  {
    id: 'category',
    text: 'Какие товары продаёте?',
    options: [
      { id: 'marked-many', label: 'Маркированные товары — несколько категорий (молочка, напитки, табак, лекарства)', score: 0, flag: 'marked' },
      { id: 'marked-one', label: 'Маркированные товары — одна категория', score: 0, flag: 'marked' },
      { id: 'unmarked', label: 'Только немаркированные товары / услуги', score: 100, flag: 'unmarked' },
      { id: 'unknown', label: 'Не уверен, попадаю ли под маркировку', score: 0, flag: 'unsure' },
    ],
  },
  {
    id: 'turnover',
    text: 'Какой годовой оборот?',
    options: [
      { id: 'small', label: 'До 60 млн ₽', score: 0 },
      { id: 'medium', label: '60–250 млн ₽', score: 0, flag: 'nds-5' },
      { id: 'large', label: '250–450 млн ₽', score: 0, flag: 'nds-7' },
      { id: 'osno', label: 'Больше 450 млн ₽', score: 0, flag: 'osno' },
    ],
  },
  {
    id: 'kkt',
    text: 'Какая касса?',
    show: a => a.category !== 'unmarked',
    options: [
      { id: 'modern', label: 'Современная, поддерживает ФФД 1.2', score: 25 },
      { id: 'old', label: 'Старая, на ФФД 1.05 или 1.1', score: 5, flag: 'kkt-upgrade' },
      { id: 'none', label: 'Кассы пока нет', score: 0, flag: 'kkt-buy' },
      { id: 'unsure', label: 'Не знаю, надо уточнить', score: 5 },
    ],
  },
  {
    id: 'tspot',
    text: 'Установлен ли ТС ПИоТ?',
    show: a => a.category !== 'unmarked' && a.kkt !== 'none',
    options: [
      { id: 'yes', label: 'Да, модуль работает', score: 30 },
      { id: 'updating', label: 'В процессе обновления / тестируем', score: 15, flag: 'tspot-finish' },
      { id: 'no', label: 'Нет, ещё не подключали', score: 0, flag: 'tspot-install' },
      { id: 'token', label: 'Работаем через X-API-KEY ЦРПТ', score: 5, flag: 'tspot-deadline' },
    ],
  },
  {
    id: 'edo',
    text: 'Принимаете УПД от поставщиков через ЭДО?',
    show: a => a.category !== 'unmarked',
    options: [
      { id: 'yes', label: 'Да, ЭДО подключён', score: 20 },
      { id: 'partial', label: 'С некоторыми поставщиками — да, с некоторыми — нет', score: 10, flag: 'edo-extend' },
      { id: 'no', label: 'Не подключён', score: 0, flag: 'edo-setup' },
    ],
  },
  {
    id: 'staff',
    text: 'Знают ли кассиры, что делать при ответе «Выведен из оборота»?',
    show: a => a.category !== 'unmarked' && a.tspot !== 'no',
    options: [
      { id: 'yes', label: 'Да, есть инструкция и журнал', score: 25 },
      { id: 'briefly', label: 'В общих чертах', score: 12, flag: 'staff-train' },
      { id: 'no', label: 'Нет, не обсуждали', score: 0, flag: 'staff-train' },
    ],
  },
];

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  /** Если ad — это рекламная партнёрская ссылка с erid-дисклеймером (38-ФЗ). */
  link?: { href: string; label: string; ad?: { advertiser: string; erid: string } };
}

const RECOMMENDATIONS: Record<string, Recommendation> = {
  'kkt-buy': {
    id: 'kkt-buy',
    priority: 'high',
    title: 'Купить кассу с поддержкой ФФД 1.2',
    detail: 'Без современной кассы маркированный товар продать нельзя. ФФД 1.2 — обязательное требование для разрешительного режима.',
  },
  'kkt-upgrade': {
    id: 'kkt-upgrade',
    priority: 'high',
    title: 'Обновить кассовое ПО до ФФД 1.2',
    detail: 'Старые форматы (1.05/1.1) не поддерживают связку тегов 1163 + 2106, которая обязательна для маркированных товаров.',
  },
  'tspot-install': {
    id: 'tspot-install',
    priority: 'high',
    title: 'Установить модуль ТС ПИоТ',
    detail: 'С 28.12.2025 он обязателен на каждой кассе с маркированным товаром. До 01.07.2026 ещё можно работать через токен ЦРПТ, после — только ТС ПИоТ.',
    link: {
      href: 'https://kontur.ru/lp/market-ts-piot?p=f74746',
      label: 'Подключить кассу с ТС ПИоТ под ключ',
      ad: { advertiser: 'ООО «СКБ Контур»', erid: 'S4Ssbqz46cMqoDCd2gPnYmKCCXLH7EVza63Zaa77nHuVrKWqvpwfSp' },
    },
  },
  'tspot-deadline': {
    id: 'tspot-deadline',
    priority: 'high',
    title: 'Перейти с X-API-KEY на ТС ПИоТ до 01.07.2026',
    detail: 'После этой даты токены ЦРПТ отключаются. Без ТС ПИоТ касса заблокирует продажу маркированных товаров.',
    link: {
      href: 'https://kontur.ru/lp/market-ts-piot?p=f74746',
      label: 'Подключить кассу с ТС ПИоТ под ключ',
      ad: { advertiser: 'ООО «СКБ Контур»', erid: 'S4Ssbqz46cMqoDCd2gPnYmKCCXLH7EVza63Zaa77nHuVrKWqvpwfSp' },
    },
  },
  'tspot-finish': {
    id: 'tspot-finish',
    priority: 'medium',
    title: 'Завершить настройку ТС ПИоТ',
    detail: 'Прогоните тестовую продажу маркированного товара — проверьте, что касса формирует чек с тегами 1163 и 2106 и получает ответ от «Честного знака».',
  },
  'edo-setup': {
    id: 'edo-setup',
    priority: 'high',
    title: 'Подключить ЭДО для приёмки УПД',
    detail: 'Без ЭДО нельзя оприходовать маркированный товар от поставщика. Без оприходования — продавать тоже нельзя.',
  },
  'edo-extend': {
    id: 'edo-extend',
    priority: 'medium',
    title: 'Подключить ЭДО со всеми поставщиками маркированного товара',
    detail: 'Каждый поставщик, не передающий УПД электронно, — потенциальная дыра в учёте и риск блокировки кода на кассе.',
  },
  'staff-train': {
    id: 'staff-train',
    priority: 'medium',
    title: 'Провести инструктаж кассиров по разрешительному режиму',
    detail: 'Что делать при ответе «выведен из оборота» / «нет в системе» / сбое связи. Заведите журнал сбоев — он понадобится при проверке.',
    link: { href: '/blog/2026-05-01-shtraf-za-markirovku/', label: 'Штрафы за нарушения маркировки' },
  },
  'nds-5': {
    id: 'nds-5',
    priority: 'medium',
    title: 'Подготовиться к НДС 5% (УСН с оборотом 60–250 млн ₽)',
    detail: 'С 2026 года упрощенцы с таким оборотом становятся плательщиками НДС. Выбор: 5% без вычетов или 20% с вычетами.',
    link: { href: '/blog/2026-03-05-nalogi-msb-2026/', label: 'НДС для УСН в 2026' },
  },
  'nds-7': {
    id: 'nds-7',
    priority: 'medium',
    title: 'Готовиться к НДС 7% (оборот 250–450 млн ₽)',
    detail: 'Для оборота 250–450 млн ₽ ставка НДС на УСН — 7%. Решение по выбору ставки нужно зафиксировать заранее.',
    link: { href: '/blog/2026-03-05-nalogi-msb-2026/', label: 'НДС для УСН в 2026' },
  },
  'osno': {
    id: 'osno',
    priority: 'medium',
    title: 'Переход на ОСН (оборот >450 млн ₽)',
    detail: 'При обороте свыше 450 млн ₽ УСН недоступен. Нужно планировать переход на ОСН: НДС 20%, налог на прибыль, обязательная бухучётность.',
  },
};

export default function TsPiotReadinessQuiz() {
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, AnswerId>>>({});
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    trackOnce('quiz-ts-piot-started');
  }, []);

  const visibleQuestions = useMemo(
    () => QUESTIONS.filter(q => !q.show || q.show(answers as Record<QuestionId, AnswerId>)),
    [answers],
  );

  const currentIdx = visibleQuestions.findIndex(q => !answers[q.id]);
  const currentQ = currentIdx >= 0 ? visibleQuestions[currentIdx] : null;
  const totalSteps = visibleQuestions.length;
  const stepNum = currentIdx >= 0 ? currentIdx + 1 : totalSteps;

  function selectAnswer(qId: QuestionId, aId: AnswerId) {
    const next = { ...answers, [qId]: aId };
    setAnswers(next);
    track('quiz-ts-piot-answered', { q: qId, a: aId });

    const stillVisible = QUESTIONS.filter(q => !q.show || q.show(next as Record<QuestionId, AnswerId>));
    const remaining = stillVisible.findIndex(q => !next[q.id]);
    if (remaining < 0) {
      setFinished(true);
      trackOnce('quiz-ts-piot-completed');
    }
  }

  function restart() {
    setAnswers({});
    setFinished(false);
    track('quiz-ts-piot-restart');
  }

  const result = useMemo(() => {
    if (!finished) return null;
    let score = 0;
    const flags: string[] = [];
    for (const q of visibleQuestions) {
      const aId = answers[q.id];
      if (!aId) continue;
      const opt = q.options.find(o => o.id === aId);
      if (!opt) continue;
      score += opt.score;
      if (opt.flag) flags.push(opt.flag);
    }
    const isUnmarked = flags.includes('unmarked');
    // нормализуем score к 100: невидимые вопросы тоже сократили max
    const maxScore = visibleQuestions.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.score)), 0);
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    let level: 'ready' | 'partial' | 'not-ready' | 'na';
    let headline: string;
    let summary: string;
    if (isUnmarked) {
      level = 'na';
      headline = 'Под маркировку «Честного знака» вы не попадаете';
      summary =
        'Если в ассортименте появятся маркированные товары (например, бутилированная вода или БАДы) — придётся вернуться к этому квизу. Базовые требования к ККТ остаются.';
    } else if (pct >= 80) {
      level = 'ready';
      headline = 'Бизнес готов к работе с ТС ПИоТ';
      summary = 'Базовый стек закрыт. Останутся точечные улучшения — обработка ошибочных кодов и контроль связи на кассах.';
    } else if (pct >= 40) {
      level = 'partial';
      headline = 'Готовы частично — есть критические пробелы';
      summary = 'Несколько важных пунктов не закрыты. Каждый из них может стать причиной блокировки продажи или штрафа.';
    } else {
      level = 'not-ready';
      headline = 'Серьёзные пробелы — нужна срочная подготовка';
      summary = 'Без перечисленных ниже шагов работа с маркированным товаром в 2026 году рискованна. Начните с задач высокого приоритета.';
    }

    const recs = flags
      .map(f => RECOMMENDATIONS[f])
      .filter(Boolean)
      .sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return prio[a.priority] - prio[b.priority];
      });

    return { pct, level, headline, summary, recs };
  }, [finished, answers, visibleQuestions]);

  if (finished && result) {
    return (
      <div className="quiz">
        <div className={`quiz-result level-${result.level}`}>
          {result.level !== 'na' && (
            <div className="quiz-score">
              <span className="quiz-score-num">{result.pct}</span>
              <span className="quiz-score-unit">из 100</span>
            </div>
          )}
          <h3 className="quiz-headline">{result.headline}</h3>
          <p className="quiz-summary">{result.summary}</p>
        </div>

        {result.recs.length > 0 && (
          <div className="quiz-recs">
            <h4 className="quiz-recs-title">Что сделать в первую очередь</h4>
            <ol className="quiz-recs-list">
              {result.recs.map(r => (
                <li key={r.id} className={`quiz-rec prio-${r.priority}`}>
                  <div className="quiz-rec-head">
                    <span className={`quiz-rec-prio prio-${r.priority}`}>
                      {r.priority === 'high' ? 'Срочно' : r.priority === 'medium' ? 'Важно' : 'По возможности'}
                    </span>
                    <span className="quiz-rec-title">{r.title}</span>
                  </div>
                  <p className="quiz-rec-detail">{r.detail}</p>
                  {r.link && (
                    <>
                      <a
                        href={r.link.href}
                        className="quiz-rec-link"
                        {...(r.link.ad ? { target: '_blank', rel: 'sponsored noopener nofollow' } : {})}
                      >
                        {r.link.label} →
                      </a>
                      {r.link.ad && (
                        <p className="quiz-rec-ad">
                          Реклама. {r.link.ad.advertiser}. erid: {r.link.ad.erid}
                        </p>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        <button type="button" className="quiz-restart" onClick={restart}>
          Пройти ещё раз
        </button>

        <style>{quizStyles}</style>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="quiz">
      <div className="quiz-progress">
        <span>Вопрос {stepNum} из {totalSteps}</span>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${(stepNum / totalSteps) * 100}%` }} />
        </div>
      </div>

      <h3 className="quiz-q">{currentQ.text}</h3>
      <div className="quiz-options">
        {currentQ.options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className="quiz-opt"
            onClick={() => selectAnswer(currentQ.id, opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <style>{quizStyles}</style>
    </div>
  );
}

const quizStyles = `
  .quiz {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.75rem;
    background: var(--sand, #F4EBD9);
    border-radius: 12px;
  }
  .quiz-progress {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #666;
  }
  .quiz-progress-bar {
    height: 4px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 999px;
    overflow: hidden;
  }
  .quiz-progress-fill {
    height: 100%;
    background: var(--pink, #FF4D8F);
    transition: width 0.3s ease;
  }
  .quiz-q {
    margin: 0.5rem 0 1rem;
    font-size: 1.15rem;
    line-height: 1.35;
    color: var(--dark, #1F1F1F);
  }
  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .quiz-opt {
    padding: 0.85rem 1.15rem;
    background: #fff;
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    line-height: 1.45;
    color: var(--dark, #1F1F1F);
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }
  .quiz-opt:hover,
  .quiz-opt:focus-visible {
    border-color: var(--pink, #FF4D8F);
    transform: translateY(-1px);
    outline: none;
  }

  .quiz-result {
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
  }
  .quiz-result.level-ready    { background: rgba(200, 255, 107, 0.18); }
  .quiz-result.level-partial  { background: rgba(255, 199, 0, 0.12); }
  .quiz-result.level-not-ready{ background: rgba(255, 77, 143, 0.10); }
  .quiz-result.level-na       { background: #fff; }
  .quiz-score {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
  }
  .quiz-score-num {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--pink, #FF4D8F);
    line-height: 1;
  }
  .quiz-score-unit { color: #666; font-size: 0.95rem; }
  .quiz-headline {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    line-height: 1.3;
    color: var(--dark, #1F1F1F);
  }
  .quiz-summary {
    margin: 0;
    line-height: 1.55;
    color: #333;
  }

  .quiz-recs-title {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    color: var(--dark, #1F1F1F);
  }
  .quiz-recs-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .quiz-rec {
    padding: 1rem 1.15rem;
    background: #fff;
    border-radius: 8px;
    border-left: 3px solid;
  }
  .quiz-rec.prio-high    { border-left-color: var(--pink, #FF4D8F); }
  .quiz-rec.prio-medium  { border-left-color: #FFB300; }
  .quiz-rec.prio-low     { border-left-color: rgba(0, 0, 0, 0.3); }
  .quiz-rec-head {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }
  .quiz-rec-prio {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.15em 0.6em;
    border-radius: 999px;
  }
  .quiz-rec-prio.prio-high   { background: var(--pink, #FF4D8F); color: #fff; }
  .quiz-rec-prio.prio-medium { background: #FFB300; color: #fff; }
  .quiz-rec-prio.prio-low    { background: rgba(0, 0, 0, 0.1); color: #333; }
  .quiz-rec-title {
    font-weight: 600;
    color: var(--dark, #1F1F1F);
  }
  .quiz-rec-detail {
    margin: 0;
    line-height: 1.55;
    color: #333;
    font-size: 0.95rem;
  }
  .quiz-rec-link {
    display: inline-block;
    margin-top: 0.5rem;
    color: var(--pink, #FF4D8F);
    font-weight: 600;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .quiz-rec-link:hover { text-decoration: underline; }
  .quiz-rec-ad {
    margin: 0.35rem 0 0;
    font-size: 0.7rem;
    color: #999;
    line-height: 1.3;
    word-break: break-all;
  }

  .quiz-restart {
    align-self: flex-start;
    padding: 0.55em 1.2em;
    background: transparent;
    border: 1px solid var(--dark, #1F1F1F);
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
    color: var(--dark, #1F1F1F);
  }
  .quiz-restart:hover { background: var(--dark, #1F1F1F); color: #fff; }

  @media (max-width: 640px) {
    .quiz { padding: 1.25rem; }
  }
`;
