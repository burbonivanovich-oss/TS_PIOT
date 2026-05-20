import { useState, useEffect, useMemo } from 'react';
import { trackOnce, track } from '../../utils/track';

// Чек-бокс-симулятор для сценарного гайда. Принимает массив фаз
// со задачами, рендерит интерактивный чек-лист с прогрессом и
// сохраняет состояние в localStorage. Используется в гайдах
// «Открываю кофейню за 30 дней» и подобных.

export interface ScenarioTask {
  id: string;
  day: string;       // «1–3», «День 5», «Постоянно»
  title: string;
  detail?: string;
  link?: { href: string; label: string };
}

export interface ScenarioPhase {
  id: string;
  name: string;
  color?: 'pink' | 'lime' | 'sand' | 'dark';
  tasks: ScenarioTask[];
}

interface Props {
  storageKey: string;
  phases: ScenarioPhase[];
  trackPrefix: string;
}

export default function ScenarioChecklist({ storageKey, phases, trackPrefix }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {}
  }, [done, storageKey, hydrated]);

  const allTasks = useMemo(() => phases.flatMap(p => p.tasks), [phases]);
  const completed = useMemo(
    () => allTasks.filter(t => done[t.id]).length,
    [allTasks, done],
  );
  const total = allTasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  useEffect(() => {
    if (!hydrated) return;
    if (completed > 0) trackOnce(`${trackPrefix}-started`);
    if (pct >= 25) trackOnce(`${trackPrefix}-25pct`);
    if (pct >= 50) trackOnce(`${trackPrefix}-50pct`);
    if (pct >= 75) trackOnce(`${trackPrefix}-75pct`);
    if (pct === 100) trackOnce(`${trackPrefix}-completed`);
  }, [pct, completed, hydrated, trackPrefix]);

  function toggle(id: string) {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id]) track(`${trackPrefix}-task-checked`, { id });
      return next;
    });
  }

  function reset() {
    setDone({});
    track(`${trackPrefix}-reset`);
  }

  return (
    <div className="sc">
      <div className="sc-progress">
        <div className="sc-progress-label">
          Готово <strong>{completed}</strong> из {total} задач
          <span className="sc-progress-pct">· {pct}%</span>
        </div>
        <div className="sc-progress-bar">
          <div className="sc-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {completed > 0 && (
          <button type="button" className="sc-reset" onClick={reset}>
            Сбросить
          </button>
        )}
      </div>

      <div className="sc-phases">
        {phases.map(phase => {
          const phaseDone = phase.tasks.filter(t => done[t.id]).length;
          const phaseTotal = phase.tasks.length;
          return (
            <section key={phase.id} className={`sc-phase color-${phase.color ?? 'sand'}`}>
              <header className="sc-phase-head">
                <h3 className="sc-phase-name">{phase.name}</h3>
                <span className="sc-phase-count">
                  {phaseDone}/{phaseTotal}
                </span>
              </header>
              <ul className="sc-tasks">
                {phase.tasks.map(task => (
                  <li
                    key={task.id}
                    className={`sc-task ${done[task.id] ? 'done' : ''}`}
                  >
                    <label className="sc-task-label">
                      <input
                        type="checkbox"
                        checked={!!done[task.id]}
                        onChange={() => toggle(task.id)}
                      />
                      <span className="sc-task-day">{task.day}</span>
                      <span className="sc-task-body">
                        <span className="sc-task-title">{task.title}</span>
                        {task.detail && <span className="sc-task-detail">{task.detail}</span>}
                        {task.link && (
                          <a
                            href={task.link.href}
                            className="sc-task-link"
                            onClick={e => e.stopPropagation()}
                          >
                            {task.link.label} →
                          </a>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <style>{`
        .sc {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .sc-progress {
          position: sticky;
          top: 0.5rem;
          z-index: 5;
          padding: 0.85rem 1.15rem;
          background: var(--dark, #1F1F1F);
          color: #fff;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sc-progress-label {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.95rem;
        }
        .sc-progress-pct { opacity: 0.6; font-size: 0.85rem; }
        .sc-progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          overflow: hidden;
        }
        .sc-progress-fill {
          height: 100%;
          background: var(--lime, #C8FF6B);
          transition: width 0.3s ease;
        }
        .sc-reset {
          align-self: flex-end;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: #fff;
          padding: 0.2em 0.7em;
          border-radius: 999px;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .sc-phases {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .sc-phase {
          padding: 1.25rem 1.5rem;
          border-radius: 12px;
          border-left: 4px solid;
        }
        .sc-phase.color-pink { background: rgba(255, 77, 143, 0.06); border-left-color: var(--pink, #FF4D8F); }
        .sc-phase.color-lime { background: rgba(200, 255, 107, 0.12); border-left-color: var(--lime, #C8FF6B); }
        .sc-phase.color-sand { background: var(--sand, #F4EBD9); border-left-color: rgba(31, 31, 31, 0.3); }
        .sc-phase.color-dark { background: rgba(0, 0, 0, 0.04); border-left-color: var(--dark, #1F1F1F); }

        .sc-phase-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 1rem;
        }
        .sc-phase-name {
          margin: 0;
          font-size: 1.15rem;
          color: var(--dark, #1F1F1F);
        }
        .sc-phase-count {
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          color: #666;
        }

        .sc-tasks {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sc-task {
          background: rgba(255, 255, 255, 0.7);
          border-radius: 8px;
          transition: opacity 0.2s ease;
        }
        .sc-task.done { opacity: 0.55; }
        .sc-task-label {
          display: grid;
          grid-template-columns: auto 5.5rem 1fr;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.75rem 1rem;
          cursor: pointer;
        }
        .sc-task-label input[type='checkbox'] {
          margin-top: 0.2rem;
          width: 1.1rem;
          height: 1.1rem;
          accent-color: var(--pink, #FF4D8F);
          cursor: pointer;
        }
        .sc-task-day {
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          font-weight: 600;
          color: #666;
          padding-top: 0.15rem;
        }
        .sc-task-body {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 0;
        }
        .sc-task-title {
          color: var(--dark, #1F1F1F);
          line-height: 1.4;
        }
        .sc-task.done .sc-task-title { text-decoration: line-through; }
        .sc-task-detail {
          font-size: 0.85rem;
          color: #555;
          line-height: 1.45;
        }
        .sc-task-link {
          font-size: 0.85rem;
          color: var(--pink, #FF4D8F);
          font-weight: 600;
          text-decoration: none;
        }
        .sc-task-link:hover { text-decoration: underline; }

        @media (max-width: 640px) {
          .sc-task-label { grid-template-columns: auto 1fr; }
          .sc-task-day {
            grid-column: 2;
            order: -1;
            margin-bottom: 0.15rem;
          }
        }
      `}</style>
    </div>
  );
}
