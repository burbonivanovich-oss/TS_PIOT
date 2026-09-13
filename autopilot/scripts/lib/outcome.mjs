// Единая таксономия исходов и коды выхода (AP-P1-14).
//
// Scheduler не должен разбирать русские строки regex-ами, чтобы понять, что
// случилось. Каждый CLI-результат несёт машинное поле `category`, а процесс
// завершается кодом, по которому видно: это редакционный отказ, проблема
// конфигурации, инфраструктуры или внутренняя ошибка.
export const EXIT = {
  ok: 0,
  usage: 1,
  content_reject: 2,
  config: 3,
  infra: 4,
  internal: 5,
};

/** Классифицировать исключение по коду/сообщению. */
export function classifyError(error) {
  const message = String(error?.message || error || '');
  const code = error?.code;
  if (/конфиг|config/i.test(message)) return { category: 'config', exitCode: EXIT.config };
  if (/уже работает|блокировк|lock-файл|reap-файл/i.test(message)) return { category: 'infra', exitCode: EXIT.infra };
  if (code && ['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EIO', 'EROFS', 'EMFILE', 'ENFILE'].includes(code)) {
    return { category: 'infra', exitCode: EXIT.infra };
  }
  if (/корпус|каталог (статей|блога)|contentRoot/i.test(message)) return { category: 'infra', exitCode: EXIT.infra };
  return { category: 'internal', exitCode: EXIT.internal };
}

/** Единый машинный конверт результата. */
export function envelope({ ok, category = ok ? 'ok' : 'internal', exitCode, ...rest }) {
  return {
    ok,
    category,
    exitCode: exitCode ?? (ok ? EXIT.ok : EXIT.internal),
    ...rest,
  };
}
