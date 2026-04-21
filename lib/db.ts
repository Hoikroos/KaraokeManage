// Simple in-memory database for development
// When you set up a real database (Supabase, Neon, etc), replace this with actual database calls

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  storeId?: string;
  createdAt: Date;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  pricePerHour: number;
  createdAt: Date;
}

export interface Room {
  id: string;
  storeId: string;
  roomNumber: string;
  capacity: number;
  status: 'empty' | 'occupied';
  pricePerHour: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: 'food' | 'drink' | 'dry' | 'cake';
  price: number;
  quantity: number;
  createdAt: Date;
}

export interface RoomSession {
  id: string;
  roomId: string;
  storeId: string;
  startTime: Date;
  StartTime?: Date; // Hỗ trợ PascalCase từ DB
  endTime?: Date;
  status: 'active' | 'completed' | 'paused' | 'pending' | 'cancelled';
  Status?: 'active' | 'completed' | 'paused' | 'pending' | 'cancelled'; // Hỗ trợ PascalCase từ DB
  createdAt: Date;
  updatedAt: Date;
  UpdatedAt?: Date; // Hỗ trợ PascalCase từ DB
  customerName?: string;
  CustomerName?: string;
}

export interface OrderItem {
  id: string;
  roomSessionId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  orderedAt: Date;
}

export interface Invoice {
  id: string;
  roomSessionId: string;
  storeId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  roomCost: number;
  items?: OrderItem[]; // Optional for database, but included for display
  totalPrice: number;
  status: 'pending' | 'paid';
  createdAt: Date;
  updatedAt: Date;
  customerName?: string;
}

// In-memory database storage
class Database {
  private users: User[] = [
    {
      id: '1',
      email: 'admin@karaoke.com',
      password: 'admin123', // In production, use hashed passwords
      name: 'Admin',
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: '2',
      email: 'user@karaoke.com',
      password: 'user123',
      name: 'Nhân viên',
      role: 'user',
      storeId: '1',
      createdAt: new Date(),
    },
  ];

  private stores: Store[] = [
    {
      id: '1',
      name: 'Karaoke Hà Nội',
      address: '123 Đường Lý Thái Tổ, Hoàn Kiếm, Hà Nội',
      phone: '024-1234-5678',
      pricePerHour: 100000,
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Karaoke Sài Gòn',
      address: '456 Nguyễn Huệ, Quận 1, TP.HCM',
      phone: '028-1234-5678',
      pricePerHour: 120000,
      createdAt: new Date(),
    },
  ];

  private rooms: Room[] = [
    {
      id: '1',
      storeId: '1',
      roomNumber: 'A01',
      capacity: 4,
      status: 'empty',
      pricePerHour: 100000,
      createdAt: new Date(),
    },
    {
      id: '2',
      storeId: '1',
      roomNumber: 'A02',
      capacity: 6,
      status: 'empty',
      pricePerHour: 120000,
      createdAt: new Date(),
    },
    {
      id: '3',
      storeId: '1',
      roomNumber: 'B01',
      capacity: 8,
      status: 'empty',
      pricePerHour: 150000,
      createdAt: new Date(),
    },
    {
      id: '4',
      storeId: '2',
      roomNumber: 'A01',
      capacity: 4,
      status: 'empty',
      pricePerHour: 120000,
      createdAt: new Date(),
    },
    {
      id: '5',
      storeId: '2',
      roomNumber: 'A02',
      capacity: 6,
      status: 'empty',
      pricePerHour: 140000,
      createdAt: new Date(),
    },
  ];

  private products: Product[] = [
    {
      id: '1',
      storeId: '1',
      name: 'Bia Heineken',
      category: 'drink',
      price: 50000,
      quantity: 20,
      createdAt: new Date(),
    },
    {
      id: '2',
      storeId: '1',
      name: 'Coca Cola',
      category: 'drink',
      price: 20000,
      quantity: 30,
      createdAt: new Date(),
    },
    {
      id: '3',
      storeId: '1',
      name: 'Gỏi Cuốn',
      category: 'food',
      price: 80000,
      quantity: 15,
      createdAt: new Date(),
    },
    {
      id: '4',
      storeId: '1',
      name: 'Đũa Nước',
      category: 'food',
      price: 150000,
      quantity: 10,
      createdAt: new Date(),
    },
    {
      id: '5',
      storeId: '1',
      name: 'Khô gà lá chanh',
      category: 'dry',
      price: 50000,
      quantity: 20,
      createdAt: new Date(),
    },
    {
      id: '7',
      storeId: '1',
      name: 'Bánh bông lan',
      category: 'cake',
      price: 60000,
      quantity: 12,
      createdAt: new Date(),
    },
    {
      id: '8',
      storeId: '2',
      name: 'Bia Tiger',
      category: 'drink',
      price: 45000,
      quantity: 18,
      createdAt: new Date(),
    },
  ];

  private roomSessions: RoomSession[] = [];
  private orderItems: OrderItem[] = [];
  private invoices: Invoice[] = [];

