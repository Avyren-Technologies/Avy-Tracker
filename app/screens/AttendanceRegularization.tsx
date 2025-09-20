import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import ThemeContext from "../context/ThemeContext";
import AuthContext from "../context/AuthContext";
import axios from "axios";
import RegularizationRequestForm from "../components/RegularizationRequestForm";
import RegularizationRequestCard from "../components/RegularizationRequestCard";

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

interface Statistics {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  cancelled_requests: number;
}

const AttendanceRegularization: React.FC = () => {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const isDark = theme === "dark";

  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchRequests = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setRequests(response.data.requests);
      }
    } catch (error: any) {
      console.error("Error fetching regularization requests:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to fetch regularization requests"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/statistics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (error: any) {
      console.error("Error fetching statistics:", error);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      const response = await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${requestId}/approve`,
        { action: 'approve' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        Alert.alert("Success", "Request approved successfully");
        fetchRequests(false);
        fetchStatistics();
      }
    } catch (error: any) {
      console.error("Error approving request:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to approve request"
      );
    }
  };

  const handleReject = async (requestId: number) => {
    Alert.prompt(
      "Reject Request",
      "Please provide a reason for rejection:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async (reason) => {
            try {
              const response = await axios.put(
                `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${requestId}/approve`,
                { action: 'reject', comments: reason },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (response.data.success) {
                Alert.alert("Success", "Request rejected successfully");
                fetchRequests(false);
                fetchStatistics();
              }
            } catch (error: any) {
              console.error("Error rejecting request:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error || "Failed to reject request"
              );
            }
          }
        }
      ],
      "plain-text"
    );
  };

  const handleCancel = async (requestId: number) => {
    Alert.prompt(
      "Cancel Request",
      "Please provide a reason for cancellation:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async (reason) => {
            try {
              const response = await axios.put(
                `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/request/${requestId}/cancel`,
                { reason },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (response.data.success) {
                Alert.alert("Success", "Request cancelled successfully");
                fetchRequests(false);
                fetchStatistics();
              }
            } catch (error: any) {
              console.error("Error cancelling request:", error);
              Alert.alert(
                "Error",
                error.response?.data?.error || "Failed to cancel request"
              );
            }
          }
        }
      ],
      "plain-text"
    );
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRequests(false);
    fetchStatistics();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
      fetchStatistics();
    }, [])
  );

  const filteredRequests = requests.filter(request => {
    switch (filter) {
      case 'pending':
        return request.status === 'pending' || request.status === 'group_admin_approved';
      case 'approved':
        return request.status === 'approved';
      case 'rejected':
        return request.status === 'rejected';
      default:
        return true;
    }
  });

  const getFilteredCount = (filterType: string) => {
    switch (filterType) {
      case 'pending':
        return requests.filter(r => r.status === 'pending' || r.status === 'group_admin_approved').length;
      case 'approved':
        return requests.filter(r => r.status === 'approved').length;
      case 'rejected':
        return requests.filter(r => r.status === 'rejected').length;
      default:
        return requests.length;
    }
  };

  const canCreateRequest = user?.role === 'employee';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f5f5f5' }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#000000" : "#ffffff"}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#000000' }]}>
          Attendance Regularization
        </Text>
        {canCreateRequest && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowRequestForm(true)}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Statistics */}
      {statistics && (
        <View style={[styles.statsContainer, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: isDark ? '#ffffff' : '#000000' }]}>
                {statistics.total_requests}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#666666' : '#999999' }]}>
                Total
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#FF9500' }]}>
                {statistics.pending_requests}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#666666' : '#999999' }]}>
                Pending
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#34C759' }]}>
                {statistics.approved_requests}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#666666' : '#999999' }]}>
                Approved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#FF3B30' }]}>
                {statistics.rejected_requests}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#666666' : '#999999' }]}>
                Rejected
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[
            { key: 'all', label: 'All', count: getFilteredCount('all') },
            { key: 'pending', label: 'Pending', count: getFilteredCount('pending') },
            { key: 'approved', label: 'Approved', count: getFilteredCount('approved') },
            { key: 'rejected', label: 'Rejected', count: getFilteredCount('rejected') },
          ].map((filterItem) => (
            <TouchableOpacity
              key={filterItem.key}
              style={[
                styles.filterButton,
                {
                  backgroundColor: filter === filterItem.key
                    ? '#007AFF'
                    : isDark ? '#2a2a2a' : '#f5f5f5'
                }
              ]}
              onPress={() => setFilter(filterItem.key as any)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  {
                    color: filter === filterItem.key
                      ? '#ffffff'
                      : isDark ? '#ffffff' : '#000000'
                  }
                ]}
              >
                {filterItem.label} ({filterItem.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Requests List */}
      <ScrollView
        style={styles.requestsList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.loadingText, { color: isDark ? '#ffffff' : '#000000' }]}>
              Loading requests...
            </Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={isDark ? '#666666' : '#999999'} />
            <Text style={[styles.emptyText, { color: isDark ? '#ffffff' : '#000000' }]}>
              No regularization requests found
            </Text>
            {canCreateRequest && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowRequestForm(true)}
              >
                <Text style={styles.emptyButtonText}>Create Request</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredRequests.map((request) => (
            <RegularizationRequestCard
              key={request.id}
              request={request}
              onPress={() => setSelectedRequest(request)}
              onApprove={() => handleApprove(request.id)}
              onReject={() => handleReject(request.id)}
              onCancel={() => handleCancel(request.id)}
              showActions={['group-admin', 'management'].includes(user?.role || '')}
              userRole={user?.role}
            />
          ))
        )}
      </ScrollView>

      {/* Request Form Modal */}
      <RegularizationRequestForm
        visible={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onSuccess={() => {
          fetchRequests(false);
          fetchStatistics();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  filtersContainer: {
    paddingVertical: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filters: {
    paddingHorizontal: 16,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  requestsList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AttendanceRegularization;
