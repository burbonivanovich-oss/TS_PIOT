export const READINESS_QUESTIONS = [
  { id: 'role', label: 'Ваша роль в перевозке', options: [['sender', 'Грузоотправитель'], ['carrier', 'Перевозчик'], ['recipient', 'Грузополучатель'], ['mixed', 'Несколько ролей']] },
  { id: 'interface', label: 'Где планируете работать с ЭТРН', options: [['web', 'В браузере'], ['1c', 'В 1С'], ['unknown', 'Пока не выбрали']] },
  { id: 'partners', label: 'Согласовали обмен с участниками перевозки', options: [['yes', 'Да'], ['no', 'Нет'], ['unknown', 'Пока неизвестно']] },
  { id: 'signing', label: 'Назначили подписантов и проверили их полномочия', options: [['yes', 'Да'], ['no', 'Нет'], ['unknown', 'Пока неизвестно']] },
  { id: 'trial', label: 'Провели пробный обмен всеми этапами документа', options: [['yes', 'Да'], ['no', 'Нет'], ['unknown', 'Пока неизвестно']] },
];

const ROLES = {
  sender: 'Опишите, кто готовит данные накладной, проверяет груз и оформляет передачу перевозчику.',
  carrier: 'Распределите действия между диспетчером и водителем; проверьте доступ к документу на маршруте.',
  recipient: 'Опишите приёмку груза: кто проверяет документ и фиксирует замечания при получении.',
  mixed: 'Составьте отдельный сценарий для каждой роли и определите, кто выполняет её действия.',
};

export function readinessPlan(answers) {
  const missing = READINESS_QUESTIONS.filter(q => !q.options.some(([value]) => value === answers?.[q.id])).map(q => q.id);
  if (missing.length) return { complete: false, missing, steps: [] };
  const steps = [{ id: 'roles', text: ROLES[answers.role] }];
  if (answers.interface === '1c') steps.push({ id: 'interface', text: 'Запишите название и версию конфигурации 1С. Согласуйте совместимость и порядок обмена с поставщиком решения.' });
  else if (answers.interface === 'web') steps.push({ id: 'interface', text: 'Проверьте доступ сотрудников к веб-интерфейсу и устройствам, на которых они будут работать.' });
  else steps.push({ id: 'interface', text: 'Сравните работу в браузере и в учётной системе на одном типовом рейсе: ввод данных, подпись, исправления и поиск документа.' });
  if (answers.partners !== 'yes') steps.push({ id: 'partners', text: 'Свяжитесь с отправителем, перевозчиком и получателем: согласуйте способ обмена, ответственных и порядок действий при сбое.' });
  if (answers.signing !== 'yes') steps.push({ id: 'signing', text: 'Определите подписантов для каждого этапа; проверьте подписи и полномочия вместе с ответственным за документы.' });
  if (answers.trial !== 'yes') steps.push({ id: 'trial', text: 'Проведите пробный обмен с контрагентами, включая приёмку, замечания и исправления. Зафиксируйте найденные проблемы.' });
  const unresolved = ['partners', 'signing', 'trial'].filter(key => answers[key] !== 'yes').length;
  return { complete: true, missing: [], steps, unresolved, title: unresolved ? 'Что подготовить до пробного рейса' : 'Что проверить перед рабочим рейсом' };
}
