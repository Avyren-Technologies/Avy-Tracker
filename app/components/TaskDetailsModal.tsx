import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ActionSheetIOS,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { themeColors } from '../utils/themeColors';
import EditTaskModal from '../(dashboard)/Group-Admin/components/EditTaskModal';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  assigned_to: number;
  assigned_to_name: string;
  assigned_by_name: string;
  assigned_to_avatar?: string;
  assigned_by_avatar?: string;
  customer_name?: string;
  customer_contact?: string;
  customer_notes?: string;
  attachments?: any[];
  attachment_count?: number;
  comments_count?: number;
  activity_count?: number;
  formatted_due_date?: string;
  formatted_created_at?: string;
  formatted_last_update?: string;
}

interface Comment {
  id: number;
  comment: string;
  comment_type: string;
  created_at: string;
  user_name: string;
  user_role: string;
  avatar_url?: string;
}

interface Activity {
  id: number;
  activity_type: string;
  activity_description: string;
  old_value?: string;
  new_value?: string;
  change_details?: any;
  created_at: string;
  user_name?: string;
  user_role?: string;
  avatar_url?: string;
}

interface TaskDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: number | null;
  isDark: boolean;
  onTaskUpdate?: () => void;
}

interface StatusUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  currentStatus: string;
  onUpdateStatus: (status: string) => void;
  isDark: boolean;
}

interface CustomerUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onSendUpdate: (message: string) => void;
  isDark: boolean;
  customerName?: string;
}

const { width } = Dimensions.get('window');

