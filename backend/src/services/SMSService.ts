import twilio from 'twilio';
import AWS from 'aws-sdk';
import ErrorHandlingService from './ErrorHandlingService';
import environmentService from '../config/environment';

export interface SMSMessage {
  to: string;
  message: string;
  type?: 'otp' | 'notification' | 'alert' | 'reminder';
  priority?: 'high' | 'normal' | 'low';
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  cost?: number;
}

export interface SMSProvider {
  name: string;
  sendSMS(message: SMSMessage): Promise<SMSResult>;
  isConfigured(): boolean;
  getStatus(): Promise<{ available: boolean; details?: any }>;
}

// Twilio SMS Provider
class TwilioSMSProvider implements SMSProvider {
  public name = 'Twilio';
  private client: twilio.Twilio | null = null;
  private fromNumber: string = '';
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const config = environmentService.getConfig();

      if (!config.sms.twilio) {
        console.warn('Twilio SMS configuration not found');
        return;
      }

      const { accountSid, authToken, phoneNumber } = config.sms.twilio;

      if (!accountSid || !authToken || !phoneNumber) {
        console.warn('Incomplete Twilio configuration');
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.fromNumber = phoneNumber;
      this.isInitialized = true;

      console.log('Twilio SMS provider initialized successfully');
    } catch (error) {
      ErrorHandlingService.logError('TWILIO_INIT_ERROR', error as Error, {
        context: 'TwilioSMSProvider.initialize'
      });
    }
  }

  public isConfigured(): boolean {
    return this.isInitialized && this.client !== null;
  }

  public async getStatus(): Promise<{ available: boolean; details?: any }> {
    if (!this.isConfigured()) {
      return { available: false, details: 'Not configured' };
    }

    try {
      // Test Twilio connection by fetching account info
      const account = await this.client!.api.accounts(this.client!.accountSid).fetch();

      return {
        available: true,
        details: {
          accountSid: account.sid,
          status: account.status,
          type: account.type
        }
      };
    } catch (error) {
      return {
        available: false,
        details: { error: (error as Error).message }
      };
    }
  }

  public async sendSMS(message: SMSMessage): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Twilio SMS provider not configured',
        provider: this.name
      };
    }

    try {
      const result = await this.client!.messages.create({
        body: message.message,
        from: this.fromNumber,
        to: message.to,
        // Add message priority if supported
        ...(message.priority === 'high' && {
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
        })
      });

      console.log(`SMS sent via Twilio. SID: ${result.sid}, Status: ${result.status}`);

      return {
        success: true,
        messageId: result.sid,
        provider: this.name,
        cost: parseFloat(result.price || '0')
      };

    } catch (error) {
      ErrorHandlingService.logError('TWILIO_SMS_ERROR', error as Error, {
        context: 'TwilioSMSProvider.sendSMS',
        phoneNumber: this.maskPhoneNumber(message.to),
        messageType: message.type
      });

      return {
        success: false,
        error: (error as Error).message,
        provider: this.name
      };
    }
  }

  private maskPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }
}

// AWS SNS SMS Provider
class AWSSNSProvider implements SMSProvider {
  public name = 'AWS SNS';
  private sns: AWS.SNS | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const config = environmentService.getConfig();

      if (!config.sms.aws) {
        console.warn('AWS SNS configuration not found');
        return;
      }

      const { accessKeyId, secretAccessKey, region } = config.sms.aws;

