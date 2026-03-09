// Mock data for testing without a real database

export const mockUsers = [
    {
        id: 1,
        email: 'admin@admin.com',
        name: 'Admin User',
        role: 'admin',
        password: '$2b$10$okrdzkj8pcELrOKFn1ece.BsmK2PYwGcfX5O6X6SDQlzcl20PJQ4y', // hashed 'admin123'
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        emailVerifiedAt: new Date('2024-01-01'),
    },
    {
        id: 2,
        email: 'operator@example.com',
        name: 'Operator User',
        role: 'operator',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqhmM6JGKpS4G3R1G2JH8YpfB0Bqy',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        emailVerifiedAt: new Date('2024-01-01'),
    },
];

export const mockOrderImages = [
    { id: 1, orderId: 1, filename: 'order1_design.jpg', mime: 'image/jpeg', size: 1024000, createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01') },
    { id: 2, orderId: 2, filename: 'order2_fabric.jpg', mime: 'image/jpeg', size: 2048000, createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01') },
];

export const mockPayments = [
    { id: 1, orderId: 1, amount: 500.00, paymentDate: new Date('2025-03-01'), paymentMethod: 'cash', note: 'Advance payment', createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01') },
    { id: 2, orderId: 1, amount: 500.00, paymentDate: new Date('2025-03-05'), paymentMethod: 'upi', note: 'Second payment', createdAt: new Date('2025-03-05'), updatedAt: new Date('2025-03-05') },
    { id: 3, orderId: 2, amount: 2000.00, paymentDate: new Date('2025-03-02'), paymentMethod: 'online', note: 'Full payment', createdAt: new Date('2025-03-02'), updatedAt: new Date('2025-03-02') },
    { id: 4, orderId: 3, amount: 1800.00, paymentDate: new Date('2025-02-25'), paymentMethod: 'cash', note: 'Full payment', createdAt: new Date('2025-02-25'), updatedAt: new Date('2025-02-25') },
];

export const mockOrderLogs = [
    { id: 1, orderId: 1, userId: 1, action: 'created', note: 'Order created', createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01') },
    { id: 2, orderId: 1, userId: 1, action: 'updated', note: 'Payment received', createdAt: new Date('2025-03-05'), updatedAt: new Date('2025-03-05') },
    { id: 3, orderId: 2, userId: 1, action: 'created', note: 'Order created', createdAt: new Date('2025-03-01'), updatedAt: new Date('2025-03-01') },
    { id: 4, orderId: 3, userId: 1, action: 'created', note: 'Order created', createdAt: new Date('2025-02-20'), updatedAt: new Date('2025-02-20') },
    { id: 5, orderId: 3, userId: 1, action: 'delivered', note: 'Order delivered', createdAt: new Date('2025-02-28'), updatedAt: new Date('2025-02-28') },
];

export const mockOrders = [
    {
        id: 1,
        token: 'ORD-001',
        billNumber: 'BILL-001',
        customerName: 'John Doe',
        measurements: { chest: 40, waist: 32, length: 30 },
        deliveryDate: new Date('2025-03-15'),
        entryDate: new Date('2025-03-01'),
        actualDeliveryDate: null,
        status: 'pending',
        remarks: 'Urgent order',
        createdBy: 1,
        totalAmount: 1500.00,
        createdAt: new Date('2025-03-01'),
        updatedAt: new Date('2025-03-01'),
        images: [mockOrderImages[0]],
        payments: [mockPayments[0], mockPayments[1]],
    },
    {
        id: 2,
        token: 'ORD-002',
        billNumber: 'BILL-002',
        customerName: 'Jane Smith',
        measurements: { chest: 36, waist: 28, length: 28 },
        deliveryDate: new Date('2025-03-10'),
        entryDate: new Date('2025-03-01'),
        actualDeliveryDate: null,
        status: 'ready',
        remarks: 'Customer will pick up',
        createdBy: 1,
        totalAmount: 2000.00,
        createdAt: new Date('2025-03-01'),
        updatedAt: new Date('2025-03-02'),
        images: [mockOrderImages[1]],
        payments: [mockPayments[2]],
    },
    {
        id: 3,
        token: 'ORD-003',
        billNumber: 'BILL-003',
        customerName: 'Bob Johnson',
        measurements: { chest: 42, waist: 34, length: 32 },
        deliveryDate: new Date('2025-02-28'),
        entryDate: new Date('2025-02-20'),
        actualDeliveryDate: new Date('2025-02-28'),
        status: 'delivered',
        remarks: 'Delivered on time',
        createdBy: 1,
        totalAmount: 1800.00,
        createdAt: new Date('2025-02-20'),
        updatedAt: new Date('2025-02-28'),
        images: [],
        payments: [mockPayments[3]],
    },
    {
        id: 4,
        token: 'ORD-004',
        billNumber: 'BILL-004',
        customerName: 'Alice Brown',
        measurements: { chest: 38, waist: 30, length: 29 },
        deliveryDate: new Date('2025-03-20'),
        entryDate: new Date('2025-03-05'),
        actualDeliveryDate: null,
        status: 'transferred',
        remarks: 'Transferred to workshop B',
        createdBy: 2,
        totalAmount: 2200.00,
        createdAt: new Date('2025-03-05'),
        updatedAt: new Date('2025-03-06'),
        images: [],
        payments: [],
    },
];
