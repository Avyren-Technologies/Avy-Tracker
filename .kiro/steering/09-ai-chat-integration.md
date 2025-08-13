# AI Chat Integration System

## AI Chat Architecture

### Core Components
- **Google Gemini AI Integration** (`@google/generative-ai`)
- **Chat Routes** (`backend/src/routes/chat.ts`)
- **Live Chat Component** (`app/(dashboard)/employee/settings/LiveChat/`)
- **Chat Message Storage** (`chat_messages` table)
- **Context-Aware Responses** (role-based AI assistance)

### AI Integration Setup
```typescript
// Google Gemini AI configuration
import { GoogleGenerativeAI } from '@google/generative-ai';

class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }
  
  async generateResponse(
    message: string,
    context: ChatContext,
    userRole: string
  ): Promise<string> {
    try {
      // Build context-aware prompt
      const prompt = this.buildContextualPrompt(message, context, userRole);
      
      // Generate response
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
      
    } catch (error) {
      console.error('AI response generation error:', error);
      return this.getFallbackResponse(userRole);
    }
  }
  
  private buildContextualPrompt(
    message: string,
    context: ChatContext,
    userRole: string
  ): string {
    const systemPrompt = this.getSystemPrompt(userRole);
    const contextInfo = this.formatContext(context);
    
    return `${systemPrompt}

Context Information:
${contextInfo}

User Message: ${message}

