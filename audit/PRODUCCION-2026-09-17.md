# Publicación en producción — 2026-09-17

## Destinos publicados

- Gestión: https://abp-agencia-de-seguros.web.app/ — Firebase Hosting, despliegue completado.
- Portal: https://abpsegurosltda.com/#/login-clientes — GitHub Pages, despliegue completado. El dominio usa GitHub Pages; la configuración de Netlify encontrada era antigua y no se utilizó.
- Firestore: proyecto `abp-agencia-de-seguros`, reglas publicadas y comprobadas contra el archivo corregido.

## Evidencia posterior a la publicación

- HTTP 200 de ambos sitios.
- HTML de cada sitio idéntico a su compilación local verificada, normalizando únicamente saltos de línea.
- JavaScript y CSS descargados desde ambos sitios: HTTP 200 y SHA-256 idéntico a los archivos verificados.
- 49/49 casos de permisos correctos, ejecutados sobre una copia descargada de las reglas efectivamente publicadas. Los usuarios y documentos de esas pruebas son simulados; no se crearon cuentas ni se modificaron datos de clientes.
- GitHub Pages: workflow `35256113957`, resultado `success`: https://github.com/klmendez/abp-insurance/actions/runs/35256113957
- Commit publicado del portal: `34bc03552bb30fb737251dd801b50d82c19f92c3`. Incluye código fuente correspondiente al portal y la compilación en `docs`, manteniendo `docs/CNAME` y los assets anteriores para páginas en caché.
- El commit del portal se creó desde un worktree separado en `D:/W/abp-insurance-production`; no se reinició ni limpió el checkout original del usuario. El checkout original continúa con sus cambios locales.
- No se hizo una prueba visual autenticada de extremo a extremo, debido al fallo del navegador integrado documentado anteriormente. La publicación está verificada; esto no equivale a haber ejecutado manualmente cada flujo con usuarios reales.

Archivos de evidencia: `production-verification.json`, `rules-production-results.json`, `production-current.rules`.

## Referencias anteriores para reversión

- Firebase Hosting: `sites/abp-agencia-de-seguros/versions/e91857fb1dbd8db3`.
- Firestore: ruleset `projects/abp-agencia-de-seguros/rulesets/3da3b034-a93d-41e1-a501-36739fbfd64f`; copia de contenido en `deployed-firestore.rules`.
- GitHub Pages: commit anterior `c27e7853ffc485798a8bd52f2ebaaa48aa28dcfc`.
- Metadatos previos de Firebase en `production-before.json`.

No fue necesario revertir el despliegue. Los siete documentos temporales de la revisión inicial ya habían sido eliminados y verificados; durante esta publicación no se escribieron documentos de negocio.
