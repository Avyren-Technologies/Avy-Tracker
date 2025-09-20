import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import ThemeContext from "../context/ThemeContext";

interface RegularizationRequest {
  id: number;
  request_date: string;
  original_start_time?: string;
  original_end_time?: string;
  requested_start_time: string;
  requested_end_time: string;
  reason: string;
  request_type: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
  status: 'pending' | 'group_admin_approved' | 'management_approved' | 'approved' | 'rejected' | 'cancelled';
  current_approver_role?: 'group-admin' | 'management';
  group_admin_comments?: string;
  management_comments?: string;
  final_comments?: string;
  created_at: string;
  employee_name?: string;
  group_admin_name?: string;
  management_name?: string;
}

interface RegularizationRequestCardProps {
  request: RegularizationRequest;
  onPress: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
  userRole?: string;
}

const RegularizationRequestCard: React.FC<RegularizationRequestCardProps> = ({
  request,
  onPress,
  onApprove,
  onReject,
  onCancel,
  showActions = false,
  userRole
}) => {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'group_admin_approved':
        return '#007AFF';
      case 'management_approved':
        return '#007AFF';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'cancelled':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Group Admin';
      case 'group_admin_approved':
        return 'Pending Management';
      case 'management_approved':
        return 'Approved';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'time_adjustment':
        return 'Time Adjustment';
      case 'missing_shift':
        return 'Missing Shift';
      case 'early_departure':
        return 'Early Departure';
      case 'late_arrival':
        return 'Late Arrival';
      default:
        return type;
    }
  };

  const canApprove = () => {
    if (!showActions || !userRole) return false;
    
    if (userRole === 'group-admin') {
      return request.status === 'pending' && request.current_approver_role === 'group-admin';
    }
    
    if (userRole === 'management') {
      return request.status === 'group_admin_approved' && request.current_approver_role === 'management';
    }
    
    return false;
  };

  const canCancel = () => {
    if (!showActions || !userRole) return false;
    
    if (userRole === 'employee') {
      return request.status === 'pending' || request.status === 'group_admin_approved';
    }
    
    return false;
  };

  const handleApprove = () => {
    Alert.alert(
      "Approve Request",
      "Are you sure you want to approve this regularization request?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", style: "default", onPress: onApprove }
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      "Reject Request",
      "Are you sure you want to reject this regularization request?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reject", style: "destructive", onPress: onReject }
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this regularization request?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "destructive", onPress: onCancel }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#ffffff' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.requestType, { color: isDark ? '#ffffff' : '#000000' }]}>
            {getRequestTypeLabel(request.request_type)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
          </View>
        </View>
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={isDark ? '#666666' : '#999999'} 
        />
      </View>

      <View style={styles.content}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={isDark ? '#666666' : '#999999'} />
          <Text style={[styles.dateText, { color: isDark ? '#ffffff' : '#000000' }]}>
            {format(parseISO(request.request_date), 'MMM dd, yyyy')}
          </Text>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Ionicons name="time-outline" size={16} color={isDark ? '#666666' : '#999999'} />
            <Text style={[styles.timeText, { color: isDark ? '#ffffff' : '#000000' }]}>
              {request.requested_start_time} - {request.requested_end_time}
            </Text>
          </View>
        </View>

        {request.original_start_time && (
          <View style={styles.originalTimeRow}>
            <Text style={[styles.originalTimeLabel, { color: isDark ? '#666666' : '#999999' }]}>
              Original: {request.original_start_time}
              {request.original_end_time && ` - ${request.original_end_time}`}
            </Text>
          </View>
        )}

        <Text 
          style={[styles.reasonText, { color: isDark ? '#ffffff' : '#000000' }]}
          numberOfLines={2}
        >
          {request.reason}
        </Text>

        {request.employee_name && (
          <View style={styles.employeeRow}>
            <Ionicons name="person-outline" size={16} color={isDark ? '#666666' : '#999999'} />
            <Text style={[styles.employeeText, { color: isDark ? '#666666' : '#999999' }]}>
              {request.employee_name}
            </Text>
          </View>
        )}
      </View>

      {showActions && (canApprove() || canCancel()) && (
        <View style={[styles.actions, { borderTopColor: isDark ? '#333' : '#e0e0e0' }]}>
          {canApprove() && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={handleApprove}
              >
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
              >
                <Ionicons name="close" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {canCancel() && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Ionicons name="trash-outline" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestType: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeRow: {
    marginBottom: 8,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  originalTimeRow: {
    marginBottom: 8,
  },
  originalTimeLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  employeeText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegularizationRequestCard;
