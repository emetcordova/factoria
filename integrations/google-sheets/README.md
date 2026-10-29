# Contactos de Factoría en Google Sheets

Esta integración guarda nombre y celular cuando ambos son válidos y pasan 700 ms sin cambios. También intenta guardar al salir del campo, cerrar el popup, ocultar la página o iniciar WhatsApp. No depende de enviar el mensaje. No captura campos incompletos.

Cada formulario tiene un ID aleatorio de sesión y una revisión creciente. La hoja actualiza una fila por ID, conserva fecha y hora de la primera recepción y registra la última actualización. Las revisiones antiguas no sobrescriben las recientes; un bloqueo de Apps Script serializa las escrituras. El indicador de WhatsApp solo informa que se pulsó el botón, no que se envió un mensaje.

## Estado y activación

El código por sí solo **no activa** la captura. `/api/leads` devuelve `enabled:false` hasta configurar el webhook y su secreto en el proyecto Vercel existente. La web no envía datos cuando esa configuración falta.

1. Crear una hoja privada llamada **Contactos Factoría** en la cuenta Google del organizador. La pestaña `Contactos` y las columnas se crean automáticamente en la primera escritura. Mantener el acceso privado.
2. En Extensiones → Apps Script, añadir `Code.gs` y el manifiesto de esta carpeta.
3. En Propiedades del script, configurar `SPREADSHEET_ID` con el ID de esa hoja y `LEADS_WEBHOOK_SECRET` con un secreto aleatorio de al menos 32 caracteres. Generarlo de forma privada; no guardarlo en Git ni enviarlo en mensajes.
4. Desplegar como aplicación web ejecutada por el propietario y accesible para recibir peticiones. El endpoint no permite leer contactos y exige el secreto para escribir. Completar la autorización de Google desde la cuenta propietaria.
5. Configurar en **production** del proyecto **factoria** de Vercel `LEADS_WEBHOOK_URL` con la URL `/exec` del despliegue y `LEADS_WEBHOOK_SECRET` como variable secreta con el mismo valor. No usar variables públicas ni copiar el secreto al navegador.
6. Publicar el commit en Vercel. Comprobar que `/api/leads` responda `enabled:true` sin exponer credenciales.
7. Escribir datos de prueba identificados en el popup, esperar el autoguardado y confirmar una fila con fecha y hora de Perú sin pulsar WhatsApp. Editar el nombre y verificar que siga siendo una fila. Eliminar manualmente ese registro de prueba al finalizar.

Las columnas son: ID, Nombre, Celular, Fecha (Perú), Hora (Perú), Última actualización (Perú), Clic en WhatsApp, Revisión. La zona horaria es `America/Lima`. El primer registro se fecha en el servidor de Google, no con el reloj del visitante. El identificador/revisión del cliente solo ordena actualizaciones.

No se guardan datos personales en el almacenamiento del navegador. Si la red falla se reintenta mientras la página permanece abierta; la entrega no se garantiza sin conexión ni cuando el navegador termina antes de completar la petición. No se usa almacenamiento temporal de la función Vercel como base de datos.

## Comprobaciones

`npm test` incluye el guardado sin clic, campos incompletos, actualizaciones sin duplicados, salida de página, rechazo de orígenes ajenos, configuración ausente, fallos del proveedor y escritura idempotente en Sheets. Las pruebas usan respuestas simuladas; la comprobación real de la hoja requiere completar la activación anterior.

Referencias oficiales: [Apps Script como aplicación web](https://developers.google.com/apps-script/guides/web), [bloqueos](https://developers.google.com/apps-script/reference/lock), [SpreadsheetApp](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app).
