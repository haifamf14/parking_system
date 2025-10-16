<?php
include 'db.php';

$slot = $_POST['slot'] ?? null;
$exit_time = $_POST['exit_time'] ?? null;
$duration = $_POST['duration'] ?? null;
$fee = $_POST['fee'] ?? null;

if($slot && $exit_time){
    $stmt = $conn->prepare("UPDATE parking_activity 
        SET exit_time=?, duration=?, fee=? 
        WHERE slot=? AND exit_time IS NULL
        ORDER BY id DESC LIMIT 1");
    $stmt->bind_param("sdis", $exit_time, $duration, $fee, $slot);
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
