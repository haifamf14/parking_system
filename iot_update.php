<?php
require_once 'db.php';

// Example input from IoT: slot_id and occupied (0/1)
$slot = $_POST['slot_id'] ?? '';
$occupied = isset($_POST['occupied']) ? intval($_POST['occupied']) : null;

// update slots table
$stmt = $conn->prepare("UPDATE slots SET is_available = ? WHERE slot_id = ?");
$available = $occupied ? 0 : 1;
$stmt->bind_param("is", $available, $slot);
$stmt->execute();

// do whatever logs you want: bookings or history

// trigger notification to admins/users
$title = $occupied ? "Slot $slot occupied" : "Slot $slot is now free";
$body = $occupied ? "A car detected at $slot" : "Slot $slot available now";

// call internal function or call send_notification.php via curl
$ch = curl_init('http://localhost/Website-DIPMAS/send_notification.php');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['title'=>$title, 'body'=>$body]));
$response = curl_exec($ch);
curl_close($ch);

echo "OK";
