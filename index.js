// Variables globales
let videoElement, resultElement, flashButton, zoomInButton, zoomOutButton, zoomIndicator;
let eventNameInput, eventDateInput, startScanButton;
let isFlashOn = false;
let currentZoom = 1.0;
let minZoom = 1.0;
let maxZoom = 3.0;
let currentVideoTrack = null;
let currentEventName = null;
let currentEventDate = null;
let scanningStarted = false;
let cachedHasBarcodeDetector = false;
let cachedIsIOS = false;
const sonidoAlarma = new Audio('store-scanner-beep-90395.mp3'); // Asegúrate de que la ruta sea correcta

// Enviar código al backend
async function sendBarcodeToServer(code, format) {
  try {
    const payload = {
      code: code,
      format: format,
      evento: currentEventName,
      fecha: currentEventDate,
      userAgent: navigator.userAgent
    };

    const res = await fetch('http://localhost:8080/api/barcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 400) {
      // Validation errors returned as a map { field: message }
      const errJson = await res.json().catch(() => null);
      console.warn('Validation error from backend', errJson);

      let msg = '<strong>Errores del servidor:</strong><br>';
      if (errJson && typeof errJson === 'object') {
        for (const [field, message] of Object.entries(errJson)) {
          msg += `${field}: ${message}<br>`;
        }
      } else if (errJson) {
        msg += JSON.stringify(errJson);
      } else {
        msg += 'Error de validación (formato inesperado)';
      }

      if (resultElement) resultElement.innerHTML = msg;
      return;
    } else if (!res.ok) {
      console.error('Error enviando al backend', res.status);
      if (resultElement) resultElement.textContent = `Error al enviar al servidor: ${res.status}`;
      return;
    } else {
      const data = await res.json();
      console.log('Guardado en backend:', data);
      if (resultElement) resultElement.innerHTML = `<strong>Guardado:</strong> ${data.code} (id: ${data.id || '—'})`;
    }
  } catch (err) {
    console.error('Error de conexión al backend:', err);
  }
}


// Asegurar que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM completamente cargado, iniciando aplicación...');
  initBarcodeScanner();
});

function initBarcodeScanner() {
  // Obtener elementos DOM
  videoElement = document.getElementById('scanner-video');
  resultElement = document.getElementById('barcode-result');
  flashButton = document.getElementById('flash-button');
  zoomInButton = document.getElementById('zoom-in');
  zoomOutButton = document.getElementById('zoom-out');
  zoomIndicator = document.getElementById('zoom-indicator');
  // Nuevos inputs para evento y fecha
  eventNameInput = document.getElementById('event-name');
  eventDateInput = document.getElementById('event-date');
  startScanButton = document.getElementById('start-scan');

  if (startScanButton) {
    startScanButton.addEventListener('click', startScan);
  }

  // Paso 1: Comprobar la compatibilidad y crear una instancia del detector
  console.log('Verificando compatibilidad de BarcodeDetector...');
  console.log('Navigator userAgent:', navigator.userAgent);
  console.log('BarcodeDetector disponible:', 'BarcodeDetector' in window);

  // Actualizar información de compatibilidad en el DOM
  const browserInfo = document.getElementById('browser-info');
  const apiInfo = document.getElementById('api-info');

  // Debug: verificar que los elementos existen
  console.log('browserInfo element:', browserInfo);
  console.log('apiInfo element:', apiInfo);

  // Detectar navegador y plataforma
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

  let browserName = 'Desconocido';
  if (isChrome) browserName = 'Chrome';
  else if (isSafari) browserName = 'Safari';
  else if (/Firefox/.test(userAgent)) browserName = 'Firefox';
  else if (/Edge/.test(userAgent)) browserName = 'Edge';

  let platform = 'Desconocido';
  if (isIOS) platform = 'iOS';
  else if (isAndroid) platform = 'Android';
  else if (/Mac/.test(userAgent)) platform = 'macOS';
  else if (/Windows/.test(userAgent)) platform = 'Windows';

  // Actualizar información del navegador
  console.log(`Detectado: ${browserName} en ${platform}`);
  if (browserInfo) {
    browserInfo.textContent = `${browserName} en ${platform}`;
    console.log('Browser info actualizado correctamente');
  } else {
    console.error('Elemento browser-info no encontrado');
  }

  // Verificar compatibilidad de BarcodeDetector
  const hasBarcodeDetector = 'BarcodeDetector' in window;
  console.log(`BarcodeDetector disponible: ${hasBarcodeDetector}`);
  console.log(`Es iOS: ${isIOS}`);

  if (apiInfo) {
    if (hasBarcodeDetector) {
      apiInfo.innerHTML = '✅ <strong>BarcodeDetector nativo</strong> - Rendimiento óptimo';
      apiInfo.style.color = '#4CAF50';
      console.log('API info actualizado: BarcodeDetector nativo');
    } else {
      apiInfo.innerHTML = '⚠️ <strong>Fallback QuaggaJS</strong> - Compatibilidad extendida';
      apiInfo.style.color = '#FF9800';

      // Explicar por qué no está disponible
      if (isIOS) {
        apiInfo.innerHTML += '<br><small>Nota: iOS no soporta BarcodeDetector nativamente</small>';
      }
      console.log('API info actualizado: QuaggaJS fallback');
    }
  } else {
    console.error('Elemento api-info no encontrado');
  }
  // No iniciar el scanner automáticamente. Guardar compatibilidad para cuando el usuario pulse "Iniciar Escaneo"
  cachedHasBarcodeDetector = hasBarcodeDetector;
  cachedIsIOS = isIOS;

  // Pedir al usuario que complete los datos del evento antes de iniciar
  if (resultElement) {
    resultElement.textContent = 'Complete Evento y Fecha, luego presione "Iniciar Escaneo".';
  }
}

