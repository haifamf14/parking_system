session_start();
include('connect.php');

$username = $_POST['username'];
$password = $_POST['password'];

$sql = "SELECT * FROM users WHERE username='$username' AND password='$password'";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
  $row = $result->fetch_assoc();
  $_SESSION['username'] = $row['username'];
  $_SESSION['role'] = $row['role'];
  header("Location: dashboard.html");
} else {
  echo "Invalid username or password";
}
