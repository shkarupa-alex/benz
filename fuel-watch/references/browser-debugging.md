# Browser debugging

Читай этот reference только при явном запросе на визуальный осмотр браузера или диагностику источника. Обычная разовая проверка и мониторинг используют `collect.mjs`; не добавляй к ним вкладки, screenshots или другие диагностические артефакты.

## Одно окно с тремя источниками

Используй один namespace и одну session, `AGENT_BROWSER_IDLE_TIMEOUT_MS=3600000` и только точные URL источников из конфига. Не передавай `--allowed-domains` в этой видимой session: agent-browser 0.35.1 при применении CDP network controls к третьей вкладке воспроизводимо теряет execution context и сбрасывает предыдущие tabs. После каждой навигации прочитай final URL и fail-closed проверь host по `config.browser.allowedDomains`; при внешнем redirect сразу закрой owned session и сообщи `RESOURCE_BLOCKED`. Это исключение относится только к ручной диагностике.

Первую страницу Yandex открой через `open --headed`; в agent-browser 0.35.1 она останется с системным label вроде `t1`. Затем сразу создай только две вкладки через `tab new --label gdebenz` и `tab new --label two-gis`. Не создавай временную четвёртую вкладку и отдельные sessions. После каждого `tab new` проверь `tab list` и `reused`; `launched: true`, потеря предыдущих вкладок или `about:blank` означают `BROWSER_UNAVAILABLE`.

## Сбор evidence

Начинай с коротких `get`, `snapshot` и узких `eval`. Screenshot допустим только когда визуальное состояние само является необходимым evidence. На agent-browser 0.35.1 запускай его в disposable owned session с коротким timeout: наблюдалось зависание command queue. Если команда зависла, заверши точные принадлежащие диагностике client/daemon/browser процессы, пересоздай owned session и продолжай; отдельное согласие на остановку процессов, которые запустил сам агент для этой диагностики, не требуется. Никогда не трогай пользовательские или чужие browser-процессы.

Не используй HAR, video, trace, restore/profile, CAPTCHA solver или прямой HTTP-клиент. Видимая diagnostic session не является collection-run; после осмотра закрой её и проверь отсутствие принадлежащих ей sessions/processes.