// Inicia el escaneo después de validar inputs
async function startScan() {
  if (scanningStarted) return;

  const eventName = eventNameInput ? eventNameInput.value.trim() : '';
  const eventDate = eventDateInput ? eventDateInput.value : '';

  if (!eventName) {
    resultElement.textContent = 'Por favor ingrese el nombre del evento antes de iniciar.';
    if (eventNameInput) eventNameInput.focus();
    return;
  }

  if (!eventDate) {
    resultElement.textContent = 'Por favor seleccione la fecha del evento antes de iniciar.';
    if (eventDateInput) eventDateInput.focus();
    return;
  }

  // Guardar datos del evento
  // Antes de iniciar, registrar el evento en el backend
  try {
    const evRes = await fetch('http://localhost:8080/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: eventName, fecha: eventDate })
    });

    if (!evRes.ok) {
      const err = await evRes.json().catch(() => null);
      let msg = 'No se pudo registrar el evento.';
      if (err && typeof err === 'object') {
        msg += ' ' + Object.entries(err).map(([k,v]) => `${k}: ${v}`).join(' ');
      }
      resultElement.textContent = msg;
      return;
    }

    // Registrar localmente y arrancar scanner
    currentEventName = eventName;
    currentEventDate = eventDate;
    scanningStarted = true;

    // Actualizar UI
    if (eventNameInput) eventNameInput.disabled = true;
    if (eventDateInput) eventDateInput.disabled = true;
    if (startScanButton) {
      startScanButton.disabled = true;
      startScanButton.textContent = 'Escaneando...';
    }

    resultElement.textContent = `Evento: ${currentEventName} • Fecha: ${currentEventDate} — Iniciando cámara...`;

    // Iniciar scanner según compatibilidad guardada
    if (cachedHasBarcodeDetector) {
      initNativeBarcodeDetector();
    } else {
      resultElement.textContent = 'BarcodeDetector no disponible, cargando fallback...';
      if (cachedIsIOS) {
        loadQuaggaJSWithFastFallback();
      } else {
        loadQuaggaJS();
      }
    }
  } catch (err) {
    console.error('Error registrando evento:', err);
    resultElement.textContent = 'Error conectando al servidor para registrar evento.';
  }
}

