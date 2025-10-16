let parkingSlots = [];
let selectedSlot = null;
let currentBooking = null;
let bookings = JSON.parse(localStorage.getItem('parkingBookings')) || [];
let bookingTimeouts = {};

// Initialize parking slots - all available initially
function initializeParkingSlots() {
    const totalSlots = 8;

    parkingSlots = [];
    for (let i = 1; i <= totalSlots; i++) {
        const row = i <= 4 ? 'A' : 'B';
        const position = i <= 4 ? i : i - 4;
        const facing = i <= 4 ? 'Jetty Side' : 'Road Side';

        // Check if this slot is already booked
        const existingBooking = bookings.find(b => b.slotId === i && b.status === 'active');

        parkingSlots.push({
            id: i,
            number: `${row}${String(position).padStart(2, '0')}`,
            row: row.toLowerCase(),
            position: position,
            facing: facing,
            available: !existingBooking, // Set availability based on existing booking
            zone: row
        });
    }

    renderParkingSlots();
    updateStats();

    // Initialize booking timeouts for active bookings
    initializeBookingTimeouts();
}

function renderParkingSlots() {
    const container = document.getElementById('parking-slots');
    container.innerHTML = '';

    // First render Row A slots
    const rowASlots = parkingSlots.filter(slot => slot.row === 'a');
    renderSlotRow(container, rowASlots, 'Row A - Jetty Side');

    // Then render Row B slots below
    const rowBSlots = parkingSlots.filter(slot => slot.row === 'b');
    renderSlotRow(container, rowBSlots, 'Row B - Road Side');
}

function renderSlotRow(container, slots, rowTitle) {
    // Add row header
    const rowHeader = document.createElement('div');
    rowHeader.className = 'row-header';
    rowHeader.textContent = rowTitle;
    container.appendChild(rowHeader);

    // Create row container
    const rowContainer = document.createElement('div');
    rowContainer.className = 'slot-row';

    // Add slots to the row
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = `slot ${slot.available ? 'available' : 'occupied'}`;
        slotElement.innerHTML = `
            <span class="slot-icon">${slot.available ? '🚗' : '🚫'}</span>
            <div class="slot-number">${slot.number}</div>
            ${slot.available ? '<div class="slot-badge">Available</div>' : '<div class="slot-badge occupied">Occupied</div>'}
        `;

        if (slot.available) {
            slotElement.addEventListener('click', () => selectSlot(slot));
        }

        rowContainer.appendChild(slotElement);
    });

    container.appendChild(rowContainer);
}

function updateStats() {
    const available = parkingSlots.filter(slot => slot.available).length;
    const occupied = parkingSlots.length - available;

    document.getElementById('available-count').textContent = available;
    document.getElementById('occupied-count').textContent = occupied;
    document.getElementById('total-count').textContent = parkingSlots.length;
}

function filterSlots(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const slots = document.querySelectorAll('.slot');
    const rowHeaders = document.querySelectorAll('.row-header');

    slots.forEach((slot, index) => {
        const slotData = parkingSlots[index];
        let show = true;

        switch (filter) {
            case 'available':
                show = slotData.available;
                break;
            case 'jetty':
                show = slotData.row === 'a';
                break;
            case 'road':
                show = slotData.row === 'b';
                break;
            default:
                show = true;
        }

        slot.style.display = show ? 'flex' : 'none';
    });

    // Show/hide row headers based on visible slots
    rowHeaders.forEach(header => {
        const rowType = header.textContent.includes('Jetty') ? 'jetty' : 'road';
        const shouldShow = filter === 'all' ||
            filter === 'available' ||
            (filter === 'jetty' && rowType === 'jetty') ||
            (filter === 'road' && rowType === 'road');

        header.style.display = shouldShow ? 'block' : 'none';
    });

    // Hide my bookings section when filtering slots
    document.getElementById('my-bookings').classList.add('hidden');
    document.querySelector('h2').textContent = 'Available Parking Slots';
}

