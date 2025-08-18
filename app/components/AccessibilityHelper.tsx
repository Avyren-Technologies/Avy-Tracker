import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  AccessibilityInfo,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

interface AccessibilitySettings {
  voiceGuidance: boolean;
  hapticFeedback: boolean;
  highContrast: boolean;
  largeText: boolean;
  slowAnimations: boolean;
  screenReaderOptimized: boolean;
  audioDescriptions: boolean;
}

interface AccessibilityHelperProps {
  visible: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AccessibilitySettings) => void;
  currentSettings?: Partial<AccessibilitySettings>;
}

interface AccessibilityFeature {
  id: keyof AccessibilitySettings;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: 'visual' | 'audio' | 'motor' | 'cognitive';
  importance: 'high' | 'medium' | 'low';
}

/**
 * Accessibility Helper Component
 * 
 * Provides comprehensive accessibility features and settings for visually impaired users
 * and users with other accessibility needs during face verification.
 * 
 * Requirements addressed:
 * - Accessibility features for visually impaired users
 * - 1.7: User guidance and help features
 * - 6.3: Enhanced user experience features
 */
export default function AccessibilityHelper({
  visible,
  onClose,
  onSettingsChange,
  currentSettings = {},
}: AccessibilityHelperProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#1f2937', '#f8fafc');
  const primaryColor = useThemeColor('#3b82f6', '#60a5fa');
  const successColor = useThemeColor('#10b981', '#34d399');
  const warningColor = useThemeColor('#f59e0b', '#fbbf24');

  // Default accessibility settings
  const defaultSettings: AccessibilitySettings = {
    voiceGuidance: true,
    hapticFeedback: true,
    highContrast: false,
    largeText: false,
    slowAnimations: false,
    screenReaderOptimized: false,
    audioDescriptions: true,
  };

  const [settings, setSettings] = useState<AccessibilitySettings>({
    ...defaultSettings,
    ...currentSettings,
  });
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('visual');

  /**
   * Accessibility features configuration
   */
  const accessibilityFeatures: AccessibilityFeature[] = [
    {
      id: 'voiceGuidance',
      title: 'Voice Guidance',
      description: 'Provides spoken instructions and feedback during face verification process.',
      icon: 'volume-high',
      category: 'audio',
      importance: 'high',
    },
    {
      id: 'hapticFeedback',
      title: 'Haptic Feedback',
      description: 'Uses vibration patterns to provide tactile feedback for different events.',
      icon: 'phone-portrait',
      category: 'motor',
      importance: 'high',
    },
    {
      id: 'highContrast',
      title: 'High Contrast Mode',
      description: 'Increases color contrast for better visibility of interface elements.',
      icon: 'contrast',
      category: 'visual',
      importance: 'high',
    },
    {
      id: 'largeText',
      title: 'Large Text',
      description: 'Increases text size throughout the interface for better readability.',
      icon: 'text',
      category: 'visual',
      importance: 'medium',
    },
    {
      id: 'slowAnimations',
      title: 'Slow Animations',
      description: 'Reduces animation speed to make interface changes easier to follow.',
      icon: 'speedometer',
      category: 'cognitive',
      importance: 'medium',
    },
    {
      id: 'screenReaderOptimized',
      title: 'Screen Reader Optimization',
      description: 'Optimizes interface for screen readers like VoiceOver and TalkBack.',
      icon: 'accessibility',
      category: 'visual',
      importance: 'high',
    },
    {
      id: 'audioDescriptions',
      title: 'Audio Descriptions',
      description: 'Provides detailed audio descriptions of visual elements and actions.',
      icon: 'chatbubble-ellipses',
      category: 'audio',
      importance: 'medium',
    },
  ];

  const categories = [
    { id: 'visual', name: 'Visual', icon: 'eye', color: primaryColor },
    { id: 'audio', name: 'Audio', icon: 'volume-high', color: successColor },
    { id: 'motor', name: 'Motor', icon: 'hand-left', color: warningColor },
    { id: 'cognitive', name: 'Cognitive', icon: 'brain', color: '#8b5cf6' },
  ];

  /**
   * Check if screen reader is enabled
   */
  const checkScreenReaderStatus = useCallback(async () => {
    try {
      const isEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(isEnabled);
      
      if (isEnabled) {
        setSettings(prev => ({ ...prev, screenReaderOptimized: true }));
      }
    } catch (error) {
      console.error('Error checking screen reader status:', error);
    }
  }, []);

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (Platform.OS === 'ios' && settings.voiceGuidance) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [settings.voiceGuidance]);

  /**
   * Speak text using text-to-speech
   */
  const speakText = useCallback(async (text: string) => {
    if (!settings.voiceGuidance) return;
    
    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.8,
      });
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  }, [settings.voiceGuidance]);

  /**
   * Provide haptic feedback
   */
  const provideHapticFeedback = useCallback((type: 'success' | 'warning' | 'error' | 'selection' = 'selection') => {
    if (!settings.hapticFeedback) return;
    
    try {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
      }
    } catch (error) {
      console.error('Error providing haptic feedback:', error);
    }
  }, [settings.hapticFeedback]);

  /**
   * Update accessibility setting
   */
  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
    
    // Provide feedback
    provideHapticFeedback('selection');
    announceToScreenReader(`${accessibilityFeatures.find(f => f.id === key)?.title} ${value ? 'enabled' : 'disabled'}`);
  }, [settings, onSettingsChange, provideHapticFeedback, announceToScreenReader, accessibilityFeatures]);

  /**
   * Test accessibility feature
   */
  const testFeature = useCallback(async (featureId: keyof AccessibilitySettings) => {
    const feature = accessibilityFeatures.find(f => f.id === featureId);
    if (!feature) return;
    
    switch (featureId) {
      case 'voiceGuidance':
        await speakText('Voice guidance is working correctly. You will hear spoken instructions during face verification.');
        break;
      case 'hapticFeedback':
        provideHapticFeedback('success');
        announceToScreenReader('Haptic feedback test completed');
        break;
      case 'audioDescriptions':
        await speakText('Audio descriptions provide detailed information about visual elements. For example, the face detection frame is now showing a green border indicating good positioning.');
        break;
      default:
        announceToScreenReader(`${feature.title} feature is enabled`);
    }
  }, [accessibilityFeatures, speakText, provideHapticFeedback, announceToScreenReader]);

  /**
   * Get filtered features by category
   */
  const getFeaturesByCategory = useCallback((category: string) => {
    return accessibilityFeatures.filter(feature => feature.category === category);
  }, [accessibilityFeatures]);

  /**
   * Get importance color
   */
  const getImportanceColor = useCallback((importance: string) => {
    switch (importance) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return textColor;
    }
  }, [textColor]);

  // Check screen reader status on mount
  useEffect(() => {
    if (visible) {
      checkScreenReaderStatus();
    }
  }, [visible, checkScreenReaderStatus]);

  // Listen for screen reader changes
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // Announce when modal opens
  useEffect(() => {
    if (visible) {
      announceToScreenReader('Accessibility settings opened. Configure features to improve your face verification experience.');
    }
  }, [visible, announceToScreenReader]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close accessibility settings"
            accessibilityHint="Close the accessibility settings and return"
          >
            <Ionicons name="close" size={24} color={textColor} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Accessibility Settings
          </Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Screen Reader Status */}
        {isScreenReaderEnabled && (
          <View style={[styles.statusBanner, { backgroundColor: successColor + '20' }]}>
            <Ionicons name="accessibility" size={20} color={successColor} />
            <Text style={[styles.statusText, { color: successColor }]}>
              Screen reader detected - optimizations enabled
            </Text>
          </View>
        )}

        {/* Category Tabs */}
        <View style={styles.categoryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => {
                  setSelectedCategory(category.id);
                  provideHapticFeedback('selection');
                }}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: selectedCategory === category.id ? category.color : 'transparent',
                    borderColor: category.color,
                  },
                ]}
                accessibilityLabel={`${category.name} accessibility features`}
                accessibilityHint={`View ${category.name.toLowerCase()} accessibility options`}
                accessibilityState={{ selected: selectedCategory === category.id }}
              >
                <Ionicons
                  name={category.icon as any}
                  size={20}
                  color={selectedCategory === category.id ? '#ffffff' : category.color}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: selectedCategory === category.id ? '#ffffff' : category.color,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Features List */}
        <ScrollView
          style={styles.contentContainer}
          contentContainerStyle={styles.contentScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {getFeaturesByCategory(selectedCategory).map((feature) => (
            <View key={feature.id} style={[styles.featureItem, { borderColor: 'rgba(0,0,0,0.1)' }]}>
              <View style={styles.featureHeader}>
                <View style={[styles.featureIcon, { backgroundColor: primaryColor }]}>
                  <Ionicons name={feature.icon} size={24} color="#ffffff" />
                </View>
                <View style={styles.featureInfo}>
                  <View style={styles.featureTitleRow}>
                    <Text style={[styles.featureTitle, { color: textColor }]}>
                      {feature.title}
                    </Text>
                    <View style={[styles.importanceBadge, { backgroundColor: getImportanceColor(feature.importance) }]}>
                      <Text style={styles.importanceText}>
                        {feature.importance.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.featureDescription, { color: textColor }]}>
                    {feature.description}
                  </Text>
                </View>
              </View>
              
              <View style={styles.featureControls}>
                <Switch
                  value={settings[feature.id]}
                  onValueChange={(value) => updateSetting(feature.id, value)}
                  trackColor={{ false: 'rgba(0,0,0,0.1)', true: primaryColor + '40' }}
                  thumbColor={settings[feature.id] ? primaryColor : '#f4f3f4'}
                  accessibilityLabel={`Toggle ${feature.title}`}
                  accessibilityHint={`${settings[feature.id] ? 'Disable' : 'Enable'} ${feature.title}`}
                />
                
                {settings[feature.id] && ['voiceGuidance', 'hapticFeedback', 'audioDescriptions'].includes(feature.id) && (
                  <TouchableOpacity
                    onPress={() => testFeature(feature.id)}
                    style={[styles.testButton, { backgroundColor: primaryColor }]}
                    accessibilityLabel={`Test ${feature.title}`}
                    accessibilityHint={`Test the ${feature.title} feature`}
                  >
                    <Ionicons name="play" size={16} color="#ffffff" />
                    <Text style={styles.testButtonText}>Test</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={[styles.quickActionsTitle, { color: textColor }]}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              onPress={() => {
                const allEnabled = { ...settings };
                Object.keys(allEnabled).forEach(key => {
                  allEnabled[key as keyof AccessibilitySettings] = true;
                });
                setSettings(allEnabled);
                onSettingsChange(allEnabled);
                provideHapticFeedback('success');
                announceToScreenReader('All accessibility features enabled');
              }}
              style={[styles.quickActionButton, { backgroundColor: successColor }]}
              accessibilityLabel="Enable all features"
              accessibilityHint="Enable all accessibility features at once"
            >
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.quickActionText}>Enable All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => {
                setSettings(defaultSettings);
                onSettingsChange(defaultSettings);
                provideHapticFeedback('selection');
                announceToScreenReader('Accessibility settings reset to defaults');
              }}
              style={[styles.quickActionButton, { backgroundColor: warningColor }]}
              accessibilityLabel="Reset to defaults"
              accessibilityHint="Reset all accessibility settings to default values"
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.quickActionText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryContainer: {
    paddingBottom: 20,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
  },
  contentScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featureItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  importanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  featureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginHorizontal: 6,
    justifyContent: 'center',
  },
  quickActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});