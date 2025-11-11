let orders = [];
let currentOrderId = null;

// Load orders from localStorage on page load
document.addEventListener('DOMContentLoaded', function() {
    loadOrders();
    renderOrders();
    updateStats();
    attachEventListeners();
});

function attachEventListeners() {
    // Main action buttons
    const addOrderBtn = document.querySelector('.actions button.btn-primary');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', openAddOrderModal);
    }

    const exportBtn = document.querySelector('.actions button.btn-secondary:nth-of-type(1)');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    const importBtn = document.querySelector('.actions button.btn-secondary:nth-of-type(2)');
    if (importBtn) {
        importBtn.addEventListener('click', importData);
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterOrders);
    }

    // Add Order Modal buttons
    const closeModalBtn = document.querySelector('#addOrderModal .close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAddOrderModal);
    }

    const addOrderForm = document.getElementById('addOrderForm');
    if (addOrderForm) {
        addOrderForm.addEventListener('submit', addOrder);
    }

    const imageUrlInput = document.getElementById('imageUrl');
    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', previewImage);
    }

    const imageFileInput = document.getElementById('imageFile');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', handleImageUpload);
    }

    // Add Link Modal buttons
    const closeLinkModalBtn = document.querySelector('#addLinkModal .close-modal');
    if (closeLinkModalBtn) {
        closeLinkModalBtn.addEventListener('click', closeAddLinkModal);
    }

    const addLinkForm = document.getElementById('addLinkForm');
    if (addLinkForm) {
        addLinkForm.addEventListener('submit', addLink);
    }

    // Import file input
    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', handleImport);
    }
}

function loadOrders() {
    const savedOrders = localStorage.getItem('dropshipping_orders');
    if (savedOrders) {
        orders = JSON.parse(savedOrders);
    }
}

function saveOrders() {
    localStorage.setItem('dropshipping_orders', JSON.stringify(orders));
}

function openAddOrderModal() {
    document.getElementById('addOrderModal').classList.add('active');
}

function closeAddOrderModal() {
    document.getElementById('addOrderModal').classList.remove('active');
    document.getElementById('imageUrl').value = '';
    document.getElementById('imageFile').value = '';
    document.getElementById('imagePreview').classList.remove('active');
    document.getElementById('price').value = '';
    document.getElementById('address').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('notes').value = '';
}

function previewImage() {
    const url = document.getElementById('imageUrl').value;
    const preview = document.getElementById('imagePreview');
    if (url) {
        preview.src = url;
        preview.classList.add('active');
    } else {
        preview.classList.remove('active');
    }
}

function handleImageUpload() {
    const file = document.getElementById('imageFile').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imageUrl').value = e.target.result;
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreview').classList.add('active');
        };
        reader.readAsDataURL(file);
    }
}

function addOrder(event) {
    event.preventDefault();

    const order = {
        id: 'ORD-' + Date.now(),
        imageUrl: document.getElementById('imageUrl').value || 'https://via.placeholder.com/300x200?text=No+Image',
        price: parseFloat(document.getElementById('price').value),
        address: document.getElementById('address').value,
        customerName: document.getElementById('customerName').value,
        notes: document.getElementById('notes').value,
        checkpoints: {
            ordered: { checked: true, date: new Date().toISOString() },
            shipped: { checked: false, date: null },
            inTransit: { checked: false, date: null },
            reachedCountry: { checked: false, date: null, trackingNumber: '' },
            outForDelivery: { checked: false, date: null },
            delivered: { checked: false, date: null }
        },
        trackingLinks: [],
        createdAt: new Date().toISOString()
    };

    orders.push(order);
    saveOrders();
    renderOrders();
    updateStats();
    closeAddOrderModal();
}