function showMyBookings() {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Hide all slots
    document.querySelectorAll('.slot').forEach(slot => {
        slot.style.display = 'none';
    });

    // Hide row headers
    document.querySelectorAll('.row-header').forEach(header => {
        header.style.display = 'none';
    });

    // Show my bookings
    document.getElementById('my-bookings').classList.remove('hidden');
    document.querySelector('h2').textContent = 'My Bookings';

    renderMyBookings();
}

function renderMyBookings() {
    const bookingsList = document.getElementById('bookings-list');
    bookingsList.innerHTML = '';

    // Get plate number from local storage or prompt
    const plateNumber = localStorage.getItem('lastPlateNumber') || '';

    if (!plateNumber) {
        bookingsList.innerHTML = '<div class="no-bookings">No bookings found. Please make a booking first.</div>';
        return;
    }

    // Filter bookings for this plate number
    const myBookings = bookings.filter(booking =>
        booking.plateNumber === plateNumber && booking.status === 'active'
    );

    if (myBookings.length === 0) {
        bookingsList.innerHTML = '<div class="no-bookings">No active bookings found.</div>';
        return;
    }

    myBookings.forEach(booking => {
        const bookingElement = document.createElement('div');
        bookingElement.className = 'booking-item';

        const bookingTime = new Date(booking.entryTime);
        const timeRemaining = Math.max(0, 30 - Math.floor((new Date() - bookingTime) / 60000));

        bookingElement.innerHTML = `
            <div class="booking-details">
                <div><strong>Slot:</strong> ${booking.slotNumber}</div>
                <div><strong>Plate:</strong> ${booking.plateNumber}</div>
                <div><strong>Booked at:</strong> ${bookingTime.toLocaleString()}</div>
                <div class="booking-time"><strong>Time remaining:</strong> ${timeRemaining} minutes</div>
            </div>
            <div class="booking-actions">
                <button class="cancel-booking-btn" onclick="cancelBooking('${booking.bookingId}')">Cancel</button>
            </div>
        `;

        bookingsList.appendChild(bookingElement);
    });
}

function selectSlot(slot) {
    selectedSlot = slot;

    document.getElementById('selected-slot-info').innerHTML = `
        <div class="selected-slot-header">
            <span class="slot-icon">🚗</span>
            <h3>Slot ${slot.number}</h3>
        </div>
        <div class="selected-slot-details">
            <div><strong>Location:</strong> ${slot.facing}</div>
            <div><strong>Row:</strong> ${slot.row.toUpperCase()}</div>
            <div><strong>Status:</strong> <span class="available-status">Available</span></div>
        </div>
    `;

    showPage('booking-page');
}

function updateContactInput() {
    const contactType = document.getElementById('contact-type').value;
    const contactInput = document.getElementById('contact');
    const contactLabel = document.getElementById('contact-label');

    if (contactType === 'email') {
        contactInput.type = 'email';
        contactInput.placeholder = 'your.email@example.com';
        contactLabel.textContent = 'Enter Email Address:';
    } else {
        contactInput.type = 'tel';
        contactInput.placeholder = '+60 12-345 6789';
        contactLabel.textContent = 'Enter Phone Number:';
    }
}