      if (!accessKeyId || !secretAccessKey || !region) {
        console.warn('Incomplete AWS SNS configuration');
        return;
      }

      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region
      });

      this.sns = new AWS.SNS();
      this.isInitialized = true;

      console.log('AWS SNS provider initialized successfully');
    } catch (error) {
      ErrorHandlingService.logError('AWS_SNS_INIT_ERROR', error as Error, {
        context: 'AWSSNSProvider.initialize'
      });
    }
  }

  public isConfigured(): boolean {
    return this.isInitialized && this.sns !== null;
  }

  public async getStatus(): Promise<{ available: boolean; details?: any }> {
    if (!this.isConfigured()) {
      return { available: false, details: 'Not configured' };
    }

    try {
      // Test AWS SNS connection
      const result = await this.sns!.getSMSAttributes().promise();

      return {
        available: true,
        details: {
          attributes: result.attributes,
          region: AWS.config.region
        }
      };
    } catch (error) {
      return {
        available: false,
        details: { error: (error as Error).message }
      };
    }
  }

  public async sendSMS(message: SMSMessage): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'AWS SNS provider not configured',
        provider: this.name
      };
    }

    try {
      const params: AWS.SNS.PublishInput = {
        Message: message.message,
        PhoneNumber: message.to,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: message.type === 'otp' ? 'Transactional' : 'Promotional'
          }
        }
      };

      const result = await this.sns!.publish(params).promise();

      console.log(`SMS sent via AWS SNS. MessageId: ${result.MessageId}`);

      return {
        success: true,
        messageId: result.MessageId,
        provider: this.name
      };

    } catch (error) {
      ErrorHandlingService.logError('AWS_SNS_SMS_ERROR', error as Error, {
        context: 'AWSSNSProvider.sendSMS',
        phoneNumber: this.maskPhoneNumber(message.to),
        messageType: message.type
      });

      return {
        success: false,
        error: (error as Error).message,
        provider: this.name
      };
    }
  }

  private maskPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }
}

// Console SMS Provider (for development/testing)
class ConsoleSMSProvider implements SMSProvider {
  public name = 'Console';

  public isConfigured(): boolean {
    return true; // Always available for development
  }

  public async getStatus(): Promise<{ available: boolean; details?: any }> {
    return {
      available: true,
      details: { mode: 'development', output: 'console' }
    };
  }

