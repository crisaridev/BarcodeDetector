<?php
$nombreEvento=$_POST['event_name'];
$fechaEvento=$_POST['event_date'];
$numeroCuenta=$_POST[''];
echo $nombreEvento;
echo $fechaEvento;
echo $numeroCuenta;

header ('Locatio: ./index.html');
?>