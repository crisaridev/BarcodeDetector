<?php
$nombreEvento = $_POST['event_name'];
$fechaEvento = $_POST['event_date'];
$numeroCuenta = $_POST['account_number'];

$nombreEvento = htmlspecialchars($nombreEvento);
$fechaEvento = htmlspecialchars($fechaEvento);
$numeroCuenta = htmlspecialchars($numeroCuenta);

echo $nombreEvento;
echo $fechaEvento;
echo $numeroCuenta;

header('Location: ./index.html');
exit();
