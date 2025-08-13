# Notification System

## Notification Architecture

### Core Components
- **Push Notification Service** (`app/utils/pushNotificationService.ts`)
- **Notification Context** (`app/context/NotificationContext.tsx`)
- **Backend Notification Service** (`backend/src/services/notificationService.ts`)
- **Notification Routes** (role-specific notification endpoints)
- **Socket.IO Integration** (real-time notifications)

### Notification Types
```typescript
interface NotificationTypes {
  // Expense-related notifications
  'expense-approval': 'Expense approved by group admin';
  'expense-rejection': 'Expense rejected by group admin';
  'expense-submitted': 'New expense submitted for approval';
  
  // Leave-related notifications
  'leave-approval': 'Leave request approved';
  'leave-rejection': 'Leave request rejected';
  'leave-submitted': 'New leave request submitted';
  'leave-escalation': 'Leave request escalated to management';
  
  // Shift-related notifications
  'shift-reminder': 'Shift start/end reminders';
  'geofence-entry': 'Employee entered geofenced area';
  'geofence-exit': 'Employee exited geofenced area';
  
  // Task-related notifications
  'task-assigned': 'New task assigned';
  'task-updated': 'Task status updated';
  'task-overdue': 'Task is overdue';
  
  // System notifications
  'system-maintenance': 'System maintenance notifications';
  'policy-update': 'Company policy updates';
  'account-update': 'Account-related updates';
}
```

## Push Notification Implementation

### Expo Push Notification Setup
```typescript
// Push notification service initialization
class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;
  
  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }
  
  async initialize(): Promise<void> {
    try {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }
      
      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      this.expoPushToken = token.data;
      
      // Configure notification handling
      await this.configureNotificationHandling();
      
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }
  
  private async configureNotificationHandling(): Promise<void> {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    
    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
    
    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);
  }
  
  private handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    
    // Update notification context
    const notificationContext = useNotifications();
    notificationContext.incrementUnreadCount();
    
    // Show in-app notification if needed
    this.showInAppNotification(notification);
  };
  
  private handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const { notification } = response;
    const data = notification.request.content.data;
    
    // Navigate to relevant screen based on notification data
    if (data?.screen) {
      router.push(data.screen);
    }
  };
}
```

### Device Token Management
```typescript
// Register device token with backend
const registerDeviceToken = async (token: string, userId: string, role: string) => {
  try {
    const deviceInfo = {
      token,
      device_type: Platform.OS as 'ios' | 'android',
      device_name: await Device.deviceName || 'Unknown Device',
    };
    
    const endpoint = `${API_URL}/api/${role}-notifications/register-device`;
    
    await axios.post(endpoint, deviceInfo, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    // Store token locally for reference
    await AsyncStorage.setItem('expoPushToken', token);
    await AsyncStorage.setItem('pushTokenLastRegistered', Date.now().toString());
    
  } catch (error) {
    console.error('Error registering device token:', error);
  }
};

// Unregister device token (on logout)
const unregisterDeviceToken = async (token: string, role: string) => {
  try {
    const endpoint = `${API_URL}/api/${role}-notifications/unregister-device`;
    
    await axios.delete(endpoint, {
      data: { token },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    // Clear local storage
    await AsyncStorage.removeItem('expoPushToken');
    await AsyncStorage.removeItem('pushTokenLastRegistered');
    
  } catch (error) {
    console.error('Error unregistering device token:', error);
  }
};
```

## Backend Notification Service