document.getElementById('booking-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const confirmBtn = document.querySelector('#booking-form button[type="submit"]');
    const confirmText = document.getElementById('confirm-text');

    // Show loading state
    confirmText.innerHTML = '<span class="loading"></span>Processing...';
    confirmBtn.disabled = true;

    // Get form values
    const plateNumber = document.getElementById('plate-number').value;
    const contact = document.getElementById('contact').value;
    const contactType = document.getElementById('contact-type').value;

    // Save plate number for future reference
    localStorage.setItem('lastPlateNumber', plateNumber);

    setTimeout(() => {
        currentBooking = {
            slotId: selectedSlot.id,
            slotNumber: selectedSlot.number,
            plateNumber: plateNumber,
            contact: contact,
            contactType: contactType,
            bookingId: 'PK' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            entryTime: new Date(),
            status: 'active'
        };

        // Add to bookings array
        bookings.push(currentBooking);
        saveBookings();

        // Mark slot as occupied
        const slotIndex = parkingSlots.findIndex(s => s.id === selectedSlot.id);
        parkingSlots[slotIndex].available = false;

        document.getElementById('success-details').innerHTML = `
            <div class="booking-id">Booking ID: ${currentBooking.bookingId}</div>
            <div class="success-detail"><strong>Slot:</strong> ${selectedSlot.number}</div>
            <div class="success-detail"><strong>Location:</strong> ${selectedSlot.facing}</div>
            <div class="success-detail"><strong>Entry Time:</strong> ${currentBooking.entryTime.toLocaleString()}</div>
            <div class="success-detail"><strong>Contact:</strong> ${contact}</div>
            <div class="rate-notice">Your booking will be automatically cancelled if your vehicle is not detected within 30 minutes.</div>
        `;

        showPage('success-page');

        // Set timeout for auto-cancellation (30 minutes)
        setBookingTimeout(currentBooking.bookingId, 30 * 60 * 1000);

        // Reset form
        confirmText.textContent = 'Confirm Booking';
        confirmBtn.disabled = false;
        document.getElementById('booking-form').reset();

        // Update stats
        updateStats();
        renderParkingSlots();

        // Send booking data to server (database)
        saveBookingToDatabase(currentBooking);
    }, 1500);
});

function setBookingTimeout(bookingId, delay) {
    // Clear existing timeout if any
    if (bookingTimeouts[bookingId]) {
        clearTimeout(bookingTimeouts[bookingId]);
    }

    // Set new timeout
    bookingTimeouts[bookingId] = setTimeout(() => {
        autoCancelBooking(bookingId);
    }, delay);
}

function autoCancelBooking(bookingId) {
    const bookingIndex = bookings.findIndex(b => b.bookingId === bookingId && b.status === 'active');

    if (bookingIndex !== -1) {
        // Update booking status
        bookings[bookingIndex].status = 'auto_cancelled';
        saveBookings();

        // Free up the parking slot
        const slotIndex = parkingSlots.findIndex(s => s.id === bookings[bookingIndex].slotId);
        if (slotIndex !== -1) {
            parkingSlots[slotIndex].available = true;
        }

        // Update UI
        updateStats();
        renderParkingSlots();

        // Send update to server
        updateBookingInDatabase(bookingId, 'auto_cancelled');

        console.log(`Booking ${bookingId} automatically cancelled due to no vehicle detection`);
    }
}

function cancelBooking(bookingId) {
    const bookingIndex = bookings.findIndex(b => b.bookingId === bookingId);

    if (bookingIndex !== -1 && bookings[bookingIndex].status === 'active') {
        // Update booking status
        bookings[bookingIndex].status = 'cancelled';
        saveBookings();

        // Free up the parking slot
        const slotIndex = parkingSlots.findIndex(s => s.id === bookings[bookingIndex].slotId);
        if (slotIndex !== -1) {
            parkingSlots[slotIndex].available = true;
        }

        // Clear timeout
        if (bookingTimeouts[bookingId]) {
            clearTimeout(bookingTimeouts[bookingId]);
            delete bookingTimeouts[bookingId];
        }

        // Update UI
        updateStats();
        renderParkingSlots();
        renderMyBookings();

        // Send update to server
        updateBookingInDatabase(bookingId, 'cancelled');

        alert('Booking cancelled successfully');
    }
}

function cancelCurrentBooking() {
    if (currentBooking) {
        cancelBooking(currentBooking.bookingId);
        goHome();
    }
}