function initNativeBarcodeDetector() {
  console.log('Usando BarcodeDetector nativo - Solo EAN-13');
  const barcodeDetector = new BarcodeDetector({
    formats: [
      'ean_13'         // Códigos de productos (13 dígitos)
    ]
  });

  // Paso 2: Obtener acceso a la cámara
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoElement.srcObject = stream;

      // Verificar capacidades de la cámara
      currentVideoTrack = stream.getVideoTracks()[0];
      const capabilities = currentVideoTrack.getCapabilities();

      console.log('Capacidades de la cámara:', capabilities);

      // Configurar flash
      if (capabilities.torch || 'torch' in capabilities) {
        flashButton.style.display = 'block';
        flashButton.addEventListener('click', toggleFlash);
        console.log('Flash disponible');
      } else {
        console.log('Flash no disponible en este dispositivo');
        flashButton.style.display = 'none';
      }

      // Configurar zoom
      if (capabilities.zoom) {
        minZoom = capabilities.zoom.min || 1.0;
        maxZoom = capabilities.zoom.max || 3.0;
        currentZoom = capabilities.zoom.min || 1.0;

        zoomInButton.style.display = 'block';
        zoomOutButton.style.display = 'block';
        zoomIndicator.style.display = 'block';

        zoomInButton.addEventListener('click', zoomIn);
        zoomOutButton.addEventListener('click', zoomOut);

        updateZoomIndicator();
        console.log(`Zoom disponible: ${minZoom}x - ${maxZoom}x`);
      } else {
        console.log('Zoom no disponible en este dispositivo');
      }

      videoElement.addEventListener('loadeddata', () => {
        startDetection(barcodeDetector);
      });
    })
    .catch(err => {
      console.error('Error al acceder a la cámara:', err);
      resultElement.textContent = 'Error al acceder a la cámara. Asegúrate de estar en un contexto seguro (HTTPS).';
    });
}

// Función para alternar el flash
async function toggleFlash() {
  try {
    const videoTrack = videoElement.srcObject.getVideoTracks()[0];
    console.log('Intentando alternar flash. Estado actual:', isFlashOn);

    // Método 1: Usando constraints básicos
    try {
      await videoTrack.applyConstraints({
        torch: !isFlashOn
      });
      console.log('Método 1 exitoso');
    } catch (error1) {
      console.log('Método 1 falló, probando método 2:', error1);

      // Método 2: Usando constraints avanzados
      try {
        await videoTrack.applyConstraints({
          advanced: [{
            torch: !isFlashOn
          }]
        });
        console.log('Método 2 exitoso');
      } catch (error2) {
        console.log('Método 2 falló, probando método 3:', error2);

        // Método 3: Recrear el stream con torch
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            torch: !isFlashOn
          }
        });

        videoElement.srcObject = newStream;
        console.log('Método 3 exitoso');
      }
    }

    isFlashOn = !isFlashOn;
    flashButton.textContent = isFlashOn ? '🔦 Apagar Flash' : '🔦 Encender Flash';
    flashButton.style.backgroundColor = isFlashOn ? '#ff6b6b' : '#4ecdc4';

  } catch (err) {
    console.error('Error al alternar flash:', err);
    resultElement.textContent = `Error con el flash: ${err.message}`;
  }
}

// Funciones para controlar el zoom
async function zoomIn() {
  try {
    const newZoom = Math.min(currentZoom + 0.2, maxZoom);
    await applyZoom(newZoom);
  } catch (err) {
    console.error('Error al hacer zoom in:', err);
  }
}

async function zoomOut() {
  try {
    const newZoom = Math.max(currentZoom - 0.2, minZoom);
    await applyZoom(newZoom);
  } catch (err) {
    console.error('Error al hacer zoom out:', err);
  }
}

async function applyZoom(zoomLevel) {
  try {
    await currentVideoTrack.applyConstraints({
      advanced: [{
        zoom: zoomLevel
      }]
    });
    currentZoom = zoomLevel;
    updateZoomIndicator();
    console.log(`Zoom aplicado: ${zoomLevel.toFixed(1)}x`);
  } catch (err) {
    console.error('Error al aplicar zoom:', err);
  }
}

function updateZoomIndicator() {
  zoomIndicator.textContent = `Zoom: ${currentZoom.toFixed(1)}x`;

  // Actualizar estado de los botones
  zoomOutButton.disabled = currentZoom <= minZoom;
  zoomInButton.disabled = currentZoom >= maxZoom;

  // Cambiar opacidad para indicar si están disponibles
  zoomOutButton.style.opacity = currentZoom <= minZoom ? '0.5' : '1';
  zoomInButton.style.opacity = currentZoom >= maxZoom ? '0.5' : '1';
}

