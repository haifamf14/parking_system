<?php
header('Content-Type: application/json');
require_once 'db.php';

// SECURITY: restrict access to this script in production (add admin auth)
$serverKey = 'YOUR_FIREBASE_SERVER_KEY'; // paste from Firebase console Cloud Messaging (Legacy server key)

// Read POST JSON (title, body, optional token)
$input = json_decode(file_get_contents('php://input'), true);
$title = $input['title'] ?? 'Notification';
$body  = $input['body']  ?? '';
$targetToken = $input['token'] ?? null;

// If no specific token, send to all saved tokens
$tokens = [];
if ($targetToken) {
    $tokens[] = $targetToken;
} else {
    $res = $conn->query("SELECT token FROM fcm_tokens");
    while ($r = $res->fetch_assoc()) $tokens[] = $r['token'];
}

if (count($tokens) == 0) {
    echo json_encode(['error' => 'No tokens']);
    exit;
}

// FCM legacy allows up to 1000 registration_ids per request
$chunks = array_chunk($tokens, 1000);
$results = [];
foreach ($chunks as $chunk) {
    $fields = [
      'registration_ids' => $chunk,
      'notification' => [
        'title' => $title,
        'body'  => $body
      ],
      'priority' => 'high'
    ];

    $headers = [
      'Authorization: key=' . $serverKey,
      'Content-Type: application/json'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://fcm.googleapis.com/fcm/send');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));
    $result = curl_exec($ch);
    if ($result === FALSE) {
        $results[] = ['error' => curl_error($ch)];
    } else {
        $results[] = json_decode($result, true);
    }
    curl_close($ch);
}

echo json_encode(['success' => true, 'fcm_responses' => $results]);