function initializeBookingTimeouts() {
    // Set timeouts for all active bookings
    bookings.forEach(booking => {
        if (booking.status === 'active') {
            const bookingTime = new Date(booking.entryTime);
            const timeElapsed = new Date() - bookingTime;
            const timeRemaining = Math.max(0, 30 * 60 * 1000 - timeElapsed);

            if (timeRemaining > 0) {
                setBookingTimeout(booking.bookingId, timeRemaining);
            } else {
                // Auto-cancel if time has expired
                autoCancelBooking(booking.bookingId);
            }
        }
    });
}

function saveBookings() {
    localStorage.setItem('parkingBookings', JSON.stringify(bookings));
}

function showDirections() {
    const directions = getDirections(currentBooking.slotNumber);
    document.getElementById('direction-text').innerHTML = directions;
    showPage('directions-page');
}

function getDirections(slotNumber) {
    const row = slotNumber.charAt(0).toLowerCase();
    const position = parseInt(slotNumber.substring(1));

    const directions = {
        'a': {
            '1': 'Enter Marina Island parking → Head straight → First slot on your left facing the jetty',
            '2': 'Enter Marina Island parking → Head straight → Second slot on your left facing the jetty',
            '3': 'Enter Marina Island parking → Head straight → Third slot on your left facing the jetty',
            '4': 'Enter Marina Island parking → Head straight → Last slot on your left facing the jetty'
        },
        'b': {
            '1': 'Enter Marina Island parking → Head straight → First slot on your right facing the road',
            '2': 'Enter Marina Island parking → Head straight → Second slot on your right facing the road',
            '3': 'Enter Marina Island parking → Head straight → Third slot on your right facing the road',
            '4': 'Enter Marina Island parking → Head straight → Last slot on your right facing the road'
        }
    };

    const direction = directions[row]?.[position.toString()] || 'Please check with the parking attendant at the entrance.';

    return `
        <div class="direction-steps">
            <h4>Directions to Slot ${slotNumber}:</h4>
            <p>${direction}</p>
            <div class="direction-tip">
                <strong>Tip:</strong> Jetty-facing slots offer easy access to ferry services to Pangkor Island.
            </div>
        </div>
    `;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

function goBack() {
    showPage('main-page');
    selectedSlot = null;
}

function goHome() {
    showPage('main-page');
    selectedSlot = null;
    currentBooking = null;
}

// Database functions (to be implemented with actual backend)
function saveBookingToDatabase(booking) {
    // This is a placeholder for actual database integration
    // In a real implementation, you would use fetch or axios to send data to your server

    console.log('Saving booking to database:', booking);

    /* Example implementation:
    fetch('/api/bookings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(booking)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Booking saved to database:', data);
    })
    .catch(error => {
        console.error('Error saving booking:', error);
    });
    */
}

function updateBookingInDatabase(bookingId, status) {
    // This is a placeholder for actual database integration

    console.log(`Updating booking ${bookingId} status to ${status}`);

    /* Example implementation:
    fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Booking updated in database:', data);
    })
    .catch(error => {
        console.error('Error updating booking:', error);
    });
    */
}

function checkPlateDetection(plateNumber) {
    // This function would be called by your camera detection system
    // When a plate is detected, it should clear the timeout for that booking

    const activeBooking = bookings.find(b =>
        b.plateNumber === plateNumber && b.status === 'active'
    );

    if (activeBooking && bookingTimeouts[activeBooking.bookingId]) {
        clearTimeout(bookingTimeouts[activeBooking.bookingId]);
        delete bookingTimeouts[activeBooking.bookingId];
        console.log(`Plate detected: ${plateNumber}. Booking ${activeBooking.bookingId} confirmed.`);
    }
}

// Initialize the application with all slots available
initializeParkingSlots();

// Simulate plate detection (for testing purposes)
// In a real implementation, this would be called by your camera system
// setTimeout(() => checkPlateDetection('ABC1234'), 5000);