// Función para el bucle de detección con BarcodeDetector nativo
function startDetection(barcodeDetector) {
  const intervalId = setInterval(async () => {
    try {
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const barcodes = await barcodeDetector.detect(videoElement);
        if (barcodes.length > 0) {
          const detectedBarcode = barcodes[0];
          let displayValue = detectedBarcode.rawValue;

          // Procesar código EAN-13
          const format = detectedBarcode.format;

          if (format === 'ean_13' && detectedBarcode.rawValue.length >= 9) {
            // Para EAN-13, mostrar solo los primeros 9 dígitos
            displayValue = detectedBarcode.rawValue.substring(0, 9);
          }

          // Mostrar formato y valor - Solo EAN-13
          resultElement.innerHTML = `<strong>EAN-13:</strong> ${displayValue}`;
          console.log(`Código detectado - Formato: ${format}, Valor: ${detectedBarcode.rawValue}`);
          sonidoAlarma.play();
                  // Enviar al backend si está configurado el evento
                  if (scanningStarted && currentEventName && currentEventDate) {
                    sendBarcodeToServer(displayValue, 'EAN-13');
                  }
        }
      }
    } catch (err) {
      console.error('Error durante la detección:', err);
      resultElement.textContent = 'Error durante la detección';
    }
  }, 1000);
}

// Función de fallback rápido específica para iOS
function loadQuaggaJSWithFastFallback() {
  console.log('Intentando QuaggaJS para iOS con fallback rápido...');

  // Timeout muy corto para iOS
  const fastTimeout = setTimeout(() => {
    console.log('Fallback rápido activado - iniciando modo manual iOS');
    initManualModeForIOS();
  }, 3000); // Solo 3 segundos

  // Actualizar API info
  const apiInfo = document.getElementById('api-info');
  if (apiInfo) {
    apiInfo.innerHTML = '⏳ Probando QuaggaJS (fallback rápido)...';
    apiInfo.style.color = '#2196F3';
  }

  // Cargar QuaggaJS
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
  script.onload = () => {
    clearTimeout(fastTimeout);
    console.log('QuaggaJS cargado - intentando inicializar');
    if (apiInfo) {
      apiInfo.innerHTML = '⏳ QuaggaJS cargado - inicializando...';
    }
    initQuaggaScanner();
  };
  script.onerror = () => {
    clearTimeout(fastTimeout);
    console.log('Error cargando QuaggaJS - activando modo manual');
    initManualModeForIOS();
  };
  document.head.appendChild(script);
}

// Modo manual para iOS cuando QuaggaJS no funciona
function initManualModeForIOS() {
  console.log('Inicializando modo manual para iOS');

  // Configurar cámara básica
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  })
  .then(stream => {
    videoElement.srcObject = stream;

    // Verificar flash
    const videoTrack = stream.getVideoTracks()[0];
    const capabilities = videoTrack.getCapabilities();

    if (capabilities.torch || 'torch' in capabilities) {
      flashButton.style.display = 'block';
      currentVideoTrack = videoTrack;
      flashButton.addEventListener('click', toggleFlash);
    } else {
      flashButton.style.display = 'none';
    }

    // Ocultar zoom
    zoomInButton.style.display = 'none';
    zoomOutButton.style.display = 'none';
    zoomIndicator.style.display = 'none';

    // Configurar UI para modo manual
    resultElement.innerHTML = `
      📱 <strong>Modo Manual iOS:</strong><br>
      ✅ Cámara activa<br>
      👆 Toque la pantalla para "simular" detección<br>
      💡 Use el flash si es necesario
    `;

    // Agregar interacción
    let tapCount = 0;
    videoElement.addEventListener('click', function() {
      tapCount++;
      resultElement.innerHTML = `
        👆 <strong>Tap #${tapCount}:</strong><br>
        📷 Enfoque bien el código de barras<br>
        🔍 En un scanner real, aquí aparecería el resultado
      `;
    });

    const apiInfo = document.getElementById('api-info');
    if (apiInfo) {
      apiInfo.innerHTML = '📱 <strong>Modo Manual iOS</strong> - Cámara funcional';
      apiInfo.style.color = '#4CAF50';
    }
  })
  .catch(err => {
    console.error('Error accediendo a cámara en modo manual:', err);
    resultElement.textContent = 'Error: No se pudo acceder a la cámara';
  });
}

