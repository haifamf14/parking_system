// Function to navigate to the parking system page
function enterParkingSystem() {
    // In a real implementation, this would be the path to your HTML file
    // For example: window.location.href = "parking-system.html";

    // For demonstration purposes, we'll show an alert
    // alert("Redirecting to Marina Island Parking System...");

    // Uncomment the line below and replace with your actual file path
    window.location.href = "index.html";
}

// Function to navigate to the admin panel
function enterAdminPanel() {
    // In a real implementation, this would be the path to your admin panel
    // For example: window.location.href = "admin-panel.html";

    // For demonstration purposes, we'll show an alert
    alert("Redirecting to Admin Panel...");

    // Uncomment the line below and replace with your actual admin panel path
    window.location.href = "your-admin-panel-file.html";
}

// Additional interactive features
document.addEventListener('DOMContentLoaded', function () {
    // Add animation to features on page load
    const features = document.querySelectorAll('.feature');
    features.forEach((feature, index) => {
        feature.style.animationDelay = `${index * 0.1}s`;
        feature.classList.add('fade-in');
    });

    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-3px)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });
});

// Add a simple animation class
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .fade-in {
        animation: fadeIn 0.6s ease forwards;
    }
`;
document.head.appendChild(style);