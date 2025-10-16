<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: login.php");
    exit();
}
?>
<!DOCTYPE html>
<html>
<head>
  <title>Admin Parking Dashboard</title>
  <link rel="stylesheet" href="dashboard.css">
</head>
<body>
  <h1>Welcome Admin</h1>
  <a href="logout.php">Logout</a>
  <!-- your dashboard -->
  <script src="dashboard.js"></script>
</body>
</html>
