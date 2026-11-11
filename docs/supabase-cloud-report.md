# Preparación inicial de Supabase Cloud para BurgerFlow

**Informe técnico de configuración**
**Fecha:** 11 de noviembre de 2026
**Repositorio:** [Viccct0rr/burgerflow-act-1-h4](https://github.com/Viccct0rr/burgerflow-act-1-h4)

## 1. Objetivo y alcance

Se preparó BurgerFlow para una futura integración con Supabase Cloud: se instaló la CLI y el SDK, se inicializó la configuración local y se creó un inicializador reutilizable del cliente. El trabajo se limitó a preparación de entorno y documentación; no se migró la aplicación desde SQLite ni se agregaron tablas, autenticación de negocio, CRUD o migraciones remotas.

La aplicación existente es Node.js/Express con páginas HTML, CSS y JavaScript, y usa SQLite local. No es una aplicación React. La integración con Supabase no está conectada al servidor y SQLite sigue siendo la base operativa.

## 2. Entorno y herramientas

| Elemento | Resultado verificado |
|---|---|
| Sistema | Windows 11 Home, x64 |
| Node.js | v24.19.0 |
| npm | v11.17.0; en PowerShell se usa `npm.cmd` |
| Supabase CLI | v3.0.0, dependencia de desarrollo |
| Supabase JavaScript SDK | `@supabase/supabase-js` v2.119.0 |
| Contenedores | No se instaló ni utilizó Docker |

## 3. Proyecto Supabase Cloud

| Propiedad | Estado |
|---|---|
| Organización | `BurgerFlow`, plan gratuito |
| Proyecto | `BurgerFlow` |
| Project ref | `vwobduocgjcreulhebxb` |
| Región | South America (São Paulo) |
| URL | `https://vwobduocgjcreulhebxb.supabase.co` |
| Data API | Habilitada |
| Exposición automática de tablas nuevas | Deshabilitada |
| Habilitar RLS automáticamente en tablas futuras | Opción habilitada |

La configuración automática de RLS es una salvaguarda para tablas futuras, pero no crea tablas ni políticas de autorización. No se hicieron cambios de esquema o datos en la base remota.

## 4. Archivos preparados

| Archivo | Función |
|---|---|
| `supabase/config.toml` | Configuración local inicial de Supabase CLI; no inicia servicios |
| `backend/supabase-client.js` | Crea el cliente SDK al recibir URL Cloud HTTPS y clave `sb_publishable_` |
| `.env.example` | Plantilla con URL del proyecto y nombre de variable para la clave publicable |
| `.gitignore` | Ignora `.env` y variantes locales; conserva `.env.example` |
| `package.json`, `package-lock.json` | Registran CLI y SDK |
| `SUPABASE_SETUP.md` | Guía operativa de instalación, configuración y pasos pendientes |

El inicializador valida la configuración y falla con un mensaje explícito si falta la URL o la clave. No se conecta automáticamente al arranque del servidor; por lo tanto, su inclusión no cambia el funcionamiento de BurgerFlow.

## 5. Seguridad de credenciales

La plantilla no contiene credenciales reales. `.env` está excluido de Git, y no existe archivo `.env` local en el estado revisado para este informe. La clave publicable aún no se ha agregado. Las claves secretas, `service_role`, contraseñas de base de datos y tokens personales nunca deben incluirse en el repositorio ni compartirse en documentos o conversaciones.

## 6. Validaciones y estado

| Verificación | Resultado |
|---|---|
| `npx.cmd supabase --version` | CLI responde v3.0.0 |
| SDK instalado | v2.119.0 |
| Inicializador central | Creó cliente con variables de prueba; no hizo consultas remotas |
| Pruebas existentes del proyecto | 12 de 12 aprobadas |
| Auditoría de dependencias de producción | 0 vulnerabilidades reportadas |
| CLI autenticada | **Pendiente**: falta autorizar una sesión local |
| Proyecto vinculado mediante CLI | **Pendiente**: no existe `supabase/.temp/project-ref` |
| Clave publicable real en `.env` | **Pendiente**: no se configuró ni verificó |
| Integración de negocio / migración SQLite | **No realizada**, fuera del alcance |

La autenticación no se declaró completa: `supabase projects list` respondió `AccessTokenRequiredError`. La sesión iniciada en el panel web no autentica por sí sola la CLI.

## 7. Pasos para completar la preparación

En una terminal PowerShell interactiva de VS Code:

```powershell
npx.cmd supabase login
npx.cmd supabase projects list
npx.cmd supabase link --project-ref vwobduocgjcreulhebxb
```

Después:

1. Verificar que `supabase/.temp/project-ref` contenga el project ref esperado.
2. Obtener la clave **publishable** desde la configuración/API Keys del proyecto.
3. Crear `.env` a partir de `.env.example` y guardar allí la clave localmente, nunca en Git.
4. Probar `createSupabaseClient()` con la configuración del proyecto.
5. Diseñar y aprobar por separado cualquier futura migración desde SQLite. No ejecutar `db push` ni comandos que cambien el esquema remoto sin autorización.

## 8. Conclusión

BurgerFlow cuenta con la instalación de herramientas, el proyecto Cloud, la configuración local inicial y documentación segura para continuar. Está **preparado para completar la conexión técnica**, pero aún no puede considerarse integrado ni plenamente vinculado: falta autenticar la CLI, vincular el proyecto y agregar la clave publicable local. La base de datos remota permanece sin cambios y la aplicación continúa operando con SQLite.
