const videoElement = document.getElementById('scanner-video');
const resultElement = document.getElementById('barcode-result');
const flashButton = document.getElementById('flash-button');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const zoomIndicator = document.getElementById('zoom-indicator');
// Paso 1: Comprobar la compatibilidad y crear una instancia del detector
if ('BarcodeDetector' in window) {
  const barcodeDetector = new BarcodeDetector({
    formats: [
      'qr_code',        // Códigos QR
      'ean_13',         // Códigos de barras de productos (13 dígitos)
      'ean_8',          // Códigos de barras de productos (8 dígitos)
      'code_128',       // Códigos Code 128
      'code_39',        // Códigos Code 39
      'code_93',        // Códigos Code 93
      'codabar',        // Códigos Codabar
      'itf',            // Interleaved 2 of 5
      'upc_a',          // UPC-A (códigos de productos en EE.UU.)
      'upc_e',          // UPC-E (versión compacta de UPC-A)
      'pdf417',         // PDF417 (códigos 2D)
      'aztec',          // Códigos Aztec
      'data_matrix'     // Data Matrix
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
  resultElement.textContent = 'La API de Barcode Detection no es compatible con este navegador.';
}