  // User methods
  getUserByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email);
  }

  getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  getAllUsers(): User[] {
    return this.users;
  }

  addUser(user: User): User {
    this.users.push(user);
    return user;
  }

  updateUser(id: string, data: Partial<User>): User | undefined {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      Object.assign(user, data);
    }
    return user;
  }

  deleteUser(id: string): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index > -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  // Store methods
  getStoreById(id: string): Store | undefined {
    return this.stores.find((s) => s.id === id);
  }

  getAllStores(): Store[] {
    return this.stores;
  }

  addStore(store: Store): Store {
    this.stores.push(store);
    return store;
  }

  updateStore(id: string, data: Partial<Store>): Store | undefined {
    const store = this.stores.find((s) => s.id === id);
    if (store) {
      Object.assign(store, data);
    }
    return store;
  }

  deleteStore(id: string): boolean {
    const index = this.stores.findIndex((s) => s.id === id);
    if (index > -1) {
      this.stores.splice(index, 1);
    }
    return false;
  }

  // Room methods
  getRoomById(id: string): Room | undefined {
    return this.rooms.find((r) => r.id === id);
  }

  getRoomsByStoreId(storeId: string): Room[] {
    return this.rooms.filter((r) => r.storeId === storeId);
  }

  getAllRooms(): Room[] {
    return this.rooms;
  }

  addRoom(room: Room): Room {
    this.rooms.push(room);
    return room;
  }

  updateRoom(id: string, data: Partial<Room>): Room | undefined {
    const room = this.rooms.find((r) => r.id === id);
    if (room) {
      Object.assign(room, data);
    }
    return room;
  }

  deleteRoom(id: string): boolean {
    const index = this.rooms.findIndex((r) => r.id === id);
    if (index > -1) {
      this.rooms.splice(index, 1);
      return true;
    }
    return false;
  }

  // Product methods
  getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  getProductsByStoreId(storeId: string): Product[] {
    return this.products.filter((p) => p.storeId === storeId);
  }

  getAllProducts(): Product[] {
    return this.products;
  }

  addProduct(product: Product): Product {
    this.products.push(product);
    return product;
  }

  updateProduct(id: string, data: Partial<Product>): Product | undefined {
    const product = this.products.find((p) => p.id === id);
    if (product) {
      Object.assign(product, data);
    }
    return product;
  }

  updateProductStock(id: string, delta: number): Product | undefined {
    const product = this.products.find((p) => p.id === id);
    if (!product) return undefined;
    product.quantity = Math.max(0, product.quantity + delta);
    return product;
  }

  deleteProduct(id: string): boolean {
    const index = this.products.findIndex((p) => p.id === id);
    if (index > -1) {
      this.products.splice(index, 1);
      return true;
    }
    return false;
  }

  // Room Session methods
  startRoomSession(roomId: string, storeId: string): RoomSession {
    const session: RoomSession = {
      id: Date.now().toString(),
      roomId,
      storeId,
      startTime: new Date(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roomSessions.push(session);
    this.updateRoom(roomId, { status: 'occupied' });
    return session;
  }

  getRoomSessionById(id: string): RoomSession | undefined {
    return this.roomSessions.find((s) => s.id === id);
  }

  getRoomSessionByRoomId(roomId: string): RoomSession | undefined {
    return this.roomSessions.find((s) => s.roomId === roomId && s.status === 'active');
  }

  // Order Item methods
  addOrderItem(item: OrderItem): OrderItem {
    this.orderItems.push(item);
    return item;
  }

  updateOrderItem(itemId: string, quantity: number): OrderItem | undefined {
    const item = this.orderItems.find((order) => order.id === itemId);
    if (!item) return undefined;
    item.quantity = quantity;
    return item;
  }

  removeOrderItem(itemId: string): boolean {
    const index = this.orderItems.findIndex((order) => order.id === itemId);
    if (index === -1) return false;
    this.orderItems.splice(index, 1);
    return true;
  }

  getOrderItemById(itemId: string): OrderItem | undefined {
    return this.orderItems.find((item) => item.id === itemId);
  }

  getOrderItemsBySessionId(sessionId: string): OrderItem[] {
    return this.orderItems.filter((item) => item.roomSessionId === sessionId);
  }

  getAllOrderItems(): OrderItem[] {
    return this.orderItems;
  }

  // Invoice methods
  createInvoice(invoice: Invoice): Invoice {
    this.invoices.push(invoice);
    return invoice;
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices.find((inv) => inv.id === id);
  }

  getInvoicesByStoreId(storeId: string): Invoice[] {
    return this.invoices.filter((inv) => inv.storeId === storeId);
  }

  getAllInvoices(): Invoice[] {
    return this.invoices;
  }

  getRevenueByStore(storeId: string): { date: string; revenue: number }[] {
    const invoices = this.getInvoicesByStoreId(storeId).filter((inv) => inv.status === 'paid');
    const revenueMap = new Map<string, number>();

    invoices.forEach((inv) => {
      const date = inv.createdAt.toISOString().split('T')[0];
      const current = revenueMap.get(date) || 0;
      revenueMap.set(date, current + inv.totalPrice);
    });

    return Array.from(revenueMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }
}

// Export singleton instance
export const db = new Database();