Please provide a helpful, accurate response based on the context and user's role.`;
  }
  
  private getSystemPrompt(userRole: string): string {
    const basePrompt = `You are an AI assistant for Avy Tracker, a workforce management platform. 
You help users with questions about attendance tracking, expense management, leave requests, and general platform usage.
Always be professional, helpful, and concise in your responses.`;
    
    switch (userRole) {
      case 'employee':
        return `${basePrompt}
        
You are specifically helping an employee user. Focus on:
- How to submit expenses and track approval status
- How to apply for leave and check balances
- How to start/end shifts and track attendance
- How to view personal performance metrics
- How to update profile information
- General troubleshooting for employee features`;
        
      case 'group-admin':
        return `${basePrompt}
        
You are specifically helping a group admin user. Focus on:
- How to approve/reject employee expenses and leave requests
- How to manage team members and view team analytics
- How to create and manage geofences
- How to assign tasks to employees
- How to generate team reports
- How to configure team settings and permissions`;
        
      case 'management':
        return `${basePrompt}
        
You are specifically helping a management user. Focus on:
- How to view company-wide analytics and reports
- How to manage group admins and their teams
- How to handle escalated leave requests and expenses
- How to configure company policies and settings
- How to monitor overall company performance
- Strategic insights and recommendations`;
        
      case 'super-admin':
        return `${basePrompt}
        
You are specifically helping a super admin user. Focus on:
- How to manage multiple companies and their settings
- How to configure system-wide settings and security
- How to monitor platform health and performance
- How to manage user limits and subscriptions
- How to handle technical issues and system maintenance
- Platform administration and troubleshooting`;
        
      default:
        return basePrompt;
    }
  }
  
  private formatContext(context: ChatContext): string {
    let contextStr = '';
    
    if (context.userInfo) {
      contextStr += `User: ${context.userInfo.name} (${context.userInfo.role})\n`;
      if (context.userInfo.department) {
        contextStr += `Department: ${context.userInfo.department}\n`;
      }
    }
    
    if (context.recentActivity) {
      contextStr += `Recent Activity:\n`;
      context.recentActivity.forEach(activity => {
        contextStr += `- ${activity.type}: ${activity.description}\n`;
      });
    }
    
    if (context.currentStats) {
      contextStr += `Current Stats:\n`;
      Object.entries(context.currentStats).forEach(([key, value]) => {
        contextStr += `- ${key}: ${value}\n`;
      });
    }
    
    return contextStr;
  }
  
  private getFallbackResponse(userRole: string): string {
    const fallbacks = {
      employee: "I'm here to help you with Avy Tracker! You can ask me about submitting expenses, applying for leave, tracking your shifts, or viewing your performance metrics. What would you like to know?",
      'group-admin': "I can help you manage your team in Avy Tracker! Ask me about approving expenses, managing leave requests, viewing team analytics, or configuring team settings.",
      management: "I'm here to assist with company-wide management tasks! You can ask about analytics, managing group admins, handling escalations, or configuring company policies.",
      'super-admin': "I can help with platform administration! Ask me about managing companies, system configuration, monitoring platform health, or troubleshooting technical issues."
    };
    
    return fallbacks[userRole as keyof typeof fallbacks] || fallbacks.employee;
  }
}
```

## Chat Context System

### Context Data Collection
```typescript
interface ChatContext {
  userInfo: {
    id: number;
    name: string;
    role: string;
    department?: string;
    employee_number?: string;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
  currentStats: {
    active_shifts?: number;
    pending_expenses?: number;
    pending_leaves?: number;
    team_size?: number;
    [key: string]: any;
  };
  conversationHistory: Array<{
    message: string;
    response: string;
    timestamp: Date;
  }>;
}

// Context collection service
class ChatContextService {
  static async collectUserContext(userId: number, userRole: string): Promise<ChatContext> {
    const client = await pool.connect();
    
    try {
      // Get user information
      const userResult = await client.query(`
        SELECT id, name, role, department, employee_number, designation
        FROM users WHERE id = $1
      `, [userId]);
      
      const userInfo = userResult.rows[0];
      
      // Collect role-specific context
      let recentActivity: any[] = [];
      let currentStats: any = {};
      
      switch (userRole) {
        case 'employee':
          ({ recentActivity, currentStats } = await this.getEmployeeContext(client, userId));
          break;
        case 'group-admin':
          ({ recentActivity, currentStats } = await this.getGroupAdminContext(client, userId));
          break;
        case 'management':
          ({ recentActivity, currentStats } = await this.getManagementContext(client, userId));
          break;
        case 'super-admin':
          ({ recentActivity, currentStats } = await this.getSuperAdminContext(client, userId));
          break;
      }
      
      // Get recent conversation history
      const conversationResult = await client.query(`
        SELECT message, response, created_at
        FROM chat_messages
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [userId]);
      
      const conversationHistory = conversationResult.rows.map(row => ({
        message: row.message,
        response: row.response,
        timestamp: row.created_at
      }));
      
      return {
        userInfo,
        recentActivity,
        currentStats,
        conversationHistory
      };
      
    } finally {
      client.release();
    }
  }
  
  private static async getEmployeeContext(client: any, userId: number) {
    // Recent activity for employees
    const activityResult = await client.query(`
      SELECT 'shift' as type, 
             CASE 
               WHEN status = 'active' THEN 'Started shift'
               WHEN status = 'completed' THEN 'Completed shift'
             END as description,
             start_time as timestamp
      FROM employee_shifts
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 3
      
      UNION ALL
      
      SELECT 'expense' as type,
             'Submitted expense: ₹' || total_amount::text as description,
             created_at as timestamp
      FROM expenses
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 2
    `, [userId]);
    
    // Current stats for employees
    const statsResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN es.status = 'active' THEN 1 END) as active_shifts,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_expenses,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_leaves,
        COALESCE(SUM(CASE WHEN e.status = 'approved' AND EXTRACT(MONTH FROM e.date) = EXTRACT(MONTH FROM CURRENT_DATE) THEN e.total_amount ELSE 0 END), 0) as monthly_approved_expenses
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id
      LEFT JOIN expenses e ON u.id = e.user_id
      LEFT JOIN leave_requests lr ON u.id = lr.user_id
      WHERE u.id = $1
    `, [userId]);
    
    return {
      recentActivity: activityResult.rows,
      currentStats: statsResult.rows[0]
    };
  }
  
  private static async getGroupAdminContext(client: any, userId: number) {
    // Recent activity for group admins
    const activityResult = await client.query(`
      SELECT 'expense_approval' as type,
             'Approved expense for ' || u.name as description,
             e.updated_at as timestamp
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE u.group_admin_id = $1 AND e.status = 'approved'
      ORDER BY e.updated_at DESC
      LIMIT 5
    `, [userId]);
    
    // Current stats for group admins
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT emp.id) as team_size,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_expense_approvals,
        COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_leave_approvals,
        COUNT(CASE WHEN es.status = 'active' THEN 1 END) as active_team_shifts
      FROM users emp
      LEFT JOIN expenses e ON emp.id = e.user_id
      LEFT JOIN leave_requests lr ON emp.id = lr.user_id
      LEFT JOIN employee_shifts es ON emp.id = es.user_id
      WHERE emp.group_admin_id = $1 AND emp.role = 'employee'
    `, [userId]);
    
    return {
      recentActivity: activityResult.rows,
      currentStats: statsResult.rows[0]
    };
  }
  
  private static async getManagementContext(client: any, userId: number) {
    // Get company ID for management user
    const companyResult = await client.query(`
      SELECT company_id FROM users WHERE id = $1
    `, [userId]);
    
    const companyId = companyResult.rows[0]?.company_id;
    
    if (!companyId) {
      return { recentActivity: [], currentStats: {} };
    }
    
    // Recent activity for management
    const activityResult = await client.query(`
      SELECT 'leave_escalation' as type,
             'Leave request escalated from ' || u.name as description,
             lr.updated_at as timestamp
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE u.company_id = $1 AND lr.status = 'escalated'
      ORDER BY lr.updated_at DESC
      LIMIT 5
    `, [companyId]);
    
    // Current stats for management
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) as total_employees,
        COUNT(DISTINCT CASE WHEN u.role = 'group-admin' THEN u.id END) as total_group_admins,
        COUNT(CASE WHEN lr.status = 'escalated' THEN 1 END) as escalated_leaves,
        COALESCE(SUM(CASE WHEN e.status = 'approved' AND EXTRACT(MONTH FROM e.date) = EXTRACT(MONTH FROM CURRENT_DATE) THEN e.total_amount ELSE 0 END), 0) as monthly_company_expenses
      FROM users u
      LEFT JOIN expenses e ON u.id = e.user_id
      LEFT JOIN leave_requests lr ON u.id = lr.user_id
      WHERE u.company_id = $1
    `, [companyId]);
    
