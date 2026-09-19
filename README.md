# Emet · Contenido en minutos con IA

Landing clara en blanco, fucsia, violeta y azul. Taller en vivo por Zoom, 1 de octubre de 2026, US$19, pago único. Incluye temario, ejemplos, beneficios, preguntas, checkout y página de confirmación.

## Estado de entrega

- Diseño y navegación implementados, con fotos ilustrativas generadas con IA.
- Stripe Embedded Checkout implementado con sesión creada en servidor. **Faltan credenciales y una compra de prueba real para activarlo y validarlo con tu cuenta.** Sin credenciales, la página informa que las inscripciones online no están habilitadas y ofrece contacto; nunca simula un pago.
- Meta Pixel configurable: PageView, ViewContent, InitiateCheckout y Purchase. Purchase solo se envía cuando el servidor confirma `payment_status=paid`, el curso correcto, USD y 1900 centavos.
- Conversions API opcional vía webhook firmado de Stripe; usa el mismo `event_id` que el Pixel para deduplicación. Stripe reintenta si Meta falla. El consentimiento y los bloqueadores pueden limitar la medición; no se promete atribución del 100%.
- Vercel preparado, **aún no desplegado allí**. La publicación actual sigue en Sites.
- Testimonios y marcas están preparados en `public/proof.json` y ocultos hasta recibir contenido auténtico aprobado. No hay reseñas, nombres, resultados ni clientes inventados.
- El horario y la duración de las asesorías incluidas deben confirmarse por el organizador. El acceso a aula y WhatsApp se coordina manualmente después del pago; este proyecto no automatiza altas ni correos.

## Desplegar en Vercel

1. Sube este proyecto a un repositorio de tu cuenta GitHub e impórtalo en Vercel.
2. Usa el directorio raíz, framework **Other**, Node.js 22 o superior. `vercel.json` define build (`npm run build`), salida (`public`) y las rutas `/checkout` y `/gracias`. Las funciones están en `api/[...path].js`.
3. Configura las variables siguientes en **Settings → Environment Variables**. Copia los nombres de `.env.example`; no subas claves al repositorio ni las escribas en HTML/JavaScript público.
4. Despliega. Establece `SITE_URL` en el origen HTTPS exacto definitivo (sin rutas), por ejemplo `https://tu-dominio.com`. Las sesiones y el control de origen se limitan a ese dominio. Los previews de Vercel necesitan su propia configuración si se quieren probar pagos allí.
5. Configura Stripe y Meta como se indica abajo y prueba antes de vender.

El proyecto no requiere dependencias de npm externas. La compilación produce también un Worker para Sites con los mismos archivos y lógica; eso no cambia la salida de Vercel.

## Variables

| Variable | Uso |
|---|---|
| `SITE_URL` | Origen HTTPS definitivo. Obligatorio para habilitar checkout. |
| `EVENT_DATE` | Fecha visible del taller, por ejemplo `Jueves 1 de octubre de 2026`. |
| `EVENT_TIME` | Hora visible del taller, por ejemplo `8:00 p. m. (hora Perú)`. |
| `COURSE_PRICE_USD` | Precio entero en dólares; el servidor lo aplica al Checkout. |
| `WHATSAPP_GROUP_URL` | Enlace del grupo mostrado después de un pago confirmado. |
| `STRIPE_SECRET_KEY` | Clave secreta, únicamente en servidor. |
| `STRIPE_PUBLISHABLE_KEY` | Clave publicable del mismo modo test/live que la secreta. |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del endpoint webhook específico de ese despliegue. |
| `META_PIXEL_ID` | ID numérico del píxel/dataset. |
| `META_ACCESS_TOKEN` | Token privado para Conversions API, solo si se activa CAPI. |
| `META_GRAPH_VERSION` | Versión de Graph API admitida por tu app Meta (formato `vNN.N`). Necesaria con CAPI. |
| `META_TEST_EVENT_CODE` | Opcional, código de Test Events. Retirar para campañas reales. |

