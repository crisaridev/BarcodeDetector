const videoElement = document.getElementById('scanner-video');
const resultElement = document.getElementById('barcode-result');
const flashButton = document.getElementById('flash-button');
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

  // Variable para controlar el estado del flash
  let isFlashOn = false;

  // Paso 2: Obtener acceso a la cámara
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      videoElement.srcObject = stream;

      // Verificar si el flash está disponible
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      if ('torch' in capabilities) {
        flashButton.style.display = 'block'; // Mostrar botón de flash
        flashButton.addEventListener('click', toggleFlash);
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
      await videoTrack.applyConstraints({
        advanced: [{
          torch: !isFlashOn
        }]
      });
      isFlashOn = !isFlashOn;
      flashButton.textContent = isFlashOn ? '🔦 Apagar Flash' : '🔦 Encender Flash';
      flashButton.style.backgroundColor = isFlashOn ? '#ff6b6b' : '#4ecdc4';
    } catch (err) {
      console.error('Error al alternar flash:', err);
    }
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

            resultElement.textContent = `${displayValue} (${detectedBarcode.format})`;

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