    return {
      recentActivity: activityResult.rows,
      currentStats: statsResult.rows[0]
    };
  }
  
  private static async getSuperAdminContext(client: any, userId: number) {
    // Recent activity for super admin
    const activityResult = await client.query(`
      SELECT 'company_creation' as type,
             'New company created: ' || name as description,
             created_at as timestamp
      FROM companies
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    // Current stats for super admin
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_companies,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_companies,
        COUNT(CASE WHEN status = 'disabled' THEN 1 END) as disabled_companies,
        COALESCE(SUM(user_limit), 0) as total_user_capacity,
        COALESCE(SUM(pending_users), 0) as total_pending_users
      FROM companies
    `);
    
    return {
      recentActivity: activityResult.rows,
      currentStats: statsResult.rows[0]
    };
  }
}
```

## Chat Backend Implementation

### Chat Routes and Message Handling
```typescript
// Chat routes implementation
import express, { Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import AIService from '../services/aiService';
import ChatContextService from '../services/chatContextService';

const router = express.Router();
const aiService = new AIService();

// Send message to AI and get response
router.post('/message', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { message } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!message || !userId || !userRole) {
      return res.status(400).json({ error: 'Message, user ID, and role are required' });
    }
    
    // Collect user context for better AI responses
    const context = await ChatContextService.collectUserContext(userId, userRole);
    
    // Generate AI response
    const aiResponse = await aiService.generateResponse(message, context, userRole);
    
    // Store conversation in database
    await client.query(`
      INSERT INTO chat_messages (user_id, message, response, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [userId, message, aiResponse]);
    
    res.json({
      message: message,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      response: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.'
    });
  } finally {
    client.release();
  }
});

// Get chat history
router.get('/history', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await client.query(`
      SELECT message, response, created_at
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    res.json({
      conversations: result.rows.reverse(), // Reverse to show oldest first
      hasMore: result.rows.length === limit
    });
    
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  } finally {
    client.release();
  }
});

// Clear chat history
router.delete('/history', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user?.id;
    
    await client.query(`
      DELETE FROM chat_messages WHERE user_id = $1
    `, [userId]);
    
    res.json({ message: 'Chat history cleared successfully' });
    
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  } finally {
    client.release();
  }
});

export default router;
```

## Frontend Chat Implementation

### Live Chat Component
```typescript
// Live Chat React Native component
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import ThemeContext from '../../../context/ThemeContext';

interface ChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: string;
  isUser: boolean;
}

