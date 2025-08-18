import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  AccessibilityInfo,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { FaceVerificationErrorType } from '../types/faceVerificationErrors';

interface TroubleshootingItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: 'common' | 'technical' | 'hardware' | 'environment';
  solutions: Solution[];
  relatedErrors?: FaceVerificationErrorType[];
}

interface Solution {
  step: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  difficulty: 'easy' | 'medium' | 'advanced';
  estimatedTime?: string;
}

interface TroubleshootingGuideProps {
  visible: boolean;
  onClose: () => void;
  initialError?: FaceVerificationErrorType;
  enableVoiceGuidance?: boolean;
}

/**
 * Troubleshooting Guide Component
 * 
 * Provides comprehensive troubleshooting solutions for common face verification issues.
 * Includes step-by-step solutions and accessibility features.
 * 
 * Requirements addressed:
 * - 1.7: Troubleshooting guides for common issues
 * - 6.3: User guidance and help features
 * - Accessibility features for visually impaired users
 */
export default function TroubleshootingGuide({
  visible,
  onClose,
  initialError,
  enableVoiceGuidance = true,
}: TroubleshootingGuideProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#1f2937', '#f8fafc');
  const primaryColor = useThemeColor('#3b82f6', '#60a5fa');
  const successColor = useThemeColor('#10b981', '#34d399');
  const warningColor = useThemeColor('#f59e0b', '#fbbf24');
  const errorColor = useThemeColor('#ef4444', '#f87171');

  const [selectedCategory, setSelectedCategory] = useState<string>('common');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  /**
   * Troubleshooting items database
   */
  const troubleshootingItems: TroubleshootingItem[] = [
    {
      id: 'no-face-detected',
      title: 'Face Not Detected',
      description: 'The camera cannot detect your face in the frame.',
      icon: 'person-outline',
      category: 'common',
      relatedErrors: [FaceVerificationErrorType.NO_FACE_DETECTED],
      solutions: [
        {
          step: 'Position yourself correctly',
          description: 'Center your face in the camera frame and ensure you\'re at arm\'s length from the device.',
          icon: 'move',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Improve lighting',
          description: 'Move to a well-lit area or turn on additional lights. Face a window or light source.',
          icon: 'sunny',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Remove obstructions',
          description: 'Remove glasses, hats, or anything covering your face. Tie back long hair if needed.',
          icon: 'eye',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Clean camera lens',
          description: 'Wipe the camera lens with a soft cloth to remove smudges or dirt.',
          icon: 'camera',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
      ],
    },
    {
      id: 'poor-lighting',
      title: 'Poor Lighting Conditions',
      description: 'Lighting is too dim or uneven for accurate face detection.',
      icon: 'bulb-outline',
      category: 'environment',
      relatedErrors: [FaceVerificationErrorType.POOR_LIGHTING],
      solutions: [
        {
          step: 'Find better lighting',
          description: 'Move to a location with bright, even lighting. Natural daylight works best.',
          icon: 'sunny',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Turn on lights',
          description: 'Turn on all available room lights. Use multiple light sources for even illumination.',
          icon: 'bulb',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Avoid backlighting',
          description: 'Don\'t stand in front of windows or bright lights. Face the light source instead.',
          icon: 'contrast',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Use phone flashlight',
          description: 'As a last resort, ask someone to shine a phone flashlight on your face from the side.',
          icon: 'flashlight',
          difficulty: 'medium',
          estimatedTime: '1 minute',
        },
      ],
    },
    {
      id: 'multiple-faces',
      title: 'Multiple Faces Detected',
      description: 'The camera detects more than one face in the frame.',
      icon: 'people',
      category: 'common',
      relatedErrors: [FaceVerificationErrorType.MULTIPLE_FACES],
      solutions: [
        {
          step: 'Clear the area',
          description: 'Ensure you\'re alone in the camera frame. Ask others to step away.',
          icon: 'person',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Check for reflections',
          description: 'Look for mirrors or reflective surfaces that might show your face multiple times.',
          icon: 'copy',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Adjust camera angle',
          description: 'Change the camera angle to avoid capturing other people or reflections.',
          icon: 'camera-reverse',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
      ],
    },
    {
      id: 'liveness-failed',
      title: 'Liveness Detection Failed',
      description: 'The system couldn\'t detect natural eye movement or blinking.',
      icon: 'eye-off',
      category: 'common',
      relatedErrors: [FaceVerificationErrorType.NO_LIVENESS_DETECTED],
      solutions: [
        {
          step: 'Blink naturally',
          description: 'When prompted, blink your eyes naturally. Don\'t force or exaggerate the movement.',
          icon: 'eye',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Keep eyes open',
          description: 'Keep your eyes open most of the time. Only blink when specifically asked.',
          icon: 'eye',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Stay still',
          description: 'Keep your head and body still during liveness detection. Only move your eyes.',
          icon: 'pause',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Remove glasses',
          description: 'If wearing glasses, try removing them as they can interfere with eye detection.',
          icon: 'glasses',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
      ],
    },
    {
      id: 'camera-permission',
      title: 'Camera Permission Denied',
      description: 'The app doesn\'t have permission to access your camera.',
      icon: 'camera-outline',
      category: 'technical',
      relatedErrors: [FaceVerificationErrorType.CAMERA_PERMISSION_DENIED],
      solutions: [
        {
          step: 'Check app permissions',
          description: 'Go to your device settings and ensure the app has camera permission enabled.',
          icon: 'settings',
          difficulty: 'medium',
          estimatedTime: '2 minutes',
        },
        {
          step: 'Restart the app',
          description: 'Close and reopen the app to trigger the permission request again.',
          icon: 'refresh',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Check system settings',
          description: 'Ensure camera access isn\'t restricted by parental controls or device policies.',
          icon: 'shield',
          difficulty: 'advanced',
          estimatedTime: '5 minutes',
        },
      ],
    },
    {
      id: 'network-error',
      title: 'Network Connection Issues',
      description: 'Unable to connect to the verification server.',
      icon: 'wifi-outline',
      category: 'technical',
      relatedErrors: [FaceVerificationErrorType.NETWORK_ERROR],
      solutions: [
        {
          step: 'Check internet connection',
          description: 'Ensure you have a stable internet connection. Try opening a web page.',
          icon: 'wifi',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Switch networks',
          description: 'Try switching between WiFi and mobile data to see if one works better.',
          icon: 'swap-horizontal',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Restart network',
          description: 'Turn airplane mode on and off, or restart your WiFi connection.',
          icon: 'airplane',
          difficulty: 'medium',
          estimatedTime: '2 minutes',
        },
        {
          step: 'Try again later',
          description: 'The server might be temporarily unavailable. Wait a few minutes and try again.',
          icon: 'time',
          difficulty: 'easy',
          estimatedTime: '5 minutes',
        },
      ],
    },
    {
      id: 'low-confidence',
      title: 'Verification Confidence Too Low',
      description: 'The system isn\'t confident enough in the face match.',
      icon: 'warning',
      category: 'common',
      relatedErrors: [FaceVerificationErrorType.LOW_CONFIDENCE],
      solutions: [
        {
          step: 'Improve conditions',
          description: 'Ensure optimal lighting and positioning, similar to your registration.',
          icon: 'checkmark-circle',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Use same appearance',
          description: 'Try to look similar to when you registered (same glasses, hairstyle, etc.).',
          icon: 'person',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Re-register if needed',
          description: 'If problems persist, consider re-registering your face profile.',
          icon: 'refresh',
          difficulty: 'medium',
          estimatedTime: '3 minutes',
        },
      ],
    },
    {
      id: 'device-performance',
      title: 'Slow Performance or Freezing',
      description: 'The app is running slowly or freezing during verification.',
      icon: 'speedometer',
      category: 'technical',
      solutions: [
        {
          step: 'Close other apps',
          description: 'Close other running apps to free up memory and processing power.',
          icon: 'apps',
          difficulty: 'easy',
          estimatedTime: '1 minute',
        },
        {
          step: 'Restart the app',
          description: 'Force close and reopen the app to clear any temporary issues.',
          icon: 'refresh',
          difficulty: 'easy',
          estimatedTime: '30 seconds',
        },
        {
          step: 'Restart device',
          description: 'Restart your device to clear memory and refresh system resources.',
          icon: 'power',
          difficulty: 'medium',
          estimatedTime: '2 minutes',
        },
        {
          step: 'Update the app',
          description: 'Check for app updates that might include performance improvements.',
          icon: 'download',
          difficulty: 'medium',
          estimatedTime: '3 minutes',
        },
      ],
    },
  ];

  const categories = [
    { id: 'common', name: 'Common Issues', icon: 'help-circle' },
    { id: 'environment', name: 'Environment', icon: 'sunny' },
    { id: 'technical', name: 'Technical', icon: 'settings' },
    { id: 'hardware', name: 'Hardware', icon: 'phone-portrait' },
  ];

  /**
   * Get difficulty color
   */
  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'easy': return successColor;
      case 'medium': return warningColor;
      case 'advanced': return errorColor;
      default: return textColor;
    }
  }, [successColor, warningColor, errorColor, textColor]);

  /**
   * Announce to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (Platform.OS === 'ios' && enableVoiceGuidance) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [enableVoiceGuidance]);

  /**
   * Handle category selection
   */
  const selectCategory = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    setExpandedItem(null);
    announceToScreenReader(`Selected ${categories.find(c => c.id === categoryId)?.name} category`);
  }, [announceToScreenReader, categories]);

  /**
   * Toggle item expansion
   */
  const toggleItem = useCallback((itemId: string) => {
    const newExpanded = expandedItem === itemId ? null : itemId;
    setExpandedItem(newExpanded);
    
    if (newExpanded) {
      const item = troubleshootingItems.find(i => i.id === newExpanded);
      if (item) {
        announceToScreenReader(`Expanded ${item.title} troubleshooting guide`);
      }
    }
  }, [expandedItem, troubleshootingItems, announceToScreenReader]);

  /**
   * Open device settings
   */
  const openDeviceSettings = useCallback(() => {
    Linking.openSettings().catch(err => {
      console.error('Failed to open settings:', err);
    });
  }, []);

  /**
   * Filter items by category and initial error
   */
  const filteredItems = troubleshootingItems.filter(item => {
    const matchesCategory = item.category === selectedCategory;
    const matchesError = !initialError || item.relatedErrors?.includes(initialError);
    return matchesCategory && (initialError ? matchesError : true);
  });

  // Fade in animation
  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  // Auto-select category based on initial error
  React.useEffect(() => {
    if (initialError && visible) {
      const item = troubleshootingItems.find(i => 
        i.relatedErrors?.includes(initialError)
      );
      if (item) {
        setSelectedCategory(item.category);
        setExpandedItem(item.id);
      }
    }
  }, [initialError, visible, troubleshootingItems]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor,
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close troubleshooting guide"
            accessibilityHint="Close the troubleshooting guide and return"
          >
            <Ionicons name="close" size={24} color={textColor} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Troubleshooting Guide
          </Text>
          
          <TouchableOpacity
            onPress={openDeviceSettings}
            style={styles.settingsButton}
            accessibilityLabel="Open device settings"
            accessibilityHint="Open device settings to check permissions"
          >
            <Ionicons name="settings" size={24} color={primaryColor} />
          </TouchableOpacity>
        </View>

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
                onPress={() => selectCategory(category.id)}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: selectedCategory === category.id ? primaryColor : 'transparent',
                    borderColor: primaryColor,
                  },
                ]}
                accessibilityLabel={`${category.name} category`}
                accessibilityHint={`View ${category.name.toLowerCase()} troubleshooting items`}
                accessibilityState={{ selected: selectedCategory === category.id }}
              >
                <Ionicons
                  name={category.icon as any}
                  size={20}
                  color={selectedCategory === category.id ? '#ffffff' : primaryColor}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: selectedCategory === category.id ? '#ffffff' : primaryColor,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Troubleshooting Items */}
        <ScrollView
          style={styles.contentContainer}
          contentContainerStyle={styles.contentScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.map((item) => (
            <View key={item.id} style={styles.itemContainer}>
              <TouchableOpacity
                onPress={() => toggleItem(item.id)}
                style={[
                  styles.itemHeader,
                  {
                    backgroundColor: expandedItem === item.id ? primaryColor + '20' : 'transparent',
                  },
                ]}
                accessibilityLabel={item.title}
                accessibilityHint={`${item.description}. Tap to ${expandedItem === item.id ? 'collapse' : 'expand'} solutions`}
                accessibilityState={{ expanded: expandedItem === item.id }}
              >
                <View style={styles.itemHeaderContent}>
                  <View style={[styles.itemIcon, { backgroundColor: primaryColor }]}>
                    <Ionicons name={item.icon} size={24} color="#ffffff" />
                  </View>
                  <View style={styles.itemHeaderText}>
                    <Text style={[styles.itemTitle, { color: textColor }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemDescription, { color: textColor }]}>
                      {item.description}
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedItem === item.id ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={textColor}
                  />
                </View>
              </TouchableOpacity>

              {/* Solutions */}
              {expandedItem === item.id && (
                <View style={styles.solutionsContainer}>
                  {item.solutions.map((solution, index) => (
                    <View key={index} style={styles.solutionItem}>
                      <View style={styles.solutionHeader}>
                        <View style={[styles.solutionIcon, { backgroundColor: getDifficultyColor(solution.difficulty) }]}>
                          <Ionicons name={solution.icon} size={16} color="#ffffff" />
                        </View>
                        <View style={styles.solutionHeaderText}>
                          <Text style={[styles.solutionStep, { color: textColor }]}>
                            Step {index + 1}: {solution.step}
                          </Text>
                          <View style={styles.solutionMeta}>
                            <Text style={[styles.solutionDifficulty, { color: getDifficultyColor(solution.difficulty) }]}>
                              {solution.difficulty.toUpperCase()}
                            </Text>
                            {solution.estimatedTime && (
                              <Text style={[styles.solutionTime, { color: textColor }]}>
                                • {solution.estimatedTime}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <Text
                        style={[styles.solutionDescription, { color: textColor }]}
                        accessibilityRole="text"
                      >
                        {solution.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {filteredItems.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color={successColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No Issues Found
              </Text>
              <Text style={[styles.emptyDescription, { color: textColor }]}>
                Great! There are no common issues in this category.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: textColor }]}>
            Still having issues? Contact support for additional help.
          </Text>
        </View>
      </Animated.View>
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
  settingsButton: {
    padding: 8,
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
  itemContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemHeader: {
    padding: 16,
  },
  itemHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemHeaderText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  solutionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  solutionItem: {
    marginBottom: 16,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(0,0,0,0.1)',
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  solutionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  solutionHeaderText: {
    flex: 1,
  },
  solutionStep: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  solutionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  solutionDifficulty: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  solutionTime: {
    fontSize: 12,
    opacity: 0.6,
    marginLeft: 4,
  },
  solutionDescription: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 44,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
});