function renderOrders() {
    const container = document.getElementById('ordersContainer');

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>No Orders Yet</h3>
                <p>Click "Add Order" to start tracking your dropshipping orders</p>
                <button class="btn btn-primary" id="emptyStateAddBtn">Add Your First Order</button>
            </div>
        `;
        // Attach event listener to the empty state button
        const emptyStateBtn = document.getElementById('emptyStateAddBtn');
        if (emptyStateBtn) {
            emptyStateBtn.addEventListener('click', openAddOrderModal);
        }
        return;
    }

    container.innerHTML = orders.map(order => `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div>
                    <div class="order-id">${order.id}</div>
                    <div class="order-date">${new Date(order.createdAt).toLocaleDateString()}</div>
                </div>
            </div>

            <img src="${order.imageUrl}" alt="Product" class="product-image" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'">

            <div class="order-info">
                <div class="info-row">
                    <span class="info-label">Price:</span>
                    <span class="price">$${order.price.toFixed(2)}</span>
                </div>
                ${order.customerName ? `
                <div class="info-row">
                    <span class="info-label">Customer:</span>
                    <span class="info-value">${order.customerName}</span>
                </div>
                ` : ''}
            </div>

            <div class="address">
                <strong>📍 Shipping To:</strong><br>
                ${order.address}
            </div>

            ${order.notes ? `
            <div class="address">
                <strong>📝 Notes:</strong><br>
                ${order.notes}
            </div>
            ` : ''}

            <div class="checkpoints">
                <div class="checkpoint-title">Order Progress</div>

                <div class="checkpoint ${order.checkpoints.ordered.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.ordered.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="ordered"></div>
                    <span class="checkpoint-label">Order Placed</span>
                </div>

                <div class="checkpoint ${order.checkpoints.shipped.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.shipped.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="shipped"></div>
                    <span class="checkpoint-label">Shipped from Supplier</span>
                </div>

                <div class="checkpoint ${order.checkpoints.inTransit.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.inTransit.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="inTransit"></div>
                    <span class="checkpoint-label">In Transit</span>
                </div>

                <div class="checkpoint ${order.checkpoints.reachedCountry.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.reachedCountry.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="reachedCountry"></div>
                    <span class="checkpoint-label">Reached Destination Country</span>
                    ${order.checkpoints.reachedCountry.checked ? `
                        <div class="tracking-input-group">
                            <input type="text"
                                   value="${order.checkpoints.reachedCountry.trackingNumber || ''}"
                                   placeholder="Enter tracking number"
                                   data-order-id="${order.id}"
                                   class="tracking-number-input">
                        </div>
                    ` : ''}
                </div>

                <div class="checkpoint ${order.checkpoints.outForDelivery.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.outForDelivery.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="outForDelivery"></div>
                    <span class="checkpoint-label">Out for Delivery</span>
                </div>

                <div class="checkpoint ${order.checkpoints.delivered.checked ? 'completed' : ''}">
                    <div class="checkpoint-btn ${order.checkpoints.delivered.checked ? 'checked' : ''}"
                         data-order-id="${order.id}" data-checkpoint="delivered"></div>
                    <span class="checkpoint-label">Delivered</span>
                </div>
            </div>

            <div class="tracking-links">
                <div class="links-header">
                    <span class="links-title">Tracking Links</span>
                    <button class="add-link-btn" data-order-id="${order.id}">+ Add Link</button>
                </div>
                ${order.trackingLinks.length > 0 ? order.trackingLinks.map((link, index) => `
                    <div class="link-item">
                        <a href="${link.url}" target="_blank" title="${link.url}">
                            ${link.platform}
                        </a>
                        <button class="remove-link-btn" data-order-id="${order.id}" data-link-index="${index}">×</button>
                    </div>
                `).join('') : '<p style="font-size: 12px; color: #999; margin: 10px 0;">No tracking links added yet</p>'}
            </div>

            <div class="order-actions">
                <button class="btn btn-danger" data-order-id="${order.id}">Delete</button>
            </div>
        </div>
    `).join('');

    // Attach event listeners to dynamically created elements
    attachDynamicEventListeners();
}

function attachDynamicEventListeners() {
    // Checkpoint buttons
    document.querySelectorAll('.checkpoint-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            const checkpoint = this.dataset.checkpoint;
            toggleCheckpoint(orderId, checkpoint);
        });
    });

    // Tracking number inputs
    document.querySelectorAll('.tracking-number-input').forEach(input => {
        input.addEventListener('change', function() {
            const orderId = this.dataset.orderId;
            updateTrackingNumber(orderId, this.value);
        });
    });

    // Add link buttons
    document.querySelectorAll('.add-link-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            openAddLinkModal(orderId);
        });
    });

    // Remove link buttons
    document.querySelectorAll('.remove-link-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            const linkIndex = parseInt(this.dataset.linkIndex);
            removeLink(orderId, linkIndex);
        });
    });

    // Delete order buttons
    document.querySelectorAll('.order-actions .btn-danger').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            deleteOrder(orderId);
        });
    });
}

function toggleCheckpoint(orderId, checkpoint) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.checkpoints[checkpoint].checked = !order.checkpoints[checkpoint].checked;
        order.checkpoints[checkpoint].date = order.checkpoints[checkpoint].checked ? new Date().toISOString() : null;

        saveOrders();
        renderOrders();
        updateStats();
    }
}

function updateTrackingNumber(orderId, trackingNumber) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.checkpoints.reachedCountry.trackingNumber = trackingNumber;
        saveOrders();
    }
}

function openAddLinkModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('addLinkModal').classList.add('active');
}

function closeAddLinkModal() {
    document.getElementById('addLinkModal').classList.remove('active');
    document.getElementById('linkPlatform').value = '';
    document.getElementById('linkUrl').value = '';
    currentOrderId = null;
}

function addLink(event) {
    event.preventDefault();

    const order = orders.find(o => o.id === currentOrderId);
    if (order) {
        order.trackingLinks.push({
            platform: document.getElementById('linkPlatform').value,
            url: document.getElementById('linkUrl').value
        });

        saveOrders();
        renderOrders();
        closeAddLinkModal();
    }
}

function removeLink(orderId, linkIndex) {
    if (confirm('Remove this tracking link?')) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.trackingLinks.splice(linkIndex, 1);
            saveOrders();
            renderOrders();
        }
    }
}

function deleteOrder(orderId) {
    if (confirm('Are you sure you want to delete this order? This cannot be undone.')) {
        orders = orders.filter(o => o.id !== orderId);
        saveOrders();
        renderOrders();
        updateStats();
    }
}

function updateStats() {
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingOrders').textContent = orders.filter(o => !o.checkpoints.shipped.checked).length;
    document.getElementById('shippedOrders').textContent = orders.filter(o => o.checkpoints.shipped.checked && !o.checkpoints.delivered.checked).length;
    document.getElementById('deliveredOrders').textContent = orders.filter(o => o.checkpoints.delivered.checked).length;
}

function exportData() {
    const dataStr = JSON.stringify(orders, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dropshipping-orders-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importData() {
    document.getElementById('importFileInput').click();
}

function handleImport() {
    const file = document.getElementById('importFileInput').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedOrders = JSON.parse(e.target.result);
                if (Array.isArray(importedOrders)) {
                    if (confirm(`Import ${importedOrders.length} orders? This will replace your current data.`)) {
                        orders = importedOrders;
                        saveOrders();
                        renderOrders();
                        updateStats();
                        alert('Orders imported successfully!');
                    }
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

function filterOrders() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const orderCards = document.querySelectorAll('.order-card');

    orderCards.forEach(card => {
        const orderId = card.dataset.orderId;
        const order = orders.find(o => o.id === orderId);

        if (order) {
            const searchableText = `
                ${order.id}
                ${order.address}
                ${order.customerName || ''}
                ${order.checkpoints.reachedCountry.trackingNumber || ''}
            `.toLowerCase();

            if (searchableText.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}