  public async sendSMS(message: SMSMessage): Promise<SMSResult> {
    console.log('\n=== SMS CONSOLE OUTPUT ===');
    console.log(`To: ${message.to}`);
    console.log(`Type: ${message.type || 'notification'}`);
    console.log(`Priority: ${message.priority || 'normal'}`);
    console.log(`Message: ${message.message}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('========================\n');

    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `console_${Date.now()}`,
      provider: this.name,
      cost: 0
    };
  }
}

// Main SMS Service
export class SMSService {
  private static instance: SMSService;
  private providers: SMSProvider[] = [];
  private primaryProvider: SMSProvider | null = null;
  private fallbackProvider: SMSProvider | null = null;
  private messageQueue: SMSMessage[] = [];
  private isProcessingQueue = false;
  private statistics = {
    totalSent: 0,
    totalFailed: 0,
    totalCost: 0,
    providerStats: new Map<string, { sent: number; failed: number; cost: number }>()
  };

  private constructor() {
    this.initializeProviders();
  }

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private initializeProviders(): void {
    // Initialize all available providers
    const twilioProvider = new TwilioSMSProvider();
    const awsProvider = new AWSSNSProvider();
    const consoleProvider = new ConsoleSMSProvider();

    this.providers = [twilioProvider, awsProvider, consoleProvider];

    // Set primary provider based on configuration
    const config = environmentService.getConfig();

    switch (config.sms.provider) {
      case 'twilio':
        if (twilioProvider.isConfigured()) {
          this.primaryProvider = twilioProvider;
          this.fallbackProvider = consoleProvider;
        } else {
          console.warn('Twilio configured but not available, falling back to console');
          this.primaryProvider = consoleProvider;
        }
        break;

      case 'aws':
        if (awsProvider.isConfigured()) {
          this.primaryProvider = awsProvider;
          this.fallbackProvider = consoleProvider;
        } else {
          console.warn('AWS SNS configured but not available, falling back to console');
          this.primaryProvider = consoleProvider;
        }
        break;

      default:
        this.primaryProvider = consoleProvider;
        break;
    }

    console.log(`SMS Service initialized with primary provider: ${this.primaryProvider?.name}`);
    if (this.fallbackProvider) {
      console.log(`Fallback provider: ${this.fallbackProvider.name}`);
    }

    // Initialize statistics for all providers
    this.providers.forEach(provider => {
      this.statistics.providerStats.set(provider.name, {
        sent: 0,
        failed: 0,
        cost: 0
      });
    });
  }

  public async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // Validate phone number
      if (!this.validatePhoneNumber(message.to)) {
        return {
          success: false,
          error: 'Invalid phone number format'
        };
      }

      // Try primary provider first
      if (this.primaryProvider) {
        const result = await this.attemptSend(this.primaryProvider, message);
        if (result.success) {
          this.updateStatistics(this.primaryProvider.name, true, result.cost || 0);
          return result;
        }

        // Log primary provider failure
        ErrorHandlingService.logError('SMS_PRIMARY_PROVIDER_FAILED', null, {
          context: 'SMSService.sendSMS',
          provider: this.primaryProvider.name,
          error: result.error,
          phoneNumber: this.maskPhoneNumber(message.to)
        });
      }

      // Try fallback provider
      if (this.fallbackProvider) {
        console.log(`Attempting SMS via fallback provider: ${this.fallbackProvider.name}`);
        const result = await this.attemptSend(this.fallbackProvider, message);
        this.updateStatistics(this.fallbackProvider.name, result.success, result.cost || 0);
        return result;
      }

      return {
        success: false,
        error: 'No SMS providers available'
      };

    } catch (error) {
      ErrorHandlingService.logError('SMS_SERVICE_ERROR', error as Error, {
        context: 'SMSService.sendSMS',
        phoneNumber: this.maskPhoneNumber(message.to),
        messageType: message.type
      });

      return {
        success: false,
        error: 'SMS service error: ' + (error as Error).message
      };
    }
  }

  private async attemptSend(provider: SMSProvider, message: SMSMessage): Promise<SMSResult> {
    try {
      const result = await provider.sendSMS(message);
      return { ...result, provider: provider.name };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        provider: provider.name
      };
    }
  }

  public async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    const results: SMSResult[] = [];

    // Process messages in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.sendSMS(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  public queueSMS(message: SMSMessage): void {
    this.messageQueue.push(message);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          await this.sendSMS(message);
          // Add small delay between messages
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      ErrorHandlingService.logError('SMS_QUEUE_PROCESSING_ERROR', error as Error, {
        context: 'SMSService.processQueue',
        queueLength: this.messageQueue.length
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private validatePhoneNumber(phoneNumber: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private maskPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }

  private updateStatistics(providerName: string, success: boolean, cost: number): void {
    const stats = this.statistics.providerStats.get(providerName);
    if (stats) {
      if (success) {
        stats.sent++;
        this.statistics.totalSent++;
      } else {
        stats.failed++;
        this.statistics.totalFailed++;
      }
      stats.cost += cost;
      this.statistics.totalCost += cost;
    }
  }

  public async getProviderStatus(): Promise<{ [key: string]: any }> {
    const status: { [key: string]: any } = {};

    for (const provider of this.providers) {
      status[provider.name] = await provider.getStatus();
    }

    return status;
  }

  public getStatistics(): typeof this.statistics {
    return {
      ...this.statistics,
      providerStats: new Map(this.statistics.providerStats)
    };
  }

  public clearStatistics(): void {
    this.statistics.totalSent = 0;
    this.statistics.totalFailed = 0;
    this.statistics.totalCost = 0;
    this.statistics.providerStats.clear();

    this.providers.forEach(provider => {
      this.statistics.providerStats.set(provider.name, {
        sent: 0,
        failed: 0,
        cost: 0
      });
    });
  }

  // Template methods for common SMS types
  public async sendOTPSMS(phoneNumber: string, otp: string, purpose: string): Promise<SMSResult> {
    const message: SMSMessage = {
      to: phoneNumber,
      message: `Your verification code for ${purpose} is: ${otp}. This code expires in 5 minutes. Do not share this code with anyone.`,
      type: 'otp',
      priority: 'high'
    };

    return this.sendSMS(message);
  }

  public async sendNotificationSMS(phoneNumber: string, title: string, body: string): Promise<SMSResult> {
    const message: SMSMessage = {
      to: phoneNumber,
      message: `${title}\n\n${body}`,
      type: 'notification',
      priority: 'normal'
    };

    return this.sendSMS(message);
  }

  public async sendAlertSMS(phoneNumber: string, alertMessage: string): Promise<SMSResult> {
    const message: SMSMessage = {
      to: phoneNumber,
      message: `ALERT: ${alertMessage}`,
      type: 'alert',
      priority: 'high'
    };

    return this.sendSMS(message);
  }
}

export default SMSService;