### Notification Service Implementation
```typescript
class NotificationService {
  // Create in-app notification
  static async createInAppNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    data?: any
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [userId, title, message, type]);
      
    } finally {
      client.release();
    }
  }
  
  // Send push notification
  static async sendPushNotification(
    notification: PushNotificationData,
    userIds: string[]
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Get device tokens for users
      const tokensResult = await client.query(`
        SELECT DISTINCT dt.token, dt.device_type
        FROM device_tokens dt
        WHERE dt.user_id = ANY($1) AND dt.is_active = true
      `, [userIds]);
      
      if (tokensResult.rows.length === 0) {
        console.log('No active device tokens found for users:', userIds);
        return;
      }
      
      // Create push notification records
      for (const userId of userIds) {
        await client.query(`
          INSERT INTO push_notifications (
            user_id, title, message, data, type, priority, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          userId,
          notification.title,
          notification.message,
          JSON.stringify(notification.data || {}),
          notification.type,
          notification.priority || 'default'
        ]);
      }
      
      // Send to Expo Push API
      const messages = tokensResult.rows.map(row => ({
        to: row.token,
        title: notification.title,
        body: notification.message,
        data: notification.data || {},
        priority: notification.priority === 'high' ? 'high' : 'default',
        sound: 'default',
        badge: 1,
      }));
      
      await this.sendToExpoPushAPI(messages);
      
    } finally {
      client.release();
    }
  }
  
  private static async sendToExpoPushAPI(messages: any[]): Promise<void> {
    try {
      const expo = new Expo();
      
      // Filter out invalid tokens
      const validMessages = messages.filter(message => 
        Expo.isExpoPushToken(message.to)
      );
      
      if (validMessages.length === 0) {
        console.log('No valid push tokens found');
        return;
      }
      
      // Send notifications in chunks
      const chunks = expo.chunkPushNotifications(validMessages);
      const tickets = [];
      
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }
      
      // Handle receipts (optional - for delivery confirmation)
      await this.handlePushReceipts(expo, tickets);
      
    } catch (error) {
      console.error('Error in sendToExpoPushAPI:', error);
    }
  }
  
  private static async handlePushReceipts(expo: Expo, tickets: any[]): Promise<void> {
    // Extract receipt IDs
    const receiptIds = tickets
      .filter(ticket => ticket.status === 'ok')
      .map(ticket => ticket.id);
    
    if (receiptIds.length === 0) return;
    
    try {
      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      
      for (const chunk of receiptIdChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        
        // Process receipts and handle errors
        for (const receiptId in receipts) {
          const receipt = receipts[receiptId];
          
          if (receipt.status === 'error') {
            console.error('Push notification error:', receipt.message);
            
            // Handle specific errors (e.g., invalid token)
            if (receipt.details?.error === 'DeviceNotRegistered') {
              await this.deactivateDeviceToken(receiptId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling push receipts:', error);
    }
  }
}
```

### Role-Based Notification Endpoints
```typescript
// Employee notifications
router.post('/employee-notifications/register-device', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { token, device_type, device_name } = req.body;
    const userId = req.user?.id;
    
    // Deactivate existing tokens for this user/device
    await client.query(`
      UPDATE device_tokens 
      SET is_active = false 
      WHERE user_id = $1 AND device_type = $2
    `, [userId, device_type]);
    
    // Insert new token
    await client.query(`
      INSERT INTO device_tokens (user_id, token, device_type, device_name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (user_id, token) 
      DO UPDATE SET 
        is_active = true,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, token, device_type, device_name]);
    
    res.json({ message: 'Device token registered successfully' });
    
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  } finally {
    client.release();
  }
});

// Get notifications for user
router.get('/employee-notifications', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const result = await client.query(`
      SELECT 
        id, title, message, type, read, created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    // Get total count
    const countResult = await client.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count)
    });
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  } finally {
    client.release();
  }
});
```

## Database Schema

### Notification Tables
```sql
-- In-app notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push notifications
CREATE TABLE push_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'default' CHECK (priority IN ('high', 'default', 'low')),
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(255),
  category VARCHAR(50),
  expires_at TIMESTAMP WITH TIME ZONE,
  batch_id VARCHAR(255),
  template_id INTEGER
);

-- Device tokens for push notifications
CREATE TABLE device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  device_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token)
);

-- Notification templates
CREATE TABLE notification_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'default',
  data JSONB DEFAULT '{}',
  variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Push notification receipts
CREATE TABLE push_receipts (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES push_notifications(id),
  receipt_id VARCHAR(36) NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB
);
```

## Real-Time Notifications with Socket.IO

### Socket Integration
```typescript
// Socket service for real-time notifications
class SocketNotificationService {
  private io: Server;
  
  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);
      
      // Join user-specific room
      socket.on('join_user_room', (userId: string) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their notification room`);
      });
      
      // Join company room for company-wide notifications
      socket.on('join_company_room', (companyId: string) => {
        socket.join(`company_${companyId}`);
        console.log(`User joined company ${companyId} room`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  // Send real-time notification to specific user
  sendToUser(userId: string, notification: any): void {
    this.io.to(`user_${userId}`).emit('notification', notification);
  }
  
  // Send notification to all users in a company
  sendToCompany(companyId: string, notification: any): void {
    this.io.to(`company_${companyId}`).emit('notification', notification);
  }
  
  // Send notification to specific role within company
  sendToRole(companyId: string, role: string, notification: any): void {
    this.io.to(`company_${companyId}_${role}`).emit('notification', notification);
  }
}
```

### Frontend Socket Integration
```typescript
// Socket connection in React Native
const useSocketNotifications = () => {
  const { user } = useAuth();
  const { incrementUnreadCount } = useNotifications();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    if (!user) return;
    
    // Initialize socket connection
    const newSocket = io(API_URL);
    setSocket(newSocket);
    
    // Join user-specific room
    newSocket.emit('join_user_room', user.id);
    
    // Join company room if applicable
    if (user.company_id) {
      newSocket.emit('join_company_room', user.company_id);
    }
    
    // Listen for notifications
    newSocket.on('notification', (notification) => {
      console.log('Real-time notification received:', notification);
      
      // Update unread count
      incrementUnreadCount();
      
      // Show in-app notification
      showInAppNotification(notification);
      
      // Navigate if needed
      if (notification.action_url) {
        // Handle navigation based on notification data
      }
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [user]);
  
  return socket;
};
```

## Notification Templates & Scheduling

### Template System
```typescript
// Notification template processing
const processNotificationTemplate = (
  template: NotificationTemplate,
  variables: Record<string, any>
) => {
  let title = template.title;
  let message = template.message;
  
  // Replace variables in template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    title = title.replace(new RegExp(placeholder, 'g'), String(value));
    message = message.replace(new RegExp(placeholder, 'g'), String(value));
  }
  
  return {
    title,
    message,
    type: template.type,
    priority: template.priority,
    data: { ...template.data, ...variables }
  };
};

// Scheduled notifications
const scheduleNotification = async (
  templateId: number,
  variables: Record<string, any>,
  scheduledFor: Date,
  targetUsers: string[]
) => {
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO scheduled_notifications (
        template_id, variables, scheduled_for, target_users, status
      ) VALUES ($1, $2, $3, $4, 'pending')
    `, [templateId, JSON.stringify(variables), scheduledFor, targetUsers]);
    
  } finally {
    client.release();
  }
};
```

This notification system provides comprehensive push notifications, in-app notifications, and real-time updates across all user roles and features.