No es necesario crear un Price ID: el servidor fija nombre, cantidad 1 y precio US$19 en `server/commerce.mjs`. El navegador no puede modificar el precio. API Stripe fijada a `2026-08-26.dahlia`; el cliente carga Stripe.js directamente de `https://js.stripe.com/dahlia/stripe.js` y monta `createEmbeddedCheckoutPage`.

## Activación Stripe

1. Configura claves **de prueba** del mismo proyecto Stripe.
2. Crea un destino webhook en Stripe: `https://TU-DOMINIO/api/stripe-webhook`. Selecciona `checkout.session.completed` y `checkout.session.async_payment_succeeded`; usa la misma versión API. Guarda su secreto en `STRIPE_WEBHOOK_SECRET`.
3. Prueba pago aprobado (tarjeta de prueba 4242 4242 4242 4242), rechazo y autenticación 3DS desde el checkout. Verifica el pago en Stripe y el estado en `/gracias`. No uses una tarjeta real en modo test.
4. Verifica que cancelar o recargar una página sin pago no genere Purchase. La visita a `/gracias` por sí sola no basta.
5. Cuando todo esté aprobado, cambia a las claves live y al secreto del webhook live. Configura en Stripe el nombre comercial, recibos y políticas aplicables a tu venta. El checkout recoge el email del comprador, pero el acceso al curso se coordina manualmente.

## Activación Meta

Configura `META_PIXEL_ID`. Con consentimiento se activa el Pixel. Para recuperar conversiones cuando no se visita la página de confirmación, añade token y versión de Graph API y activa el webhook anterior.

El evento de compra lleva `event_id=purchase_<stripe_session_id>` tanto en navegador como en servidor. Los reintentos usan el mismo ID y Meta deduplica. El correo se normaliza y transforma con SHA-256 en el servidor; no se expone a la página de confirmación. Se envían fbp/fbc y UTMs únicamente con consentimiento. La negativa no impide comprar. Las compras Stripe en modo test no se envían como compras reales; CAPI de prueba requiere `META_TEST_EVENT_CODE`.

En Meta Events Manager, verifica Test Events, deduplicación y diagnósticos antes de activar campañas. La API de Meta no se ha podido validar con credenciales reales en esta entrega; configura una versión vigente de Graph API y verifica aceptación del evento en tu cuenta.

## Contenido auténtico: testimonios y marcas

`public/proof.json` empieza vacío. Su estructura es:

```json
{
  "brands": [
    {"name":"Nombre confirmado", "logo":"/assets/logo-autorizado.svg", "source":"URL de referencia pública o confirmación autorizada", "approved":true}
  ],
  "testimonials": [
    {"name":"Nombre real", "role":"Cargo autorizado", "quote":"Testimonio literal autorizado", "photo":"/assets/foto-autorizada.webp", "source":"URL de referencia pública o confirmación autorizada", "approved":true}
  ]
}
```

No publiques documentos privados como fuentes: este JSON es público. `logo`, `photo` y `role` son opcionales. Usa exclusivamente opiniones recibidas y marcas que realmente asesoraste. Las fotos ilustrativas de la landing no representan alumnos ni al instructor. Se pueden reemplazar por fotos tuyas y de talleres con autorización.

## Comprobaciones locales

`npm test` comprueba precio fijo, origen, firmas, estado de pago, privacidad, consentimiento, deduplicación por ID y reintentos. Son pruebas con respuestas simuladas, sin cobrar dinero ni llamar a Stripe/Meta.

`npm run build` comprueba archivos y prueba social aprobada, y genera el Worker. No sustituye una prueba de compra con Stripe, la validación de Events Manager ni una publicación real en Vercel.

## Referencias de implementación

- [Stripe Embedded Checkout](https://docs.stripe.com/checkout/embedded/quickstart)
- [Firma de webhooks Stripe](https://docs.stripe.com/webhooks/signature)
- [Versiones Stripe](https://docs.stripe.com/api/versioning)
- [Vercel Functions](https://vercel.com/docs/functions/quickstart)
- [Meta: deduplicación Pixel y Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/)
