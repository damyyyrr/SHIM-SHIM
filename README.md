# SHIM-SHIM

Prototipo funcional de una app de gimnasio para Android, iOS y web, hecho con React Native, Expo y TypeScript. La dirección visual inicial es **Compañero**: verdes suaves, tipografía redondeada y Mimo, una mascota que acompaña el progreso.

## Ejecutar

Requiere Node.js 22 o superior y npm.

```powershell
npm ci
npm run web
```

La vista web permite probar el prototipo en la computadora. Para iniciar el servidor de desarrollo móvil:

```powershell
npm start
```

En Android, se puede abrir desde una versión de Expo Go compatible con el SDK 58 o una compilación propia. El celular y la computadora deben poder comunicarse por red. En iPhone, la distribución de una compilación propia requiere la firma de Apple; TestFlight requiere una cuenta del Apple Developer Program. No hay un APK ni un IPA generado en este repositorio.

`eas.json` incluye un perfil `preview` para generar un APK Android de prueba. Antes de ejecutarlo hay que configurar la cuenta/proyecto de Expo y las credenciales de firma:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

No se crearon cuentas ni se solicitaron compilaciones pagas como parte del prototipo.

## Qué se puede probar

- Cambiar entre perfiles locales, editar nombres y elegir entre seis metas: músculo, pérdida de grasa, fuerza, mantenimiento, recomposición y bienestar.
- Crear, editar, ordenar ejercicios y eliminar rutinas. Configurar series, rango de repeticiones, carga, incremento, descanso, reserva objetivo y notas.
- Iniciar una sesión, editar cargas/repeticiones, registrar RIR, marcar series, usar un temporizador de descanso y retomar la sesión tras cerrar o recargar.
- Guardar entrenamientos completos o parciales y ver el resumen con las propuestas para la próxima sesión.
- Explorar el historial y un gráfico de carga máxima por ejercicio. Los ejemplos están identificados y se pueden quitar desde el perfil.
- Registrar comidas por fecha, elegir porciones o cargar los valores de una receta/etiqueta. Editar las referencias diarias de energía y macronutrientes.
- Conversar con Mimo mediante respuestas guiadas basadas en el perfil actual y sumar experiencia por sesiones propias.
- Exportar todos los perfiles como JSON y restaurarlos pegando un respaldo validado. Restaurar pide confirmación antes de reemplazar los datos.

## Datos y límites actuales

Los datos se guardan **localmente**: SQLite en Android/iOS y `localStorage` en web. Los perfiles separan sus registros dentro de la app, pero **no tienen autenticación ni aislamiento de seguridad**. No se sincronizan entre dispositivos. No borrar los datos del navegador ni desinstalar la app sin exportar un respaldo si se quiere conservar el historial.

Las rutinas y sesiones iniciales son ejemplos editables. Los objetivos nutricionales empiezan sin definir. Las comidas del catálogo tienen valores ilustrativos por porción: el prototipo no calcula necesidades energéticas, no prescribe dietas y no ajusta cantidades según la meta. El registro y los objetivos manuales sí funcionan.

Mimo **no está conectado a una IA generativa**. La conversación es local y está rotulada como respuestas guiadas. El personaje se dibuja con componentes nativos y tiene una animación breve que respeta la preferencia de movimiento reducido.

La app funciona como prototipo web y comparte código nativo para Android/iOS. La exportación de bundles no sustituye las pruebas en dispositivos físicos ni la compilación/instalación de APK/IPA.

## Progresión

El motor usa progresión doble por ejercicio y no modifica las rutinas automáticamente:

1. Sin historial, propone la carga inicial y el mínimo del rango.
2. Con todas las series al máximo del rango, técnica cómoda y RIR igual o mayor al objetivo en cada serie, propone sumar el incremento configurado y volver al mínimo de repeticiones.
3. Dentro del rango, con técnica y esfuerzo registrados, propone como máximo una repetición adicional en una serie.
4. Una sesión incompleta, esfuerzo sin registrar o insuficiente, problemas de técnica o cargas mezcladas impiden una subida automática. Las series no completadas no suman volumen.

Cada sugerencia explica el motivo y las cargas se pueden editar antes de registrar. Las sesiones guardan una copia del ejercicio para que cambiar la rutina no reescriba el historial.

## Comprobaciones

```powershell
npm run typecheck
npm test
npm run export:web
npx expo export --platform all --output-dir build-check --max-workers 2
```

Las pruebas cubren condiciones de progresión, sesiones parciales, RIR ausente, técnica, cargas mixtas, separación de perfiles, cálculo de porciones, fechas locales y validación de respaldos.

La instalación inicial con Expo SDK 58 reporta tres avisos moderados de `npm audit` en la cadena de herramientas `expo → @expo/fingerprint → minimatch`. La corrección automática sugerida por npm retrocede a otro SDK, por lo que no se aplicó `audit fix --force`. Revisar la actualización compatible de Expo antes de distribuir una versión final.

## Organización

```text
App.tsx                  Entrada, navegación y adaptación móvil/escritorio
src/domain/              Tipos, progresiones, comidas y respuestas de Mimo
src/data/                Estado, persistencia por plataforma y respaldos
src/ui/                  Componentes, mascota y tokens visuales
src/screens/             Inicio, rutinas, sesión, comidas, progreso y perfil
tests/                   Pruebas del dominio y los datos
```

Próximos pasos: ajustar el prototipo con uso real, probar en Android/iPhone, agregar cuentas y sincronización, y conectar una IA mediante un servidor que proteja la clave del proveedor.
