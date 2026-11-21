# SHIM-SHIM

App de gimnasio en React Native, Expo y TypeScript para Android, iOS y web. Mimo es la entrada principal: una conversación que consulta datos reales y ejecuta herramientas sobre el perfil activo. La dirección visual Compañero usa verdes suaves, tipografía redondeada y una mascota animada.

## Probar online

La versión web se aloja con un servidor de IA online y acceso privado mediante Sites. No necesita que la computadora esté encendida. La clave de Groq se configura como secreto del servidor, nunca en el código del celular. El acceso inicial está limitado al propietario; compartir con otra persona requiere invitarla al sitio.

Los perfiles y registros se guardan en este dispositivo: `localStorage` en web y SQLite en Android/iOS. Todavía no hay sincronización ni cuentas propias de SHIM-SHIM. Dos perfiles locales no constituyen una barrera de seguridad entre personas que usan el mismo navegador. Exportá un respaldo antes de borrar datos o cambiar de dispositivo.

## Conversar con Mimo

- «Según mi rutina, ¿cuándo podría subir el peso?» consulta las progresiones y muestra el cálculo por ejercicio.
- «Cambiá el descanso de press banca a 120 segundos» modifica el ejercicio y muestra lo aplicado.
- «Empezá mi rutina de torso», «Registrá la primera serie de banca: 60 kilos, 10 repeticiones, RIR 2» y «Terminá el entrenamiento» manejan una sesión real.
- «Registrá mi almuerzo: una porción, 600 kcal, 40 g de proteína, 70 g de carbohidratos y 18 g de grasas» guarda una comida con los valores indicados.
- «Proponeme cambios en mi rutina» prepara propuestas para aplicar o descartar.
- También permite consultar/corregir historial, editar metas, crear/cambiar perfiles, abrir vistas y exportar/restaurar respaldos. Restaurar abre el formulario validado y requiere confirmar el reemplazo.

Las vistas de plan, comidas e historial siguen disponibles. Las consultas no cambian datos; los pedidos concretos se aplican y las eliminaciones requieren confirmación. Los cambios sobre registros del perfil actual se pueden deshacer mientras los datos no hayan cambiado después. Crear un perfil nuevo no permite eliminarlo mediante Deshacer.

La IA es Groq (`openai/gpt-oss-120b`) con herramientas tipadas y validadas. El servidor limita las herramientas al dominio de la app, separa el contexto por perfil y devuelve cambios atómicos; el cliente vuelve a validar el estado antes de guardarlo. No se envían los registros ni conversaciones de otros perfiles, salvo los nombres/IDs disponibles para cambiar de perfil. Los datos del perfil consultado y los mensajes recientes se envían a Groq para generar la respuesta.

La cuota gratuita puede limitar o demorar consultas. La app informa los errores y no aplica un turno incompleto ni activa planes pagos. Una recomendación generada puede ser incorrecta: revisá la tarjeta antes de aceptar propuestas.

## Desarrollo local

Node.js 22.6 o superior y npm. Copiar `.env.example` a `.env`, completar `GROQ_API_KEY` y mantener ese archivo fuera de Git.

```powershell
npm ci
npm run build:hosted
npm run ai
```

Abrir `http://127.0.0.1:8787` (o el puerto `AI_PORT` de `.env`). Para editar con recarga rápida, ejecutar además `npm run web`; Metro reenvía `/api` al servidor local. El servidor de desarrollo escucha solo en loopback. La web alojada usa su propio servidor protegido y no depende de este proceso.

Ollama queda disponible como alternativa local mediante `AI_PROVIDER=ollama` y `OLLAMA_MODEL`; necesita la computadora encendida y un modelo instalado. La opción online elegida no necesita Ollama.

## Android e iOS

```powershell
npm start
```

El proyecto comparte la interfaz y persistencia nativas. La integración online alojada usa la sesión del navegador de Sites: una compilación nativa necesita un backend y autenticación compatibles; configurar una URL por sí solo no reemplaza ese inicio de sesión. Por ahora, para usar la IA online en ambos celulares, abrir la versión web.

`eas.json` incluye un perfil preview para generar un APK después de configurar Expo y firma. No hay APK/IPA generado ni pruebas físicas de esta versión. La distribución iOS necesita la firma correspondiente de Apple.

## Progresión y comidas

La progresión doble exige todas las series al máximo del rango, técnica cómoda y RIR suficiente antes de sugerir subir el incremento configurado. Los ejercicios guardan una copia en cada sesión, de modo que editar una rutina no reescribe el historial.

Las proyecciones usan historial real cuando existe. Sin suficientes observaciones, muestran un escenario condicional de una repetición total adicional por sesión; los datos de ejemplo se identifican y no justifican fechas personales. Si faltan dos repeticiones totales, el escenario contempla dos sesiones para completarlas y evaluar la carga en la tercera.

Los objetivos nutricionales empiezan sin definir. El catálogo tiene valores ilustrativos por porción; registrar una comida o editar objetivos funciona, pero no existe una prescripción dietaria automática basada solo en la meta. Mimo pide datos faltantes y debe presentar las estimaciones como propuestas.

## Validación y alojamiento

```powershell
npm test
npm run typecheck
npm run build:hosted
npm run test:ai
```

`test:ai` usa la API real y consume cuota; trabaja con datos sintéticos y verifica una consulta de progresión y un cambio de objetivo semanal. Las pruebas automáticas cubren progresión, respaldos, separación de perfiles, conflictos, propuestas, deshacer, comidas, sesiones completas por herramientas y transporte de llamadas a Groq.

`build:hosted` exporta la web e incorpora sus recursos en un Worker ESM (`dist/server/index.js`). `.openai/hosting.json` vincula el repositorio con el sitio existente. Los secretos se inyectan en ejecución; no se incluyen en el bundle ni en el archivo de despliegue. El Worker exige la identidad que proporciona el acceso privado de Sites para las rutas de IA.

```text
src/assistant/           Herramientas, cambios, proyecciones y tarjetas
src/domain/              Entrenamiento, comidas, tipos y ejemplos
src/data/                Persistencia, respaldos y estado compartido
src/screens/             Conversación y vistas de gestión
server/                  Agente, proveedor Groq/Ollama y servidor local
worker/                  Servidor alojado con acceso privado
scripts/                 Build y prueba de IA real
tests/                   Pruebas de dominio e integración de herramientas
```
