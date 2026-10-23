# Emet · Contenido en minutos con IA

Landing de venta para el taller en vivo por Zoom de Emet Córdova.

## Oferta vigente

- Fecha: miércoles 28 de octubre de 2026.
- Horario: 7:00 p. m. a 10:00 p. m. (hora de Perú).
- Precio base: S/ 50 (PEN).
- Adicional opcional: grabación + soporte + certificado por S/ 19.
- Total con adicional: S/ 69.
- Configuración central: `public/site-settings.json`.

## Checkout y medición

El sitio usa Stripe Embedded Checkout con sesiones creadas en servidor. El navegador no define el importe: el servidor crea un ítem de S/ 50 y, cuando corresponde, un segundo ítem de S/ 19. La selección del adicional queda identificada como segundo line item y mediante `metadata.order_bump`.

El checkout conserva la atribución disponible (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbp` y `fbc`). La página de confirmación consulta la sesión directamente a Stripe y usa `amount_total` para reportar el monto real cobrado.

Medición configurada:

- Meta Pixel: `PageView`, `ViewContent`, `InitiateCheckout`, `Purchase`.
- Meta Conversions API: `Purchase`, con el mismo `event_id` determinístico del navegador para deduplicación.
- Google Analytics 4: `view_item`, `begin_checkout`, `purchase`.
- TikTok Pixel: `ViewContent`, `InitiateCheckout`, `CompletePayment`.

Los eventos con valor usan PEN. `InitiateCheckout` refleja S/ 50 o S/ 69 según la selección y `Purchase` usa el monto confirmado por Stripe.

## Avisos de inscripción

Los avisos de inscripción provienen únicamente de compras reales y pagadas de Stripe. La API prioriza compras asociadas a la fecha actual del taller y, si no existen, utiliza la fecha anterior disponible. Si no hay registros elegibles, no muestra avisos.

La respuesta pública expone únicamente nombre de pila y provincia/departamento. No devuelve correo, apellido, monto, referencia de pago ni ID de Stripe.

El checkout solicita el campo personalizado `Ciudad / provincia` y los términos informan que el nombre de pila y la provincia o departamento pueden mostrarse como aviso de inscripción conforme a la Ley N.° 29733 de Protección de Datos Personales del Perú.

## Contenido auténtico

`public/proof.json` contiene exactamente seis testimonios aprobados. No se generan testimonios ni compradores aleatorios desde el frontend.

La galería se alimenta desde `public/gallery.json`; los recursos deben tener `approved:true` para mostrarse como contenido aprobado.

## Archivos principales

- `public/index.html`: landing.
- `public/app.js`: configuración de interfaz, atribución y píxeles.
- `public/checkout.html` / `public/checkout.js`: selector del adicional y Stripe Embedded Checkout.
- `public/gracias.html` / `public/gracias.js`: confirmación y `Purchase` del navegador.
- `server/commerce.mjs`: sesiones Stripe, validación de pagos, CAPI, webhook y avisos de compras reales.
- `public/site-settings.json`: fecha, horario y precios vigentes.
- `public/proof.json`: seis testimonios aprobados.
- `public/assets/hero-workshop.mp4`: video vertical optimizado del hero.
- `public/assets/emet-workshop.jpg`: fotografía de Emet.

## Variables privadas

Configura en Vercel las claves privadas y los identificadores de medición documentados en `.env.example`. Nunca incluyas secretos en archivos públicos.

Las variables de fecha y precio antiguas se ignoran deliberadamente en la función de Vercel: `public/site-settings.json` es la única fuente de verdad para la oferta visible y los importes del checkout.

## Pruebas

`npm test` cubre:

- configuración PEN;
- checkout base S/ 50;
- checkout con adicional S/ 69;
- origen permitido;
- validación del monto real de Stripe;
- Meta CAPI con monto real y deduplicación;
- firma de webhook;
- avisos de inscripción reales de la fecha actual y fallback a la fecha anterior;
- ausencia de compradores inventados cuando no hay resultados.

`npm run build` valida los archivos públicos y exige exactamente seis testimonios aprobados.

El workflow `.github/workflows/checkout-smoke.yml` se ejecuta al hacer push a `main`. Además de pruebas y build, valida `https://factoria-two.vercel.app/api/config` y crea sesiones Stripe live no pagadas para los caminos S/ 50 y S/ 69. No genera cargos.

## Despliegue

Vercel está conectado a la rama `main` del repositorio. Cada push despliega automáticamente la versión de producción. `vercel.json` mantiene el build existente (`npm run build`), la salida `public` y los rewrites de `/checkout` y `/gracias`.
