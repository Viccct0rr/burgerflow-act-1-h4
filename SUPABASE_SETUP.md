# Configuración inicial de Supabase

## Estado

La CLI y el SDK están instalados y la configuración de Supabase fue inicializada. Se creó en Supabase Cloud la organización gratuita `BurgerFlow` y el proyecto `BurgerFlow`, ref `vwobduocgjcreulhebxb`, en `South America (São Paulo)`. El proyecto muestra una URL Cloud `https://vwobduocgjcreulhebxb.supabase.co`. La Data API está habilitada, la exposición automática de tablas está deshabilitada y está habilitada la opción de RLS automático para tablas futuras. No se han creado tablas, migraciones ni autenticación de negocio; tampoco se ha realizado ninguna operación sobre la base de datos remota.

**No se completaron la sesión de la CLI ni la vinculación al proyecto.** La CLI no tiene token local (`supabase projects list` y `supabase link` responden `AccessTokenRequiredError`). No se han obtenido ni guardado credenciales de API. La URL del proyecto está confirmada; aún falta obtener la clave publishable desde Project Settings → API Keys.

## Entorno e instalación

- Sistema: Windows 11 Home, x64 (`win32 x64`).
- Node.js: v24.19.0.
- npm: v11.17.0; en PowerShell se usa `npm.cmd` porque la política de ejecución bloquea `npm.ps1`.
- Supabase CLI: v3.0.0, instalada como dependencia de desarrollo (`supabase`).
- SDK: `@supabase/supabase-js` v2.119.0, dependencia de producción.
- Método: instalación local con npm, para fijar las herramientas en el manifiesto y lockfile del repositorio.
- Proyecto: Node.js/Express con páginas HTML/JavaScript y SQLite local; no es una aplicación React.

## Archivos

- `supabase/config.toml`: configuración generada por `supabase init`. Solo prepara la CLI; no inicia servicios locales ni crea un proyecto Cloud.
- `backend/supabase-client.js`: inicializador centralizado del cliente, valida HTTPS de Supabase Cloud y una clave `sb_publishable_`. No se conecta ni modifica SQLite.
- `.env.example`: añade nombres y ejemplos de `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`; no contiene credenciales reales.
- `.gitignore`: excluye `.env` y variantes locales como `.env.local`, manteniendo `.env.example` versionable.
- `package.json` y `package-lock.json`: registran CLI y SDK.

## Variables de entorno

Copiar `.env.example` a `.env` y reemplazar únicamente:

```dotenv
SUPABASE_URL=https://vwobduocgjcreulhebxb.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<clave-del-proyecto>
```

Los valores reales se obtienen en el panel del proyecto Supabase, en su configuración/API. La URL y la clave publishable se pueden usar en el cliente previsto; nunca colocar una clave `sb_secret_`, `service_role` ni una contraseña de base de datos en el navegador o en el repositorio. `.env` está excluido de Git.

El módulo exporta `createSupabaseClient()` y falla explícitamente si faltan variables o tienen formato no permitido. No está conectado al arranque de Express: BurgerFlow continúa usando SQLite hasta que se solicite y diseñe una migración de integración posterior.

## Autenticación y vinculación Cloud

**Requiere intervención de la persona titular de la cuenta:** la CLI todavía no tiene una sesión. En una terminal interactiva de VS Code, ejecuta el login y completa la autorización en el navegador cuando se solicite:

```powershell
npx.cmd supabase login
npx.cmd supabase projects list
npx.cmd supabase link --project-ref vwobduocgjcreulhebxb
```

`projects list` debe devolver el proyecto creado y `link` debe terminar correctamente. No compartas tokens por chat. Si el flujo automático no funciona en tu terminal, crea un personal access token en Supabase y úsalo únicamente de forma local; nunca lo guardes en `.env` ni en Git.

La vinculación se verifica revisando que `supabase/.temp/project-ref` corresponda al proyecto elegido y que `projects list` mantenga acceso. No ejecutar `start`, `db push`, `migration up` ni comandos que creen o alteren recursos remotos durante esta preparación.

## Comandos útiles

```powershell
npx.cmd supabase --version
npx.cmd supabase login
npx.cmd supabase projects list
npx.cmd supabase link --project-ref vwobduocgjcreulhebxb
npm.cmd test
```

## Pendientes antes de integrar

1. Autorizar la CLI en la terminal local y vincular el `project ref` de `BurgerFlow`.
2. Obtener la clave publishable desde Project Settings → API Keys y guardarla solo en `.env`.
3. Probar `createSupabaseClient()` con las variables del proyecto.
4. Diseñar por separado la futura integración y estrategia de migración desde SQLite. Esta configuración inicial no crea esquema ni altera datos.
