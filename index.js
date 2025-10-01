const videoElement = document.getElementById('scanner-video');
const resultElement = document.getElementById('barcode-result');
const flashButton = document.getElementById('flash-button');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const zoomIndicator = document.getElementById('zoom-indicator');
// Paso 1: Comprobar la compatibilidad y crear una instancia del detector
console.log('Verificando compatibilidad de BarcodeDetector...');
console.log('Navigator userAgent:', navigator.userAgent);
console.log('BarcodeDetector disponible:', 'BarcodeDetector' in window);

// Actualizar información de compatibilidad en el DOM
const browserInfo = document.getElementById('browser-info');
const apiInfo = document.getElementById('api-info');

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

browserInfo.textContent = `${browserName} en ${platform}`;

// Verificar compatibilidad de BarcodeDetector
const hasBarcodeDetector = 'BarcodeDetector' in window;
if (hasBarcodeDetector) {
  apiInfo.innerHTML = '✅ <strong>BarcodeDetector nativo</strong> - Rendimiento óptimo';
  apiInfo.style.color = '#4CAF50';
} else {
  apiInfo.innerHTML = '⚠️ <strong>Fallback QuaggaJS</strong> - Compatibilidad extendida';
  apiInfo.style.color = '#FF9800';

  // Explicar por qué no está disponible
  if (isIOS) {
    apiInfo.innerHTML += '<br><small>Nota: iOS no soporta BarcodeDetector nativamente</small>';
  }
}