// Función de fallback para dispositivos que no soportan BarcodeDetector
function loadQuaggaJS() {
  console.log('Cargando QuaggaJS desde CDN...');

  // Actualizar API info mientras se carga
  const apiInfo = document.getElementById('api-info');
  if (apiInfo) {
    apiInfo.innerHTML = '⏳ Cargando scanner alternativo...';
    apiInfo.style.color = '#2196F3';
  }

  // Cargar la librería QuaggaJS dinámicamente
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
  script.onload = () => {
    console.log('QuaggaJS cargado exitosamente');
    if (apiInfo) {
      apiInfo.innerHTML = '✅ <strong>QuaggaJS cargado</strong> - Scanner alternativo activo';
      apiInfo.style.color = '#4CAF50';
    }
    initQuaggaScanner();
  };
  script.onerror = () => {
    const errorMsg = 'Error: No se pudo cargar el scanner alternativo. Verifique su conexión a internet.';
    resultElement.textContent = errorMsg;
    if (apiInfo) {
      apiInfo.innerHTML = '❌ <strong>Error de carga</strong> - Scanner no disponible';
      apiInfo.style.color = '#F44336';
    }
    console.error('Error cargando QuaggaJS desde CDN');
  };
  document.head.appendChild(script);
}

function initQuaggaScanner() {
  console.log('Inicializando QuaggaJS scanner');
  resultElement.textContent = 'Configurando cámara...';

  // Configuración optimizada para diferentes dispositivos
  const videoConstraints = {
    facingMode: 'environment',
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 }
  };

  // Optimizaciones específicas para iOS
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  if (isIOS) {
    console.log('Aplicando optimizaciones para iOS');
    videoConstraints.width = { ideal: 640 };
    videoConstraints.height = { ideal: 480 };
  }

  // Inicializar cámara para QuaggaJS
  navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    .then(stream => {
      videoElement.srcObject = stream;
      console.log('Stream de cámara establecido para QuaggaJS');

      // Verificar capacidades de la cámara también en QuaggaJS
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      console.log('Capacidades de cámara en QuaggaJS:', capabilities);

      // Configurar flash si está disponible (incluso en QuaggaJS)
      if (capabilities.torch || 'torch' in capabilities) {
        flashButton.style.display = 'block';
        currentVideoTrack = videoTrack; // Guardar referencia para el flash
        flashButton.addEventListener('click', toggleFlash);
        console.log('Flash disponible en iOS/QuaggaJS');
      } else {
        flashButton.style.display = 'none';
        console.log('Flash no disponible en este dispositivo iOS');
      }

      // Ocultar controles de zoom (QuaggaJS no los soporta bien)
      zoomInButton.style.display = 'none';
      zoomOutButton.style.display = 'none';
      zoomIndicator.style.display = 'none';

      console.log('Controles de cámara configurados para QuaggaJS');

      videoElement.addEventListener('loadeddata', () => {
        console.log('Video cargado, iniciando detección QuaggaJS...');
        startQuaggaDetection();
      });
    })
    .catch(err => {
      console.error('Error al acceder a la cámara:', err);
      resultElement.textContent = 'Error al acceder a la cámara. Asegúrate de dar permisos.';
    });
}

