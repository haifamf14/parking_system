<?php
include 'db.php';

$slot = $_POST['slot'] ?? null;
$plate = $_POST['plate'] ?? null;
$contact = $_POST['contact'] ?? null;
$entry_time = $_POST['entry_time'] ?? null;

if($slot && $entry_time){
    $stmt = $conn->prepare("INSERT INTO parking_activity (slot, plate, contact, entry_time) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $slot, $plate, $contact, $entry_time);
    if($stmt->execute()){
        echo json_encode(["status"=>"success"]);
    } else {
        echo json_encode(["status"=>"error", "msg"=>$conn->error]);
    }
    $stmt->close();
}else{
    echo json_encode(["status"=>"error", "msg"=>"Missing data"]);
}
$conn->close();
?>