if ('BarcodeDetector' in window) {
  console.log('Usando BarcodeDetector nativo');
  const barcodeDetector = new BarcodeDetector({
    formats: [
      'ean_13',         // Códigos de barras de productos (13 dígitos)
    ]
  });

  // Variables para controlar el estado del flash y zoom
  let isFlashOn = false;
  let currentZoom = 1.0;
  let minZoom = 1.0;
  let maxZoom = 3.0;
  let currentVideoTrack = null;

  // Paso 2: Obtener acceso a la cámara
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoElement.srcObject = stream;

      // Verificar capacidades de la cámara
      currentVideoTrack = stream.getVideoTracks()[0];
      const capabilities = currentVideoTrack.getCapabilities();

      console.log('Capacidades de la cámara:', capabilities); // Debug

      // Configurar flash
      if (capabilities.torch || 'torch' in capabilities) {
        flashButton.style.display = 'block'; // Mostrar botón de flash
        flashButton.addEventListener('click', toggleFlash);
        console.log('Flash disponible'); // Debug
      } else {
        console.log('Flash no disponible en este dispositivo'); // Debug
        flashButton.style.display = 'none'; // Ocultar botón si no hay flash
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
        console.log(`Zoom disponible: ${minZoom}x - ${maxZoom}x`); // Debug
      } else {
        console.log('Zoom no disponible en este dispositivo'); // Debug
      }

      videoElement.addEventListener('loadeddata', () => {
        // El video está listo para reproducirse, podemos empezar a detectar
        startDetection();
      });
    })
    .catch(err => {
      console.error('Error al acceder a la cámara:', err);
      resultElement.textContent = 'Error al acceder a la cámara. Asegúrate de estar en un contexto seguro (HTTPS).';
    });

  // Función para alternar el flash
  async function toggleFlash() {
    try {
      const videoTrack = videoElement.srcObject.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      console.log('Intentando alternar flash. Estado actual:', isFlashOn); // Debug

      // Método 1: Usando constraints básicos
      try {
        await videoTrack.applyConstraints({
          torch: !isFlashOn
        });
        console.log('Método 1 exitoso'); // Debug
      } catch (error1) {
        console.log('Método 1 falló, probando método 2:', error1); // Debug

        // Método 2: Usando constraints avanzados
        try {
          await videoTrack.applyConstraints({
            advanced: [{
              torch: !isFlashOn
            }]
          });
          console.log('Método 2 exitoso'); // Debug
        } catch (error2) {
          console.log('Método 2 falló, probando método 3:', error2); // Debug

          // Método 3: Recrear el stream con torch
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              torch: !isFlashOn
            }
          });

          videoElement.srcObject = newStream;
          console.log('Método 3 exitoso'); // Debug
        }
      }

      isFlashOn = !isFlashOn;
      flashButton.textContent = isFlashOn ? '🔦 Apagar Flash' : '🔦 Encender Flash';
      flashButton.style.backgroundColor = isFlashOn ? '#ff6b6b' : '#4ecdc4';

    } catch (err) {
      console.error('Error al alternar flash:', err);
      // Mostrar el error al usuario
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
      console.log(`Zoom aplicado: ${zoomLevel.toFixed(1)}x`); // Debug
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

  // Función para el bucle de detección
  function startDetection() {
    // Ejecuta la detección cada X milisegundos (por ejemplo, 100ms)
    const intervalId = setInterval(async () => {
      try {
        // Verificar que el video esté listo
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          const barcodes = await barcodeDetector.detect(videoElement);
          if (barcodes.length > 0) {
            // Se encontró un código de barras
            const detectedBarcode = barcodes[0];
            let displayValue = detectedBarcode.rawValue;

            // Para códigos EAN-13, mostrar solo los primeros 9 dígitos
            if (detectedBarcode.format === 'ean_13' && detectedBarcode.rawValue.length >= 9) {
              displayValue = detectedBarcode.rawValue.substring(0, 9);
            }

            resultElement.textContent = `${displayValue}`;

            // Opcional: detener la detección después del primer éxito
            // clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error('Error durante la detección:', err);
        resultElement.textContent = 'Error durante la detección';
      }
    }, 100); // Frecuencia de escaneo
  }

} else {
  console.log('BarcodeDetector no disponible, usando QuaggaJS como fallback');
  resultElement.textContent = 'Inicializando scanner compatible...';

  // Mostrar mensaje específico para iOS
  if (isIOS) {
    console.log('Detectado dispositivo iOS - usando QuaggaJS optimizado');
    resultElement.textContent = 'Configurando scanner para iOS...';
  }

  // Cargar QuaggaJS como fallback
  loadQuaggaJS();
}

// Función de fallback para dispositivos que no soportan BarcodeDetector
function loadQuaggaJS() {
  console.log('Cargando QuaggaJS desde CDN...');

  // Actualizar API info mientras se carga
  const apiInfo = document.getElementById('api-info');
  apiInfo.innerHTML = '⏳ Cargando scanner alternativo...';
  apiInfo.style.color = '#2196F3';

  // Cargar la librería QuaggaJS dinámicamente
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
  script.onload = () => {
    console.log('QuaggaJS cargado exitosamente');
    apiInfo.innerHTML = '✅ <strong>QuaggaJS cargado</strong> - Scanner alternativo activo';
    apiInfo.style.color = '#4CAF50';
    initQuaggaScanner();
  };
  script.onerror = () => {
    const errorMsg = 'Error: No se pudo cargar el scanner alternativo. Verifique su conexión a internet.';
    resultElement.textContent = errorMsg;
    apiInfo.innerHTML = '❌ <strong>Error de carga</strong> - Scanner no disponible';
    apiInfo.style.color = '#F44336';
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
    // En iOS, usar resoluciones más estables
    videoConstraints.width = { ideal: 640 };
    videoConstraints.height = { ideal: 480 };
  }

  // Inicializar cámara para QuaggaJS
  navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    .then(stream => {
      videoElement.srcObject = stream;
      console.log('Stream de cámara establecido para QuaggaJS');

      // Configurar controles básicos (sin zoom para QuaggaJS)
      flashButton.style.display = 'none'; // QuaggaJS no soporta flash nativo
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

  // Configuración optimizada para diferentes dispositivos
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const quaggaConfig = {
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
        "ean_reader",     // Para EAN-13 y EAN-8
        "ean_8_reader"    // Específicamente EAN-8
      ]
    },
    locate: true,
    locator: {
      patchSize: isIOS ? "large" : "medium",  // Parches más grandes en iOS
      halfSample: !isIOS  // No usar halfSample en iOS para mejor calidad
    }
  };

  // Configuraciones adicionales para iOS
  if (isIOS) {
    console.log('Aplicando configuración optimizada para iOS');
    quaggaConfig.locator.debug = {
      showCanvas: false,
      showPatches: false,
      showFoundPatches: false,
      showSkeleton: false,
      showLabels: false,
      showPatchLabels: false,
      showRemainingPatchLabels: false,
      boxFromPatches: {
        showTransformed: false,
        showTransformedBox: false,
        showBB: false
      }
    };
  }

  Quagga.init(quaggaConfig, function(err) {
    if (err) {
      console.error('Error inicializando Quagga:', err);
      resultElement.textContent = 'Error inicializando el scanner. Intente recargar la página.';

      // Actualizar API info con el error
      const apiInfo = document.getElementById('api-info');
      apiInfo.innerHTML = '❌ <strong>Error de inicialización</strong>';
      apiInfo.style.color = '#F44336';
      return;
    }

    console.log("QuaggaJS inicializado correctamente");
    resultElement.textContent = '📱 Apunta la cámara hacia un código de barras';

    // Actualizar API info con éxito
    const apiInfo = document.getElementById('api-info');
    apiInfo.innerHTML = '✅ <strong>QuaggaJS activo</strong> - Listo para escanear';
    apiInfo.style.color = '#4CAF50';

    Quagga.start();
  });

  // Listener para detección de códigos
  Quagga.onDetected(function(result) {
    console.log('Código detectado con QuaggaJS:', result);

    let code = result.codeResult.code;
    let format = result.codeResult.format;

    // Para códigos EAN-13, mostrar solo los primeros 9 dígitos
    if (format === 'ean_13' && code.length >= 9) {
      code = code.substring(0, 9);
    }

    resultElement.textContent = `${code}`;

    // Opcional: detener después de detectar
    // Quagga.stop();
  });

  // Listener para errores
  Quagga.onProcessed(function(result) {
    if (result && result.boxes) {
      // Opcional: Dibujar overlay de detección
      // console.log('Procesando frame...');
    }
  });
}