export default function TaskDetailsModal({
  visible,
  onClose,
  taskId,
  isDark,
  onTaskUpdate,
}: TaskDetailsModalProps) {
  const { token, user } = AuthContext.useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'details' | 'comments' | 'activity' | 'attachments'
  >('details');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCustomerUpdateModal, setShowCustomerUpdateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingCustomerUpdate, setSendingCustomerUpdate] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const colors = themeColors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    if (visible && taskId) {
      fetchTaskDetails();
      // Only fetch employees for group-admin role
      if (user?.role === 'group-admin') {
        fetchEmployees();
      }
    }
  }, [visible, taskId, user?.role]);

  const fetchTaskDetails = async () => {
    if (!taskId || !token) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/task-details/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTask(response.data);
      fetchComments();
      fetchActivities();
      fetchAttachments();
    } catch (error) {
      console.error('Error fetching task details:', error);
      Alert.alert('Error', 'Failed to fetch task details');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!taskId || !token) return;

    setCommentsLoading(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/task-details/${taskId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const fetchActivities = async () => {
    if (!taskId || !token) return;

    setActivitiesLoading(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/task-details/${taskId}/activity`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchAttachments = async () => {
    if (!taskId || !token) return;

    setAttachmentsLoading(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAttachments(response.data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !taskId || !token) return;

    setSendingComment(true);
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/task-details/${taskId}/comments`,
        {
          comment: newComment.trim(),
          comment_type: 'general',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setComments([...comments, response.data]);
      setNewComment('');
      onTaskUpdate?.();
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'low':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'high':
        return '#F97316';
      case 'critical':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#F59E0B';
      case 'in_progress':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'task_created':
        return 'add-circle';
      case 'task_assigned':
      case 'task_reassigned':
        return 'person';
      case 'status_changed':
        return 'checkmark-circle';
      case 'priority_changed':
        return 'flag';
      case 'due_date_changed':
        return 'calendar';
      case 'comment_added':
        return 'chatbubble';
      case 'attachment_added':
        return 'attach';
      case 'attachment_removed':
        return 'trash';
      case 'customer_updated':
        return 'business';
      case 'task_completed':
        return 'checkmark-done';
      case 'task_cancelled':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAttachmentAction = async (attachment: any) => {
    if (!token) return;
    setSelectedAttachment(attachment);
    setShowAttachmentModal(true);
  };

  const handleAttachmentActionSelect = async (action: string) => {
    if (!selectedAttachment) return;
    
    setShowAttachmentModal(false);
    
    switch (action) {
      case 'open':
        await openAttachment(selectedAttachment);
        break;
      case 'download':
        await downloadAttachment(selectedAttachment);
        break;
      case 'share':
        await shareAttachment(selectedAttachment);
        break;
    }
    
    setSelectedAttachment(null);
  };

  const openAttachment = async (attachment: any) => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/attachments/${attachment.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'text',
        }
      );

      const fileUri = `${FileSystem.cacheDirectory}${attachment.file_name}`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: attachment.file_type,
        });
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            UTI:
              attachment.file_type === 'application/pdf'
                ? 'com.adobe.pdf'
                : 'public.item',
            mimeType: attachment.file_type,
          });
        } else {
          await WebBrowser.openBrowserAsync(`file://${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  const downloadAttachment = async (attachment: any) => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/attachments/${attachment.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'text',
        }
      );

      const fileUri = `${FileSystem.documentDirectory}${attachment.file_name}`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert('Success', `File downloaded to: ${fileUri}`);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      Alert.alert('Error', 'Failed to download attachment');
    }
  };

  const shareAttachment = async (attachment: any) => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/attachments/${attachment.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'text',
        }
      );

      const fileUri = `${FileSystem.cacheDirectory}${attachment.file_name}`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing attachment:', error);
      Alert.alert('Error', 'Failed to share attachment');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!taskId || !token) return;

    setUpdatingStatus(true);
    try {
      await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local task state
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus as 'pending' | 'in_progress' | 'completed',
            }
          : null
      );
      setShowStatusModal(false);
      onTaskUpdate?.();
      Alert.alert('Success', 'Task status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update task status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendCustomerUpdate = async (message: string) => {
    if (!taskId || !token || !task) return;

    setSendingCustomerUpdate(true);
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/task-details/${taskId}/send-customer-update`,
        { message },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setShowCustomerUpdateModal(false);
      Alert.alert('Success', 'Customer update sent successfully');
    } catch (error) {
      console.error('Error sending customer update:', error);
      Alert.alert('Error', 'Failed to send customer update');
    } finally {
      setSendingCustomerUpdate(false);
    }
  };

  const fetchEmployees = async () => {
    if (!token) return;

    setLoadingEmployees(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleUpdateTask = async (taskId: number, updates: any) => {
    if (!token) return;

    try {
      await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}`,
        updates,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refresh task details
      await fetchTaskDetails();
      setShowEditModal(false);
      onTaskUpdate?.();
      Alert.alert('Success', 'Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    headerButton: {
      padding: 8,
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.primary,
      fontWeight: '700',
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 0,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingVertical: 2,
    },
    descriptionRow: {
      marginBottom: 8,
      paddingVertical: 2,
    },
    taskInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start", // top-align so wrapped values don't stretch the row vertically
      marginBottom: 8,
      paddingVertical: 2,
    },
    
    taskDescriptionRow: {
      marginBottom: 8,
      paddingVertical: 2,
    },
    
    /* Make label fixed-width so it doesn't push value to a new line unexpectedly */
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      width: 110,            // fixed width gives predictable layout
      fontWeight: "500",
    },
    
    /* Value area flexes but is top-aligned and can wrap without creating big gaps */
    infoValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "right",
      alignSelf: "flex-start", // stay top-aligned in the row
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-end',
    },
    priorityText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-end',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    description: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginTop: 4,
      paddingHorizontal: 0,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
    },
    userName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,        // shrink if long, avoid forcing row to grow hugely
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentContainer: {
      marginBottom: 20,
    },
    comment: {
      flexDirection: 'row',
      gap: 16,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentContent: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
    },
    commentTime: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    commentText: {
      fontSize: 14,
      color: isDark ? '#ffffff' : '#000000',
      lineHeight: 20,
    },
    commentInput: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 14,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      maxHeight: 100,
      minHeight: 48,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      padding: 14,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButtonSecondary: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    actionButtonText: {
      color: '#ffffff',
      fontWeight: '600',
      fontSize: 14,
    },
    actionButtonTextSecondary: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
      paddingLeft: 8,
    },
    activityIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#3B82F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    activityContent: {
      flex: 1,
    },
    activityDescription: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 2,
    },
    activityTime: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#e0e0e0',
    },
    attachmentContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    attachmentMenuButton: {
      padding: 8,
      marginLeft: 8,
    },
    attachmentInfo: {
      flex: 1,
    },
    attachmentName: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 2,
    },
    attachmentSize: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
    },
  });

  if (!visible || !task) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.modalContainer}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
          style={[styles.header, ,]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.headerButton,
                { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? '#FFFFFF' : '#000000' },
                ]}
              >
                Task Details
              </Text>
            </View>
            {/* Only show edit button for group-admin role */}
            {user?.role === 'group-admin' ? (
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                ]}
                onPress={() => setShowEditModal(true)}
              >
                <Ionicons
                  name="create-outline"
                  size={24}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButton} />
            )}
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
            onPress={() => setActiveTab('details')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'details' && styles.activeTabText,
              ]}
            >
              Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'comments' && styles.activeTab]}
            onPress={() => setActiveTab('comments')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'comments' && styles.activeTabText,
              ]}
            >
              Comments ({comments.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
            onPress={() => setActiveTab('activity')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'activity' && styles.activeTabText,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'attachments' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('attachments')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'attachments' && styles.activeTabText,
              ]}
            >
              Files ({attachments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : (
            <>
              {activeTab === 'details' && (
                <>
                  {/* Task Information */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Task Information</Text>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Title</Text>
                      <Text style={styles.infoValue}>{task.title}</Text>
                    </View>

                    <View style={styles.taskDescriptionRow}>
                      <Text style={styles.infoLabel}>Description</Text>
                      <Text style={styles.description}>{task.description}</Text>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Assigned To</Text>
                      <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                          <Ionicons
                            name="person"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </View>
                        <Text style={styles.userName} numberOfLines={2}>
                          {task.assigned_to_name}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Assigned By</Text>
                      <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                          <Ionicons
                            name="person"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </View>
                        <Text style={styles.userName} numberOfLines={2}>
                          {task.assigned_by_name}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Priority</Text>
                      <View
                        style={[
                          styles.priorityBadge,
                          { backgroundColor: getPriorityColor(task.priority) },
                        ]}
                      >
                        <Text style={styles.priorityText}>
                          {task.priority.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(task.status) },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {task.status.toUpperCase().replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Due Date</Text>
                      <Text style={styles.infoValue}>
                        {task.formatted_due_date
                          ? format(
                              new Date(task.formatted_due_date),
                              'MMM dd, yyyy'
                            )
                          : 'Not set'}
                      </Text>
                    </View>

                    <View style={styles.taskInfoRow}>
                      <Text style={styles.infoLabel}>Created</Text>
                      <Text style={styles.infoValue}>
                        {task.formatted_created_at
                          ? format(
                              new Date(task.formatted_created_at),
                              'MMM dd, yyyy'
                            )
                          : 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Customer Details */}
                  {task.customer_name && (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Customer Details</Text>

                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Customer Name</Text>
                        <Text style={styles.infoValue}>
                          {task.customer_name}
                        </Text>
                      </View>

                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Contact</Text>
                        <Text style={styles.infoValue}>
                          {task.customer_contact}
                        </Text>
                      </View>

                      {task.customer_notes && (
                        <View style={styles.descriptionRow}>
                          <Text style={styles.infoLabel}>Notes</Text>
                          <Text style={styles.description}>
                            {task.customer_notes}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Actions</Text>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setActiveTab('comments')}
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color="#ffffff"
                      />
                      <Text style={styles.actionButtonText}>Add Note</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButtonSecondary}
                      onPress={() => setShowStatusModal(true)}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={20}
                        color={colors.text}
                      />
                      <Text style={styles.actionButtonTextSecondary}>
                        Change Status
                      </Text>
                    </TouchableOpacity>

                    {task.customer_name && task.customer_contact && (
                      <TouchableOpacity
                        style={styles.actionButtonSecondary}
                        onPress={() => setShowCustomerUpdateModal(true)}
                      >
                        <Ionicons
                          name="send-outline"
                          size={20}
                          color={colors.text}
                        />
                        <Text style={styles.actionButtonTextSecondary}>
                          Send Update to Customer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {activeTab === 'comments' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Comments</Text>

                  {commentsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                  ) : comments.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No comments yet</Text>
                    </View>
                  ) : (
                    <>
                      {comments.map((comment) => (
                        <View key={comment.id} style={styles.commentContainer}>
                          <View style={styles.comment}>
                            {comment.avatar_url ? (
                              <Image
                                source={{ uri: comment.avatar_url }}
                                style={styles.commentAvatar}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.commentAvatar,
                                  { backgroundColor: colors.primary },
                                ]}
                              >
                                <Ionicons
                                  name="person"
                                  size={16}
                                  color="#FFFFFF"
                                />
                              </View>
                            )}
                            <View style={styles.commentContent}>
                              <View style={styles.commentHeader}>
                                <Text style={styles.commentAuthor}>
                                  {comment.user_name}
                                </Text>
                                <Text style={styles.commentTime}>
                                  {formatDistanceToNow(
                                    new Date(comment.created_at),
                                    { addSuffix: true }
                                  )}
                                </Text>
                              </View>
                              <Text style={styles.commentText}>
                                {comment.comment}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {/* Add Comment */}
                  <View style={styles.commentInput}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Add a comment..."
                      placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.sendButton}
                      onPress={handleSendComment}
                      disabled={sendingComment || !newComment.trim()}
                    >
                      {sendingComment ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeTab === 'activity' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Task History</Text>

                  {activitiesLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                  ) : activities.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No activity yet</Text>
                    </View>
                  ) : (
                    <>
                      {activities.map((activity) => (
                        <View key={activity.id} style={styles.activityItem}>
                          <View style={styles.activityIcon}>
                            <Ionicons
                              name={
                                getActivityIcon(activity.activity_type) as any
                              }
                              size={16}
                              color="#ffffff"
                            />
                          </View>
                          <View style={styles.activityContent}>
                            <Text style={styles.activityDescription}>
                              {activity.activity_description}
                            </Text>
                            <Text style={styles.activityTime}>
                              {formatDistanceToNow(
                                new Date(activity.created_at),
                                { addSuffix: true }
                              )}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {activeTab === 'attachments' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Attachments</Text>

                  {attachmentsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                  ) : attachments.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No attachments</Text>
                    </View>
                  ) : (
                    <>
                      {attachments.map((attachment) => (
                        <View key={attachment.id} style={styles.attachmentItem}>
                          <TouchableOpacity
                            style={styles.attachmentContent}
                            onPress={() => handleAttachmentAction(attachment)}
                          >
                            <View style={styles.attachmentInfo}>
                              <Text style={styles.attachmentName}>
                                {attachment.file_name}
                              </Text>
                              <Text style={styles.attachmentSize}>
                                {formatFileSize(attachment.file_size)} •{' '}
                                {attachment.file_type}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.attachmentMenuButton}
                            onPress={() => handleAttachmentAction(attachment)}
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Status Update Modal */}
        <StatusUpdateModal
          visible={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          currentStatus={task?.status || 'pending'}
          onUpdateStatus={handleUpdateStatus}
          isDark={isDark}
        />

        {/* Customer Update Modal */}
        <CustomerUpdateModal
          visible={showCustomerUpdateModal}
          onClose={() => setShowCustomerUpdateModal(false)}
          onSendUpdate={handleSendCustomerUpdate}
          isDark={isDark}
          customerName={task?.customer_name}
        />

        {/* Edit Task Modal */}
        {task && (
          <EditTaskModal
            visible={showEditModal}
            onClose={() => setShowEditModal(false)}
            task={{
              ...task,
              assignedTo: task.assigned_to,
              due_date: task.due_date,
            }}
            employees={employees}
            onUpdateTask={handleUpdateTask}
            isDark={isDark}
            isLoading={loadingEmployees}
          />
        )}
        
        {/* Attachment Action Modal */}
        <AttachmentActionModal
          visible={showAttachmentModal}
          onClose={() => {
            setShowAttachmentModal(false);
            setSelectedAttachment(null);
          }}
          attachment={selectedAttachment}
          onActionSelect={handleAttachmentActionSelect}
          isDark={isDark}
        />
      </View>
    </Modal>
  );
}

// Attachment Action Modal Component
interface AttachmentActionModalProps {
  visible: boolean;
  onClose: () => void;
  attachment: any;
  onActionSelect: (action: string) => void;
  isDark: boolean;
}

function AttachmentActionModal({
  visible,
  onClose,
  attachment,
  onActionSelect,
  isDark,
}: AttachmentActionModalProps) {
  const colors = themeColors[isDark ? 'dark' : 'light'];

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('image')) return 'image';
    if (fileType.includes('video')) return 'videocam';
    if (fileType.includes('audio')) return 'musical-notes';
    if (fileType.includes('word') || fileType.includes('doc')) return 'document';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'grid';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'easel';
    if (fileType.includes('zip') || fileType.includes('rar')) return 'archive';
    return 'document';
  };

  const actionOptions = [
    {
      id: 'open',
      label: 'Open',
      icon: 'eye',
      color: colors.primary,
    },
    {
      id: 'download',
      label: 'Download',
      icon: 'download',
      color: colors.success,
    },
    {
      id: 'share',
      label: 'Share',
      icon: 'share',
      color: colors.info,
    },
  ];

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    fileIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    fileName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    fileSize: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    actionsContainer: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    actionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    cancelButton: {
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });

  if (!visible || !attachment) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.fileIcon}>
              <Ionicons
                name={getFileIcon(attachment.file_type) as any}
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={styles.fileName} numberOfLines={2}>
              {attachment.file_name}
            </Text>
            <Text style={styles.fileSize}>
              {(() => {
                const bytes = attachment.file_size;
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
              })()} • {attachment.file_type}
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            {actionOptions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionButton}
                onPress={() => onActionSelect(action.id)}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: action.color + '20' },
                  ]}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={20}
                    color={action.color}
                  />
                </View>
                <Text style={styles.actionText}>{action.label}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Status Update Modal Component
function StatusUpdateModal({
  visible,
  onClose,
  currentStatus,
  onUpdateStatus,
  isDark,
}: StatusUpdateModalProps) {
  const colors = themeColors[isDark ? 'dark' : 'light'];
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: colors.warning },
    { value: 'in_progress', label: 'In Progress', color: colors.info },
    { value: 'completed', label: 'Completed', color: colors.success },
  ];

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    statusOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedOption: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 12,
    },
    statusLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      gap: 12,
    },
    button: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.text,
    },
    confirmButtonText: {
      color: '#ffffff',
    },
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Task Status</Text>

          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusOption,
                selectedStatus === option.value && styles.selectedOption,
              ]}
              onPress={() => setSelectedStatus(option.value)}
            >
              <View
                style={[styles.statusDot, { backgroundColor: option.color }]}
              />
              <Text style={styles.statusLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={() => onUpdateStatus(selectedStatus)}
            >
              <Text style={[styles.buttonText, styles.confirmButtonText]}>
                Update
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Customer Update Modal Component
function CustomerUpdateModal({
  visible,
  onClose,
  onSendUpdate,
  isDark,
  customerName,
}: CustomerUpdateModalProps) {
  const colors = themeColors[isDark ? 'dark' : 'light'];
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    messageInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    button: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.text,
    },
    sendButtonText: {
      color: '#ffffff',
    },
  });

  const handleSend = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      await onSendUpdate(message.trim());
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Send Update to {customerName}</Text>

          <TextInput
            style={styles.messageInput}
            placeholder="Enter your message..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.sendButton]}
              onPress={handleSend}
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={[styles.buttonText, styles.sendButtonText]}>
                  Send
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
