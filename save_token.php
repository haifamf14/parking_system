<?php
header('Content-Type: application/json');
require_once 'db.php'; // your DB connection file

$input = json_decode(file_get_contents('php://input'), true);
$token = $input['token'] ?? '';

if (!$token) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing token']);
  exit;
}

$stmt = $conn->prepare("INSERT INTO fcm_tokens (token) VALUES (?) ON DUPLICATE KEY UPDATE token = token");
$stmt->bind_param("s", $token);
if ($stmt->execute()) {
  echo json_encode(['success' => true]);
} else {
  http_response_code(500);
  echo json_encode(['error' => $stmt->error]);
}
$stmt->close();
$conn->close();