function startQuaggaDetection() {
  console.log('Iniciando detección con QuaggaJS');
  resultElement.textContent = 'Configurando detector...';

  // Verificar que Quagga esté disponible
  if (typeof Quagga === 'undefined') {
    console.error('Quagga no está definido');
    resultElement.textContent = '❌ Error: QuaggaJS no se cargó correctamente';
    return;
  }

  // Configuración optimizada para diferentes dispositivos
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  console.log('Detectando iOS en startQuaggaDetection:', isIOS);

  // Configuración ultra-simple para iOS
  let quaggaConfig;

  if (isIOS) {
    console.log('Aplicando configuración ultra-simple para iOS - Solo EAN-13');
    quaggaConfig = {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoElement
      },
      decoder: {
        readers: ["ean_13_reader"] // Solo EAN-13
      },
      locate: false // Desactivar localización para simplificar
    };
  } else {
    // Configuración para otros dispositivos - Solo EAN-13
    quaggaConfig = {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoElement,
        constraints: {
          width: 640,
          height: 480,
          facingMode: "environment"
        }
      },
      decoder: {
        readers: [
          "ean_13_reader" // Solo EAN-13
        ]
      },
      locate: true,
      locator: {
        patchSize: "medium",
        halfSample: true
      }
    };
  }

  console.log('Configuración QuaggaJS:', quaggaConfig);

  // Agregar timeout más corto para iOS
  const timeoutDuration = isIOS ? 5000 : 10000; // 5 segundos en iOS, 10 en otros
  const initTimeout = setTimeout(() => {
    console.error('Timeout inicializando Quagga');

    if (isIOS) {
      // Fallback completo para iOS
      console.log('Activando modo manual para iOS');
      resultElement.innerHTML = '📷 <strong>Modo Manual iOS:</strong><br>La cámara está activa. Enfoque el código y toque la pantalla.';

      // Agregar listener para tap manual
      videoElement.addEventListener('click', function() {
        resultElement.innerHTML = '👆 <strong>Tap detectado!</strong><br>En modo manual - QuaggaJS no funciona en este dispositivo iOS.';
      });

      const apiInfo = document.getElementById('api-info');
      if (apiInfo) {
        apiInfo.innerHTML = '📱 <strong>Modo Manual iOS</strong> - QuaggaJS no compatible';
        apiInfo.style.color = '#2196F3';
      }
    } else {
      resultElement.textContent = '⚠️ Timeout de inicialización. Intente recargar la página.';
      const apiInfo = document.getElementById('api-info');
      if (apiInfo) {
        apiInfo.innerHTML = '⚠️ <strong>Timeout de inicialización</strong> - Recargue la página';
        apiInfo.style.color = '#FF9800';
      }
    }
  }, timeoutDuration);

  Quagga.init(quaggaConfig, function(err) {
    clearTimeout(initTimeout); // Cancelar timeout si inicializa correctamente

    if (err) {
      console.error('Error inicializando Quagga:', err);

      // Mensaje y fallback específico para iOS
      if (isIOS) {
        console.log('QuaggaJS falló en iOS, activando modo manual');
        resultElement.innerHTML = `
          📱 <strong>Modo iOS Manual:</strong><br>
          • La cámara funciona correctamente<br>
          • QuaggaJS no es compatible con este iOS<br>
          • Puede ver los códigos pero no detectarlos automáticamente
        `;

        // Agregar interacción manual
        videoElement.addEventListener('click', function() {
          resultElement.innerHTML = '👆 <strong>¡Pantalla tocada!</strong><br>Modo manual activo - enfoque bien el código de barras';
        });

        const apiInfo = document.getElementById('api-info');
        if (apiInfo) {
          apiInfo.innerHTML = '📱 <strong>Modo Manual iOS</strong> - Cámara funcional';
          apiInfo.style.color = '#2196F3';
        }
      } else {
        resultElement.textContent = 'Error inicializando el scanner. Intente recargar la página.';
        const apiInfo = document.getElementById('api-info');
        if (apiInfo) {
          apiInfo.innerHTML = '❌ <strong>Error de inicialización</strong>';
          apiInfo.style.color = '#F44336';
        }
      }

      return;
    }

    console.log("QuaggaJS inicializado correctamente");
    resultElement.textContent = '📱 Apunta la cámara hacia un código de barras';

    // Actualizar API info con éxito
    const apiInfo = document.getElementById('api-info');
    if (apiInfo) {
      apiInfo.innerHTML = '✅ <strong>QuaggaJS activo</strong> - Listo para escanear';
      apiInfo.style.color = '#4CAF50';
    }

    try {
      Quagga.start();
      console.log('Quagga.start() ejecutado exitosamente');
    } catch (startErr) {
      console.error('Error al iniciar Quagga:', startErr);
      resultElement.textContent = '❌ Error al iniciar el scanner. Verifique los permisos de cámara.';
    }
  });

  // Listener para detección de códigos Código detectado con QuaggaJS
  Quagga.onDetected(function(result) {
    console.log('Código detectado con QuaggaJS:', result);

    let code = result.codeResult.code;
    let format = result.codeResult.format;

    // Procesar código EAN-13
    let displayValue = code;

    if (format === 'ean_13' && code.length >= 9) {
      // Para EAN-13, mostrar solo los primeros 9 dígitos
      displayValue = code.substring(0, 9);
    }

    // Mostrar formato y valor - Solo EAN-13
    resultElement.innerHTML = `<strong>EAN-13:</strong> ${displayValue}`;
    console.log(`Código detectado con QuaggaJS - Formato: ${format}, Valor: ${code}`);
    sonidoAlarma.play();
    // Enviar al backend si está configurado el evento
    if (scanningStarted && currentEventName && currentEventDate) {
      sendBarcodeToServer(displayValue, 'EAN-13');
    }
  });

  // Listener para errores
  Quagga.onProcessed(function(result) {
    if (result && result.boxes) {
      // Opcional: Dibujar overlay de detección
    }
  });
}