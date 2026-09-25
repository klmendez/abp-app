# Correcciones — 2026-09-17

Estado: publicadas en producción el 2026-09-17. Ver `PRODUCCION-2026-09-17.md` para destinos, verificación y referencias de reversión.

## Cambios

- `firestore.rules`: toma como base las reglas reales consultadas en producción, reemplazando la versión local permisiva. Incluye actividades raíz; historial de comprobantes de solo creación/lectura para administradores; creación administrativa de perfiles; acceso de asesores activos a clientes y actividades de ABP y lectura del directorio necesario para asignar responsables. No da a asesores acceso contable, a comisiones ni administración de usuarios. Los clientes del portal no obtienen estos permisos.
- `src/modules/accounting/VouchersPage.jsx`: un único batch guarda encabezado, historial, líneas, anulación de líneas anteriores y estado contabilizado. Un rechazo no deja el encabezado guardado por separado.
- `src/UsersAdmin.jsx`: perfil y membresía se guardan en un único batch. Ante un fallo al provisionar una cuenta nueva, solo se elimina esa cuenta Auth si lecturas del servidor confirman que ambos documentos están ausentes. Si hay una respuesta perdida o no se puede verificar, conserva el UID para recuperar la operación sin duplicar cuentas.
- Portal, `src/components/InsuredPeopleTable.tsx`: la fecha de vinculación existente es de solo lectura, con explicación, y no se envía como modificación. Se conserva la restricción de base de datos; no se permite alterar la fecha original desde el portal.
- Portal, `src/lib/clientPortal.ts`: al deshacer un retiro, restaura tipo de novedad, importe y días guardados antes del retiro. Si el registro antiguo no guardó esos valores, quedan nulos en lugar de mantener el retiro. Las reglas validan los valores contra los anteriores y bloquean otros cambios. Se admite temporalmente el formato limitado de restauración de las versiones antiguas para no romper sesiones ya abiertas; el comportamiento completo requiere el frontend nuevo.

## Verificación

- 49/49 casos en la API de simulación de reglas de Firebase, con documentos y usuarios simulados. Incluyen los permisos reparados, aislamiento entre clientes y empresas, asesor inactivo, protección contra elevación de privilegios, alteración de identidad y primas, y protección del historial de comprobantes.
- 7/7 pruebas ejecutando los handlers reales de guardado contra una frontera de Firestore en memoria. Cubren rechazo del batch, guardado íntegro, reversión de cuenta nueva, respuesta perdida después de un commit y verificación sin conexión.
- 15/15 pruebas del portal, incluyendo recuperación de novedad y registros antiguos.
- Compilación correcta de ambos proyectos y TypeScript correcto en Insurance.
- Lint de Gestión: cero errores, tres advertencias existentes. Lint de los archivos modificados del portal: cero errores, cinco advertencias de estilo existentes.
- No se modificaron datos reales durante esta corrección ni se crearon cuentas para las pruebas. Los siete documentos temporales de la revisión anterior ya habían sido eliminados y verificados.
- La prueba visual de extremo a extremo continúa pendiente por el fallo de infraestructura del navegador documentado en la revisión.

Repetir las verificaciones:

```powershell
# ABP-gestion
node audit/test-published-rules.mjs --local
node --test audit/atomic-save.test.mjs
npm run lint
npm run build

# abp-insurance
npm run typecheck
node --experimental-strip-types --test scripts/client-portal.test.mjs scripts/client-portal-ui.test.mjs
npm run build -- --outDir .tmp-audit-build
```

La simulación utiliza la sesión local de Firebase y no despliega reglas. Resultados: `rules-fixed-results.json`.

## Aplicación en producción

Se publicaron las reglas de `abp-agencia-de-seguros`, Gestión en Firebase Hosting y el portal en GitHub Pages. Se conservó la copia anterior `deployed-firestore.rules` para una eventual reversión. Ambos proyectos incluyen los cambios locales previos incorporados en las compilaciones verificadas.

Los índices faltantes detectados en una función actualmente no usada por la pantalla de comisiones son un hallazgo separado de los siete casos; no se crearon índices ni se cambió esa función.