export default function LiveChat() {
  const { user, token } = useAuth();
  const { theme } = ThemeContext.useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const colors = {
    light: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      primary: '#3B82F6',
      text: '#0F172A',
      textSecondary: '#475569',
      border: '#E2E8F0',
      userMessage: '#3B82F6',
      aiMessage: '#F1F5F9',
      userMessageText: '#FFFFFF',
      aiMessageText: '#0F172A'
    },
    dark: {
      background: '#0F172A',
      surface: '#1E293B',
      primary: '#60A5FA',
      text: '#F8FAFC',
      textSecondary: '#CBD5E1',
      border: '#334155',
      userMessage: '#60A5FA',
      aiMessage: '#334155',
      userMessageText: '#FFFFFF',
      aiMessageText: '#F8FAFC'
    }
  };
  
  const currentColors = colors[theme];
  
  useEffect(() => {
    loadChatHistory();
    
    // Add welcome message
    const welcomeMessage = getWelcomeMessage(user?.role || 'employee');
    setMessages([{
      id: 'welcome',
      message: '',
      response: welcomeMessage,
      timestamp: new Date().toISOString(),
      isUser: false
    }]);
  }, []);
  
  const getWelcomeMessage = (role: string): string => {
    const welcomeMessages = {
      employee: "👋 Hi! I'm your Avy Tracker assistant. I can help you with:\n\n• Submitting and tracking expenses\n• Applying for leave and checking balances\n• Managing your shifts and attendance\n• Viewing your performance metrics\n• Updating your profile\n\nWhat would you like to know?",
      'group-admin': "👋 Hello! I'm here to help you manage your team. I can assist with:\n\n• Approving expenses and leave requests\n• Viewing team analytics and performance\n• Managing geofences and team settings\n• Assigning tasks to team members\n• Generating team reports\n\nHow can I help you today?",
      management: "👋 Welcome! I can help you with company management tasks:\n\n• Viewing company-wide analytics\n• Managing group admins and teams\n• Handling escalated requests\n• Configuring company policies\n• Strategic insights and recommendations\n\nWhat would you like to explore?",
      'super-admin': "👋 Hello! I'm here to assist with platform administration:\n\n• Managing companies and users\n• System configuration and security\n• Platform health monitoring\n• Troubleshooting technical issues\n• User limits and subscriptions\n\nHow can I help you today?"
    };
    
    return welcomeMessages[role as keyof typeof welcomeMessages] || welcomeMessages.employee;
  };
  
  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/chat/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 }
      });
      
      const history = response.data.conversations.map((conv: any, index: number) => [
        {
          id: `user-${index}`,
          message: conv.message,
          response: '',
          timestamp: conv.created_at,
          isUser: true
        },
        {
          id: `ai-${index}`,
          message: '',
          response: conv.response,
          timestamp: conv.created_at,
          isUser: false
        }
      ]).flat();
      
      setMessages(prev => [...prev, ...history]);
      
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      message: inputMessage,
      response: '',
      timestamp: new Date().toISOString(),
      isUser: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/chat/message`,
        { message: inputMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        message: '',
        response: response.data.response,
        timestamp: response.data.timestamp,
        isUser: false
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: '',
        response: 'I apologize, but I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date().toISOString(),
        isUser: false
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearHistory = async () => {
    try {
      await axios.delete(`${process.env.EXPO_PUBLIC_API_URL}/api/chat/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const welcomeMessage = getWelcomeMessage(user?.role || 'employee');
      setMessages([{
        id: 'welcome-new',
        message: '',
        response: welcomeMessage,
        timestamp: new Date().toISOString(),
        isUser: false
      }]);
      
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };
  
  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);
  
  if (isLoadingHistory) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: currentColors.background
      }}>
        <ActivityIndicator size="large" color={currentColors.primary} />
        <Text style={{ color: currentColors.text, marginTop: 16 }}>
          Loading chat history...
        </Text>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: currentColors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: currentColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: currentColors.border
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: currentColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12
          }}>
            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          </View>
          <View>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: currentColors.text
            }}>
              AI Assistant
            </Text>
            <Text style={{
              fontSize: 12,
              color: currentColors.textSecondary
            }}>
              Always here to help
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          onPress={clearHistory}
          style={{
            padding: 8,
            borderRadius: 8,
            backgroundColor: currentColors.border
          }}
        >
          <Ionicons name="trash-outline" size={20} color={currentColors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              marginBottom: 12
            }}
          >
            <View style={{
              backgroundColor: msg.isUser ? currentColors.userMessage : currentColors.aiMessage,
              padding: 12,
              borderRadius: 16,
              borderBottomRightRadius: msg.isUser ? 4 : 16,
              borderBottomLeftRadius: msg.isUser ? 16 : 4
            }}>
              <Text style={{
                color: msg.isUser ? currentColors.userMessageText : currentColors.aiMessageText,
                fontSize: 14,
                lineHeight: 20
              }}>
                {msg.isUser ? msg.message : msg.response}
              </Text>
            </View>
            <Text style={{
              fontSize: 10,
              color: currentColors.textSecondary,
              marginTop: 4,
              textAlign: msg.isUser ? 'right' : 'left'
            }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        ))}
        
        {isLoading && (
          <View style={{
            alignSelf: 'flex-start',
            maxWidth: '80%',
            marginBottom: 12
          }}>
            <View style={{
              backgroundColor: currentColors.aiMessage,
              padding: 12,
              borderRadius: 16,
              borderBottomLeftRadius: 4,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              <ActivityIndicator size="small" color={currentColors.primary} />
              <Text style={{
                color: currentColors.aiMessageText,
                fontSize: 14,
                marginLeft: 8
              }}>
                Thinking...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Input */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: currentColors.surface,
        borderTopWidth: 1,
        borderTopColor: currentColors.border
      }}>
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: currentColors.border,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginRight: 12,
            backgroundColor: currentColors.background,
            color: currentColors.text,
            fontSize: 14
          }}
          placeholder="Ask me anything about Avy Tracker..."
          placeholderTextColor={currentColors.textSecondary}
          value={inputMessage}
          onChangeText={setInputMessage}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: inputMessage.trim() && !isLoading ? currentColors.primary : currentColors.border,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={inputMessage.trim() && !isLoading ? 'white' : currentColors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

## Database Schema

### Chat Messages Table
```sql
-- Chat messages storage
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_chat_messages_user_id_created_at ON chat_messages(user_id, created_at DESC);
```

## AI Response Enhancement

### Specialized Response Handlers
```typescript
// Specialized AI response handlers for different query types
class SpecializedResponseHandler {
  static async handleExpenseQuery(message: string, context: ChatContext): Promise<string> {
    const expenseKeywords = ['expense', 'submit', 'receipt', 'reimbursement', 'travel', 'fuel'];
    
    if (expenseKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      const pendingExpenses = context.currentStats.pending_expenses || 0;
      
      let response = "I can help you with expense management! ";
      
      if (pendingExpenses > 0) {
        response += `You currently have ${pendingExpenses} pending expense(s) awaiting approval. `;
      }
      
      response += "Here's what you can do:\n\n";
      response += "• Submit new expenses with receipts\n";
      response += "• Track approval status of submitted expenses\n";
      response += "• View your expense history and analytics\n";
      response += "• Upload additional documents if needed\n\n";
      response += "Would you like me to guide you through submitting a new expense?";
      
      return response;
    }
    
    return '';
  }
  
  static async handleLeaveQuery(message: string, context: ChatContext): Promise<string> {
    const leaveKeywords = ['leave', 'vacation', 'sick', 'holiday', 'time off', 'absence'];
    
    if (leaveKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      const pendingLeaves = context.currentStats.pending_leaves || 0;
      
      let response = "I can help you with leave management! ";
      
      if (pendingLeaves > 0) {
        response += `You have ${pendingLeaves} pending leave request(s). `;
      }
      
      response += "Here's what you can do:\n\n";
      response += "• Apply for different types of leave (EL, SL, ML, CL)\n";
      response += "• Check your leave balances and entitlements\n";
      response += "• View leave calendar and team availability\n";
      response += "• Track status of your leave applications\n\n";
      response += "Would you like to know about your current leave balances?";
      
      return response;
    }
    
    return '';
  }
  
  static async handleShiftQuery(message: string, context: ChatContext): Promise<string> {
    const shiftKeywords = ['shift', 'attendance', 'check in', 'check out', 'work hours'];
    
    if (shiftKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      const activeShifts = context.currentStats.active_shifts || 0;
      
      let response = "I can help you with shift and attendance management! ";
      
      if (activeShifts > 0) {
        response += "You currently have an active shift running. ";
      }
      
      response += "Here's what you can do:\n\n";
      response += "• Start and end your work shifts\n";
      response += "• Track your location during shifts\n";
      response += "• View your attendance history\n";
      response += "• Monitor your work hours and patterns\n\n";
      response += "Need help with starting or ending a shift?";
      
      return response;
    }
    
    return '';
  }
}
```

This AI chat integration provides intelligent, context-aware assistance to users across all roles, helping them navigate the platform and get answers to their questions efficiently.