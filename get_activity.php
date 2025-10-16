<?php
include 'db.php';

$sql = "SELECT * FROM parking_activity ORDER BY id DESC LIMIT 100";
$result = $conn->query($sql);

$data = [];
while($row = $result->fetch_assoc()){
    $data[] = $row;
}

echo json_encode($data);
$conn->close();
?>
